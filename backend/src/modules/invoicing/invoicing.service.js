import { ApiError } from '../../core/utils/apiError.js';
import { ErrorCodes } from '../../core/utils/errorCodes.js';
import { logAction } from '../_shared/audit-log/audit-log.service.js';
import * as invoicingRepository from './invoicing.repository.js';

const DUE_DAYS = 14;

const dueDate = () => new Date(Date.now() + DUE_DAYS * 24 * 60 * 60 * 1000);
const invoiceNo = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

const listInvoices = ({ customer_id, status } = {}) => {
    const filter = {};
    if (customer_id) filter.customer_id = customer_id;
    if (status) filter.status = status;
    return invoicingRepository.findInvoices(filter);
};

const getInvoiceOrThrow = async (id) => {
    const invoice = await invoicingRepository.findInvoiceById(id);
    if (!invoice) {
        throw new ApiError(404, 'Invoice not found', [], '', ErrorCodes.NOT_FOUND);
    }
    return invoice;
};

const getInvoiceDetail = async (id) => {
    const invoice = await getInvoiceOrThrow(id);
    const lines = await invoicingRepository.findLinesByInvoiceId(id);
    const payments = await invoicingRepository.findPaymentsByInvoiceId(id);
    return { invoice, lines, payments };
};

/**
 * PRD section 8.9 - shipment-aware invoicing. Bills only the un-invoiced
 * portion of what has actually shipped for a given allocation, guaranteeing
 * cumulative invoiced qty never exceeds cumulative shipped qty by
 * construction (each call only ever creates a line for the remainder).
 */
const generateShipmentInvoice = async ({ fulfillment_allocation_id }, actorId) => {
    const allocation = await invoicingRepository.findAllocationById(fulfillment_allocation_id);
    if (!allocation) {
        throw new ApiError(404, 'Fulfillment allocation not found', [], '', ErrorCodes.NOT_FOUND);
    }

    const alreadyInvoicedQty = await invoicingRepository.sumInvoicedQtyForSource(
        'shipment',
        allocation._id
    );
    const invoiceableQty = allocation.shipped_qty - alreadyInvoicedQty;

    if (invoiceableQty <= 0) {
        throw new ApiError(
            400,
            'No un-invoiced shipped quantity available for this allocation',
            [],
            '',
            ErrorCodes.INVALID_SHIPMENT_QTY
        );
    }

    const quoteLine = allocation.quote_line_id;
    const product = quoteLine.product_id;

    const fulfillment = await invoicingRepository.findFulfillmentById(allocation.fulfillment_id);
    const quotation = await invoicingRepository.findQuotationById(fulfillment.quotation_id);

    const netUnitPriceCents = Math.round(quoteLine.unit_price_cents * (1 - quoteLine.discount_pct / 100));
    const amountCents = netUnitPriceCents * invoiceableQty;
    const taxCents = Math.round((amountCents * (quoteLine.tax_pct || 0)) / 100);

    const { invoice } = await invoicingRepository.createInvoiceWithLine(
        {
            invoice_no: invoiceNo('INV-SHP'),
            customer_id: quotation.customer_id,
            quotation_id: quotation._id,
            status: 'UNPAID',
            due_date: dueDate(),
            subtotal_cents: amountCents,
            tax_cents: taxCents,
            total_cents: amountCents + taxCents,
        },
        {
            source_type: 'shipment',
            source_id: allocation._id,
            description: `${product?.name || product?.sku || 'Item'} - shipped qty ${invoiceableQty}`,
            qty: invoiceableQty,
            unit_price_cents: netUnitPriceCents,
            tax_cents: taxCents,
            amount_cents: amountCents,
        }
    );

    await logAction({
        actorId,
        action: 'INVOICE_CREATED',
        entityType: 'Invoice',
        entityId: invoice._id,
        metadata: { source_type: 'shipment', fulfillment_allocation_id, invoiceableQty },
    });

    return invoice;
};

const generateSubscriptionInvoice = async ({ subscription_id, billing_period }, actorId) => {
    if (!billing_period) {
        throw new ApiError(400, 'billing_period is required', [], '', ErrorCodes.VALIDATION_ERROR);
    }

    const subscription = await invoicingRepository.findSubscriptionById(subscription_id);
    if (!subscription) {
        throw new ApiError(404, 'Subscription not found', [], '', ErrorCodes.NOT_FOUND);
    }

    const amountCents = subscription.recurring_unit_price_cents * subscription.qty;

    let invoice;
    try {
        ({ invoice } = await invoicingRepository.createInvoiceWithLine(
            {
                invoice_no: invoiceNo('INV-SUB'),
                customer_id: subscription.customer_id,
                subscription_id: subscription._id,
                billing_period,
                status: 'UNPAID',
                due_date: dueDate(),
                subtotal_cents: amountCents,
                tax_cents: 0,
                total_cents: amountCents,
            },
            {
                source_type: 'subscription',
                source_id: subscription._id,
                description: `Recurring billing for ${billing_period}`,
                qty: subscription.qty,
                unit_price_cents: subscription.recurring_unit_price_cents,
                amount_cents: amountCents,
            }
        ));
    } catch (err) {
        if (err.code === 11000) {
            throw new ApiError(
                409,
                `Invoice for billing period ${billing_period} already exists`,
                [],
                '',
                ErrorCodes.DUPLICATE_BILLING_PERIOD
            );
        }
        throw err;
    }

    await logAction({
        actorId,
        action: 'INVOICE_CREATED',
        entityType: 'Invoice',
        entityId: invoice._id,
        metadata: { source_type: 'subscription', subscription_id, billing_period },
    });

    return invoice;
};

