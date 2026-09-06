import {Order} from './order.model.js';
import {OrderLine} from './orderLine.model.js';

const findOrders = (filter = {}) =>
    Order.find(filter)
    .populate('customerId', 'name company email')
    .populate('quotationId', 'quoteNumber status currentVersion confirmedVersion')
    .populate('fulfillmentId')
    .sort({updatedAt: -1});

const findOrderById = (id) =>
    Order.findById(id)
    .populate('customerId', 'name company email')
    .populate('quotationId', 'quoteNumber status currentVersion confirmedVersion')
    .populate('fulfillmentId');

const findOrderByQuotationId = (quotationId) =>
    Order.findOne({quotationId})
    .sort({quotationVersion: -1, updatedAt: -1})
    .populate('customerId', 'name company email')
    .populate('quotationId', 'quoteNumber status currentVersion confirmedVersion')
    .populate('fulfillmentId');

const findOrderByQuotationVersion = (quotationId, quotationVersion) =>
    Order.findOne({quotationId, quotationVersion});

const createOrder = (data) => Order.create(data);

const updateOrder = (id, data, session) =>
    Order.findByIdAndUpdate(id, {$set: data}, {new: true, runValidators: true, session});

const upsertOrderLine = async (filter, data) => {
    try {
        return await OrderLine.findOneAndUpdate(
            filter,
            {
                $set: data,
                $setOnInsert: {
                    allocatedQty: 0,
                    backorderQty: 0,
                    shippedQty: 0,
                    invoicedQty: 0
                }
            },
            {new: true, upsert: true, runValidators: true}
        );
    } catch (err) {
        if (err.code === 11000) {
            return OrderLine.findOne(filter);
        }
        throw err;
    }
};

const findOrderLines = (orderId) =>
    OrderLine.find({orderId})
    .populate('quotationLineId')
    .populate('productId', 'name productType billingType recurringPlanReference isStockManaged')
    .populate('variantId', 'sku name attributes extraPrice')
    .populate('subscriptionId')
    .sort({createdAt: 1});

const findOrderLineByQuoteLine = (quotationLineId) => OrderLine.findOne({quotationLineId});

const updateOrderLine = (id, data, session) =>
    OrderLine.findByIdAndUpdate(id, {$set: data}, {new: true, runValidators: true, session});

export {
    findOrders,
    findOrderById,
    findOrderByQuotationId,
    findOrderByQuotationVersion,
    createOrder,
    updateOrder,
    upsertOrderLine,
    findOrderLines,
    findOrderLineByQuoteLine,
    updateOrderLine
};
