import { Invoice } from './invoice.model.js';
import { InvoiceLine } from './invoice-line.model.js';
import { Payment } from './payment.model.js';
import { CreditNote } from './credit-note.model.js';
import { FulfillmentAllocation } from '../fulfillment/fulfillment-allocation.model.js';
import { Fulfillment } from '../fulfillment/fulfillment.model.js';
import { Subscription } from '../subscriptions/subscription.model.js';
import { Quotation } from '../_shared/placeholders/quotation.model.js';

const findInvoices = (filter = {}) => Invoice.find(filter).sort({ created_at: -1 });

const findInvoiceById = (id) => Invoice.findById(id);

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

const createPayment = (data) => Payment.create(data);

const createCreditNote = (data) => CreditNote.create(data);

const findCreditNotes = (filter = {}) => CreditNote.find(filter).sort({ created_at: -1 });

const updateInvoice = (id, data) => Invoice.findByIdAndUpdate(id, data, { new: true, runValidators: true });

const findAllocationById = (id) => FulfillmentAllocation.findById(id).populate({
    path: 'quote_line_id',
    populate: { path: 'product_id' },
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
    findAllocationById,
    findSubscriptionById,
    findFulfillmentById,
    findQuotationById,
};
