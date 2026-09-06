import {ApiError} from '../../core/utils/apiError.js';
import {ErrorCodes} from '../../core/utils/errorCodes.js';
import {ORDER_LINE_STATUSES, ORDER_STATUSES, QUOTATION_STATUSES} from '../../core/constants.js';
import {logAction} from '../_shared/audit-log/audit-log.service.js';
import {Quotation} from '../quotations/quotation.model.js';
import {QuotationLine} from '../quotationLines/quotationLine.model.js';
import * as ordersRepository from './orders.repository.js';

const listOrders = (filter = {}) => ordersRepository.findOrders(filter);

const getOrderDetail = async (orderId) => {
    const order = await ordersRepository.findOrderById(orderId);

    if (!order) {
        throw new ApiError(404, 'Order not found', [], '', ErrorCodes.NOT_FOUND);
    }

    const lines = await ordersRepository.findOrderLines(order._id);

    return {order, lines};
};

const getOrderByQuotation = async (quotationId) => {
    const order = await ordersRepository.findOrderByQuotationId(quotationId);

    if (!order) {
        throw new ApiError(404, 'Order not found for quotation', [], '', ErrorCodes.NOT_FOUND);
    }

    const lines = await ordersRepository.findOrderLines(order._id);

    return {order, lines};
};

const generateOrderNumber = (quotation) => `O-${quotation.quoteNumber}-V${quotation.confirmedVersion || quotation.currentVersion}`;

const ensureOrderFromConfirmedQuotation = async (quotationId, actor) => {
    const quotation = await Quotation.findById(quotationId);

    if (!quotation) {
        throw new ApiError(404, 'Quotation not found', [], '', ErrorCodes.NOT_FOUND);
    }

    if (quotation.status !== QUOTATION_STATUSES.CONFIRMED) {
        throw new ApiError(400, 'Only confirmed quotations can be converted to orders', [], '', ErrorCodes.VALIDATION_ERROR);
    }

    const quotationVersion = quotation.confirmedVersion || quotation.currentVersion;
    let order = await ordersRepository.findOrderByQuotationVersion(quotation._id, quotationVersion);

    if (order) {
        return {order, created: false, quotation};
    }

    try {
        order = await ordersRepository.createOrder({
            orderNumber: generateOrderNumber(quotation),
            quotationId: quotation._id,
            quotationVersion,
            customerId: quotation.customerId,
            confirmedById: quotation.confirmedById || actor?.id || null,
            status: ORDER_STATUSES.ORDER_CREATED,
            subtotal: quotation.subtotal,
            totalDiscount: quotation.totalDiscount,
            tax: quotation.tax,
            grandTotal: quotation.grandTotal,
            currencyCode: quotation.currencyCode,
            flow: {
                orderCreatedAt: new Date()
            }
        });
    } catch (err) {
        if (err.code === 11000) {
            order = await ordersRepository.findOrderByQuotationVersion(quotation._id, quotationVersion);
            return {order, created: false, quotation};
        }
        throw err;
    }

    await logAction({
        actorId: actor?.id || null,
        action: 'ORDER_CREATED',
        entityType: 'Order',
        entityId: order._id,
        quotationId: quotation._id,
        customerId: quotation.customerId,
        metadata: {quotationVersion}
    });

    return {order, created: true, quotation};
};

const ensureOrderLines = async (order, actor) => {
    const quoteLines = await QuotationLine.find({quotationId: order.quotationId})
    .populate('productId', 'name productType billingType recurringPlanReference isStockManaged')
    .populate('variantId', 'sku name attributes extraPrice')
    .sort({createdAt: 1});

    const orderLines = [];

    for (const quoteLine of quoteLines) {
        const product = quoteLine.productId;
        const status = quoteLine.lineType === 'RECURRING' || product?.isStockManaged === false
            ? ORDER_LINE_STATUSES.NOT_STOCK_MANAGED
            : ORDER_LINE_STATUSES.AWAITING_ALLOCATION;

        const orderLine = await ordersRepository.upsertOrderLine(
            {orderId: order._id, quotationLineId: quoteLine._id},
            {
                orderId: order._id,
                quotationId: order.quotationId,
                quotationLineId: quoteLine._id,
                productId: product?._id || quoteLine.productId,
                variantId: quoteLine.variantId?._id || quoteLine.variantId || null,
                lineType: quoteLine.lineType,
                sku: quoteLine.variantId?.sku || null,
                requestedQty: quoteLine.quantity,
                unitPrice: quoteLine.unitPrice,
                discountPercent: quoteLine.discountPercent,
                taxPercentage: quoteLine.taxPercentage,
                lineTotal: quoteLine.lineTotal,
                status
            }
        );

        orderLines.push(orderLine);
    }

    await ordersRepository.updateOrder(order._id, {
        status: ORDER_STATUSES.ORDER_LINES_CREATED,
        'flow.orderLinesCreatedAt': new Date(),
        'flow.lastFailedStage': null,
        'flow.lastError': null
    });

    await logAction({
        actorId: actor?.id || null,
        action: 'ORDER_LINES_SYNCED',
        entityType: 'Order',
        entityId: order._id,
        quotationId: order.quotationId,
        customerId: order.customerId,
        metadata: {lineCount: orderLines.length}
    });

    return orderLines;
};

const markOrderFlowFailed = async (orderId, stage, err) => {
    const message = err?.message || 'Order flow failed';

    return ordersRepository.updateOrder(orderId, {
        status: ORDER_STATUSES.FLOW_FAILED,
        'flow.lastFailedStage': stage,
        'flow.lastError': message,
        'flow.lastRetryAt': new Date()
    });
};

const updateOrderCheckpoint = (orderId, status, checkpointField, extra = {}) =>
    ordersRepository.updateOrder(orderId, {
        status,
        ...(checkpointField ? {[`flow.${checkpointField}`]: new Date()} : {}),
        'flow.lastFailedStage': null,
        'flow.lastError': null,
        ...extra
    });

export {
    listOrders,
    getOrderDetail,
    getOrderByQuotation,
    ensureOrderFromConfirmedQuotation,
    ensureOrderLines,
    markOrderFlowFailed,
    updateOrderCheckpoint
};