const generateInvoice = async (body, actorId) => {
    if (body.source_type === 'shipment') return generateShipmentInvoice(body, actorId);
    if (body.source_type === 'subscription') return generateSubscriptionInvoice(body, actorId);
    throw new ApiError(400, "source_type must be 'shipment' or 'subscription'", [], '', ErrorCodes.VALIDATION_ERROR);
};

const recordPayment = async (invoiceId, { amount_cents, method, reference }, actorId) => {
    if (!amount_cents || amount_cents <= 0) {
        throw new ApiError(400, 'amount_cents must be positive', [], '', ErrorCodes.VALIDATION_ERROR);
    }

    const invoice = await getInvoiceOrThrow(invoiceId);
    if (!['UNPAID', 'PARTIALLY_PAID'].includes(invoice.status)) {
        throw new ApiError(409, 'Invoice is not open for payment', [], '', ErrorCodes.VALIDATION_ERROR);
    }

    const balanceCents = invoice.total_cents - invoice.paid_amount_cents;
    if (amount_cents > balanceCents) {
        throw new ApiError(
            400,
            `Payment of ${amount_cents} exceeds remaining balance of ${balanceCents}`,
            [],
            '',
            ErrorCodes.PAYMENT_EXCEEDS_BALANCE
        );
    }

    const payment = await invoicingRepository.createPayment({
        invoice_id: invoiceId,
        amount_cents,
        method,
        reference,
        recorded_by: actorId,
    });

    const newPaidAmount = invoice.paid_amount_cents + amount_cents;
    const updatedInvoice = await invoicingRepository.updateInvoice(invoiceId, {
        paid_amount_cents: newPaidAmount,
        status: newPaidAmount >= invoice.total_cents ? 'PAID' : 'PARTIALLY_PAID',
    });

    await logAction({
        actorId,
        action: 'PAYMENT_RECORDED',
        entityType: 'Invoice',
        entityId: invoiceId,
        metadata: { amount_cents, method, reference, paymentId: payment._id },
    });

    return { invoice: updatedInvoice, payment };
};

const listCreditNotes = ({ customer_id, invoice_id } = {}) => {
    const filter = {};
    if (customer_id) filter.customer_id = customer_id;
    if (invoice_id) filter.invoice_id = invoice_id;
    return invoicingRepository.findCreditNotes(filter);
};

/**
 * Manual credit note (cancellations/returns). Reduces the net invoiced
 * financial amount via a negative invoice line without touching shipped
 * quantity, per PRD section 8.9.
 */
const issueCreditNote = async ({ customer_id, invoice_id, amount_cents, reason }, actorId) => {
    if (!customer_id || !amount_cents || amount_cents <= 0 || !reason) {
        throw new ApiError(
            400,
            'customer_id, a positive amount_cents and reason are required',
            [],
            '',
            ErrorCodes.VALIDATION_ERROR
        );
    }

    const creditNote = await invoicingRepository.createCreditNote({
        customer_id,
        invoice_id: invoice_id || null,
        amount_cents,
        reason,
        status: 'ISSUED',
    });

    if (invoice_id) {
        const invoice = await getInvoiceOrThrow(invoice_id);

        const newTotal = Math.max(0, invoice.total_cents - amount_cents);
        await invoicingRepository.updateInvoice(invoice_id, {
            total_cents: newTotal,
            status: newTotal <= invoice.paid_amount_cents ? (newTotal === 0 ? 'CREDITED' : 'PAID') : invoice.status,
        });
    }

    await logAction({
        actorId,
        action: 'CREDIT_NOTE_CREATED',
        entityType: 'CreditNote',
        entityId: creditNote._id,
        reason,
        metadata: { invoice_id, amount_cents },
    });

    return creditNote;
};

export {
    listInvoices,
    getInvoiceOrThrow,
    getInvoiceDetail,
    generateInvoice,
    recordPayment,
    listCreditNotes,
    issueCreditNote,
};
