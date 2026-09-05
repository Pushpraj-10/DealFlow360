import { DealAlert } from './deal-alert.model.js';
import { Notification } from './notification.model.js';
import { Quotation } from '../_shared/placeholders/quotation.model.js';
import { QuotationLine } from '../_shared/placeholders/quotation-line.model.js';
import { Fulfillment } from '../fulfillment/fulfillment.model.js';
import { Invoice } from '../invoicing/invoice.model.js';
import { Subscription } from '../subscriptions/subscription.model.js';
import { User } from '../auth/user.model.js';

const findOpenQuotations = () => Quotation.find({ status: { $ne: 'cancelled' } });

const findQuotationById = (id) => Quotation.findById(id);

const findQuotations = (filter = {}) => Quotation.find(filter).sort({ created_at: -1 });

const findManagers = () => User.find({ role: { $in: ['sales_manager', 'finance_ops'] } });

const findUsersByTeam = (team) => User.find({ team });

const findLinesByQuotationId = (quotationId) => QuotationLine.find({ quotation_id: quotationId });

const findHistoricalQuotationsByOwner = (ownerId, excludeQuotationId, limit) =>
    Quotation.find({ owner_id: ownerId, status: { $ne: 'draft' }, _id: { $ne: excludeQuotationId } })
        .sort({ created_at: -1 })
        .limit(limit);

const findFulfillmentByQuotationId = (quotationId) => Fulfillment.findOne({ quotation_id: quotationId });

const findAlerts = (filter = {}) => DealAlert.find(filter).sort({ created_at: -1 });

const findAlertById = (id) => DealAlert.findById(id);

const findExistingOpenAlert = (quotationId, type) =>
    DealAlert.findOne({ quotation_id: quotationId, type, status: 'OPEN' });

const createAlert = (data) => DealAlert.create(data);

const updateAlert = (id, data) => DealAlert.findByIdAndUpdate(id, data, { new: true });

const createNotification = (data) => Notification.create(data);

const countQuotationsByStatus = () => Quotation.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);

const countInvoicesByStatus = () => Invoice.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);

const countActiveSubscriptions = () => Subscription.countDocuments({ status: 'ACTIVE' });

const sumInvoiceTotals = () =>
    Invoice.aggregate([
        { $match: { status: { $ne: 'VOIDED' } } },
        { $group: { _id: null, total_cents: { $sum: '$total_cents' }, paid_cents: { $sum: '$paid_amount_cents' } } },
    ]);

export {
    findOpenQuotations,
    findQuotationById,
    findQuotations,
    findManagers,
    findUsersByTeam,
    findLinesByQuotationId,
    findHistoricalQuotationsByOwner,
    findFulfillmentByQuotationId,
    findAlerts,
    findAlertById,
    findExistingOpenAlert,
    createAlert,
    updateAlert,
    createNotification,
    countQuotationsByStatus,
    countInvoicesByStatus,
    countActiveSubscriptions,
    sumInvoiceTotals,
};
