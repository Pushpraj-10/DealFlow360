import { DealAlert } from './deal-alert.model.js';
import { Notification } from './notification.model.js';
import { Quotation } from '../quotations/quotation.model.js';
import { QuotationLine } from '../quotationLines/quotationLine.model.js';
import { Fulfillment } from '../fulfillment/fulfillment.model.js';
import { Invoice } from '../invoicing/invoice.model.js';
import { Subscription } from '../subscriptions/subscription.model.js';
import { User } from '../users/user.model.js';
import { Product } from '../products/product.model.js';
import { USER_ROLES, USER_STATUSES, QUOTATION_STATUSES } from '../../core/constants.js';

const findOpenQuotations = () => Quotation.find({ status: { $ne: QUOTATION_STATUSES.CANCELLED } });

const findQuotationById = (id) => Quotation.findById(id);

const findQuotations = (filter = {}) => Quotation.find(filter).sort({ createdAt: -1 });

const findManagers = () => User.find({ role: { $in: [USER_ROLES.SALES_MANAGER, USER_ROLES.FINANCE] } });

const findUsersByTeam = (team) => User.find({ team });

const findSalesReps = () =>
    User.find({ role: USER_ROLES.SALES_REP, status: USER_STATUSES.ACTIVE }).select('fullName email team');

const findDistinctTeams = () => User.distinct('team', { team: { $ne: null } });

const findProductsByCategory = (categoryId) => Product.find({ categoryId }).select('_id');

const findLinesByQuotationId = (quotationId) => QuotationLine.find({ quotationId });

const findHistoricalQuotationsByOwner = (salesRepId, excludeQuotationId, limit) =>
    Quotation.find({
        salesRepId,
        status: { $ne: QUOTATION_STATUSES.DRAFT },
        _id: { $ne: excludeQuotationId },
    })
        .sort({ createdAt: -1 })
        .limit(limit);

const findFulfillmentByQuotationId = (quotationId) => Fulfillment.findOne({ quotation_id: quotationId });

const findAlerts = (filter = {}, { skip, limit } = {}) => {
    let query = DealAlert.find(filter).sort({ created_at: -1 });
    if (skip) query = query.skip(skip);
    if (limit) query = query.limit(limit);
    return query;
};

const countAlerts = (filter = {}) => DealAlert.countDocuments(filter);

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
    findSalesReps,
    findDistinctTeams,
    findProductsByCategory,
    findLinesByQuotationId,
    findHistoricalQuotationsByOwner,
    findFulfillmentByQuotationId,
    findAlerts,
    countAlerts,
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
