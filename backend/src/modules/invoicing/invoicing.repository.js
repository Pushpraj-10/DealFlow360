import { Invoice } from './invoice.model.js';
import { InvoiceLine } from './invoice-line.model.js';
import { Payment } from './payment.model.js';
import { CreditNote } from './credit-note.model.js';
import { FulfillmentAllocation } from '../fulfillment/fulfillment-allocation.model.js';
import { Fulfillment } from '../fulfillment/fulfillment.model.js';
import { Subscription } from '../subscriptions/subscription.model.js';
import { Quotation } from '../quotations/quotation.model.js';

const findInvoices = (filter = {}) => Invoice.find(filter).sort({ created_at: -1 });

const findInvoiceById = (id, session) => {
    const query = Invoice.findById(id);
    return session ? query.session(session) : query;
};

const findLinesByInvoiceId = (invoiceId) => InvoiceLine.find({ invoice_id: invoiceId });

const findPaymentsByInvoiceId = (invoiceId) => Payment.find({ invoice_id: invoiceId }).sort({ paid_at: -1 });

const sumInvoicedQtyForSource = async (sourceType, sourceId) => {
    const lines = await InvoiceLine.find({ source_type: sourceType, source_id: sourceId }).populate({
        path: 'invoice_id',
        select: 'status',
    });
    return lines
        .filter((line) => line.invoice_id?.status !== 'VOIDED')
        .reduce((sum, line) => sum + line.qty, 0);
};

const createInvoiceWithLine = async (invoiceData, lineData) => {
    const invoice = await Invoice.create(invoiceData);
    const line = await InvoiceLine.create({ ...lineData, invoice_id: invoice._id });
    return { invoice, line };
};

const createPayment = async (data, session) => {
    const [payment] = await Payment.create([data], { session });
    return payment;
};

const createCreditNote = async (data, session) => {
    const [creditNote] = await CreditNote.create([data], { session });
    return creditNote;
};

const findCreditNotes = (filter = {}) => CreditNote.find(filter).sort({ created_at: -1 });

const updateInvoice = (id, data, session) =>
    Invoice.findByIdAndUpdate(id, data, { new: true, runValidators: true, session });

// Atomic $inc avoids the lost-update race of a read-modify-write on
// paid_amount_cents/total_cents when two payments or credit notes for the
// same invoice are submitted concurrently.
const incrementInvoiceAmounts = (id, delta, session) =>
    Invoice.findByIdAndUpdate(id, { $inc: delta }, { new: true, session });

const findAllocationById = (id) => FulfillmentAllocation.findById(id).populate({
    path: 'quote_line_id',
    populate: ['productId', 'variantId'],
});

const findSubscriptionById = (id) => Subscription.findById(id);

const findFulfillmentById = (id) => Fulfillment.findById(id);

const findQuotationById = (id) => Quotation.findById(id);

export {
    findInvoices,
    findInvoiceById,
    findLinesByInvoiceId,
    findPaymentsByInvoiceId,
    sumInvoicedQtyForSource,
    createInvoiceWithLine,
    createPayment,
    createCreditNote,
    findCreditNotes,
    updateInvoice,
    incrementInvoiceAmounts,
    findAllocationById,
    findSubscriptionById,
    findFulfillmentById,
    findQuotationById,
};
