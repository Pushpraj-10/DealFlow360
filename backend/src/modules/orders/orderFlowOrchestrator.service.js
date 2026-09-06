import mongoose from 'mongoose';

import {ORDER_LINE_STATUSES, ORDER_STATUSES} from '../../core/constants.js';
import {logAction} from '../_shared/audit-log/audit-log.service.js';
import {ApiError} from '../../core/utils/apiError.js';
import {ErrorCodes} from '../../core/utils/errorCodes.js';
import {createOrGetFulfillment, getFulfillmentDetail, suggestSplit} from '../fulfillment/fulfillment.service.js';
import * as invoicingRepository from '../invoicing/invoicing.repository.js';
import {generateInvoice} from '../invoicing/invoicing.service.js';
import {SubscriptionPlan} from '../subscriptions/subscription-plan.model.js';
import {createSubscription} from '../subscriptions/subscription.service.js';
import * as subscriptionRepository from '../subscriptions/subscription.repository.js';
import * as ordersRepository from './orders.repository.js';
import {
    ensureOrderFromConfirmedQuotation,
    ensureOrderLines,
    markOrderFlowFailed,
    updateOrderCheckpoint
} from './orders.service.js';

const cents = (value) => Math.round(Number(value || 0) * 100);
const objectIdOf = (value) => value?._id || value;

const stageError = (stage, err) => {
    err.orderFlowStage = err.orderFlowStage || stage;
    return err;
};

const runStage = async (stage, fn) => {
    try {
        return await fn();
    } catch (err) {
        throw stageError(stage, err);
    }
};

const resolvePlanForRecurringProduct = async (product) => {
    const reference = product?.recurringPlanReference;

    if (!reference) {
        return null;
    }

    if (mongoose.Types.ObjectId.isValid(reference)) {
        return SubscriptionPlan.findById(reference);
    }

    const normalizedReference = String(reference).toLowerCase().replace(/[^a-z0-9]/g, '');
    const plans = await SubscriptionPlan.find({active: true});

    return plans.find((plan) => plan.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedReference) || null;
};

const isNonStockOneTimeLine = (line) =>
    line.lineType === 'ONE_TIME' && line.productId?.isStockManaged === false;

const isRecurringLine = (line) => line.lineType === 'RECURRING';

const ensureServiceInvoiceForLine = async (order, line, actorId) => {
    const quoteLineId = line.quotationLineId?._id || line.quotationLineId;
    const existingLines = await invoicingRepository.findLinesBySource('service', quoteLineId);
    const activeLine = existingLines.find((invoiceLine) => invoiceLine.invoice_id?.status !== 'VOIDED');

    if (activeLine) {
        return activeLine;
    }

    const taxableAmountCents = cents(line.unitPrice * line.requestedQty * (1 - line.discountPercent / 100));
    const taxCents = Math.round((taxableAmountCents * line.taxPercentage) / 100);
    const {invoice, line: invoiceLine} = await invoicingRepository.createInvoiceWithLine(
        {
            invoice_no: `INV-SVC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            customer_id: order.customerId,
            quotation_id: order.quotationId,
            status: 'DRAFT',
            due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            currency: order.currencyCode,
            subtotal_cents: taxableAmountCents,
            tax_cents: taxCents,
            total_cents: taxableAmountCents + taxCents
        },
        {
            source_type: 'service',
            source_id: quoteLineId,
            description: `${line.productId?.name || 'Service'} - order ${order.orderNumber}`,
            qty: line.requestedQty,
            unit_price_cents: cents(line.unitPrice * (1 - line.discountPercent / 100)),
            tax_cents: taxCents,
            amount_cents: taxableAmountCents
        }
    );

    await logAction({
        actorId,
        action: 'INVOICE_CREATED',
        entityType: 'Invoice',
        entityId: invoice._id,
        quotationId: order.quotationId,
        customerId: order.customerId,
        metadata: {source_type: 'service', quotationLineId: quoteLineId, orderId: order._id}
    });

    return invoiceLine;
};

const ensureSubscriptionForLine = async (order, line, actorId) => {
    const quoteLineId = line.quotationLineId?._id || line.quotationLineId;
    const existing = await subscriptionRepository.findSubscriptionByQuoteLineId(quoteLineId);

    if (existing) {
        return existing;
    }

    const plan = await resolvePlanForRecurringProduct(line.productId);

    if (!plan) {
        throw new ApiError(
            409,
            `No active subscription plan found for recurring product ${line.productId?.name || line.productId}`,
            [],
            '',
            ErrorCodes.VALIDATION_ERROR
        );
    }

    try {
        return await createSubscription({
            customer_id: order.customerId,
            originating_quote_line_id: quoteLineId,
            plan_id: plan._id,
            qty: line.requestedQty,
            recurring_unit_price_cents: cents(line.unitPrice * (1 - line.discountPercent / 100)),
            start_date: new Date()
        }, actorId);
    } catch (err) {
        if (err.code === 11000) {
            return subscriptionRepository.findSubscriptionByQuoteLineId(quoteLineId);
        }
        throw err;
    }
};

const syncOrderQuantitiesFromFulfillment = async (order) => {
    let detail = null;

    if (order.fulfillmentId) {
        detail = await getFulfillmentDetail(order.fulfillmentId);
    }

    const lines = await ordersRepository.findOrderLines(order._id);
    const allocations = detail?.allocations || [];
    const backorders = detail?.backorders || [];

    for (const line of lines) {
        const lineId = line.quotationLineId?._id?.toString() || line.quotationLineId.toString();
        const lineAllocations = allocations.filter((allocation) => {
            const allocationLineId = allocation.quote_line_id?._id?.toString() || allocation.quote_line_id?.toString();
            return allocationLineId === lineId;
        });
        const lineBackorders = backorders.filter((backorder) => backorder.quote_line_id.toString() === lineId);
        const invoiceLinesByShipment = lineAllocations.length
            ? await invoicingRepository.findLinesBySource('shipment', lineAllocations.map((allocation) => allocation._id))
            : [];
        const serviceInvoiceLines = await invoicingRepository.findLinesBySource('service', line.quotationLineId?._id || line.quotationLineId);
        const subscription = await subscriptionRepository.findSubscriptionByQuoteLineId(line.quotationLineId?._id || line.quotationLineId);

        const allocatedQty = lineAllocations.reduce((sum, allocation) => sum + allocation.allocated_qty, 0);
        const shippedQty = lineAllocations.reduce((sum, allocation) => sum + allocation.shipped_qty, 0);
        const backorderQty = lineBackorders
        .filter((backorder) => backorder.status !== 'RESOLVED')
        .reduce((sum, backorder) => sum + backorder.qty, 0);
        const invoicedQty = [...invoiceLinesByShipment, ...serviceInvoiceLines]
        .filter((invoiceLine) => invoiceLine.invoice_id?.status !== 'VOIDED')
        .reduce((sum, invoiceLine) => sum + invoiceLine.qty, 0);

        let status = line.status;
        if (subscription) {
            status = ORDER_LINE_STATUSES.SUBSCRIPTION_ACTIVE;
        } else if (invoicedQty >= line.requestedQty) {
            status = ORDER_LINE_STATUSES.BILLED;
        } else if (shippedQty >= line.requestedQty) {
            status = ORDER_LINE_STATUSES.SHIPPED;
        } else if (shippedQty > 0) {
            status = ORDER_LINE_STATUSES.PARTIALLY_SHIPPED;
        } else if (backorderQty >= line.requestedQty) {
            status = ORDER_LINE_STATUSES.BACKORDERED;
        } else if (allocatedQty > 0 && backorderQty > 0) {
            status = ORDER_LINE_STATUSES.PARTIALLY_ALLOCATED;
        } else if (allocatedQty >= line.requestedQty) {
            status = ORDER_LINE_STATUSES.ALLOCATED;
        } else if (line.lineType === 'RECURRING' || line.productId?.isStockManaged === false) {
            status = ORDER_LINE_STATUSES.NOT_STOCK_MANAGED;
        } else {
            status = ORDER_LINE_STATUSES.AWAITING_ALLOCATION;
        }

        await ordersRepository.updateOrderLine(line._id, {
            allocatedQty,
            shippedQty,
            backorderQty,
            invoicedQty,
            fulfillmentAllocationIds: lineAllocations.map((allocation) => allocation._id),
            backorderIds: lineBackorders.map((backorder) => backorder._id),
            invoiceLineIds: [...invoiceLinesByShipment, ...serviceInvoiceLines].map((invoiceLine) => invoiceLine._id),
            subscriptionId: subscription?._id || null,
            status
        });
    }

    return ordersRepository.findOrderLines(order._id);
};

const syncOrderStatus = async (orderId, actorId = null) => {
    const order = await ordersRepository.findOrderById(orderId);

    if (!order) {
        throw new ApiError(404, 'Order not found', [], '', ErrorCodes.NOT_FOUND);
    }

    const lines = await syncOrderQuantitiesFromFulfillment(order);
    const fulfillmentStatus = order.fulfillmentId
        ? (await getFulfillmentDetail(order.fulfillmentId)).fulfillment.status
        : null;
    const hasSubscription = lines.some((line) => line.subscriptionId);
    const allRecurringOrBilled = lines.every((line) =>
        [ORDER_LINE_STATUSES.BILLED, ORDER_LINE_STATUSES.SUBSCRIPTION_ACTIVE, ORDER_LINE_STATUSES.COMPLETE].includes(line.status)
    );
    const anyInvoiced = lines.some((line) => line.invoicedQty > 0);

    let status = order.status === ORDER_STATUSES.FLOW_FAILED ? ORDER_STATUSES.FLOW_FAILED : ORDER_STATUSES.ORDER_LINES_CREATED;
    if (fulfillmentStatus === 'SPLIT_PROPOSED') status = ORDER_STATUSES.SPLIT_PROPOSED;
    if (fulfillmentStatus === 'RESERVED') status = ORDER_STATUSES.RESERVED;
    if (fulfillmentStatus === 'BACKORDER') status = ORDER_STATUSES.BACKORDER;
    if (fulfillmentStatus === 'PARTIAL_BACKORDER') status = ORDER_STATUSES.PARTIAL_BACKORDER;
    if (fulfillmentStatus === 'PARTIALLY_SHIPPED') status = ORDER_STATUSES.PARTIALLY_SHIPPED;
    if (fulfillmentStatus === 'SHIPPED') status = ORDER_STATUSES.SHIPPED;
    if (anyInvoiced && !allRecurringOrBilled) status = ORDER_STATUSES.PARTIALLY_BILLED;
    if (hasSubscription && allRecurringOrBilled) status = ORDER_STATUSES.ACTIVE_SUBSCRIPTION;
    if (allRecurringOrBilled && !hasSubscription) status = ORDER_STATUSES.BILLED;
    if (allRecurringOrBilled && fulfillmentStatus === 'SHIPPED') status = ORDER_STATUSES.COMPLETED;

    const billingStatus = allRecurringOrBilled ? 'BILLED' : anyInvoiced || hasSubscription ? 'PARTIAL' : 'PENDING';

    const updated = await updateOrderCheckpoint(order._id, status, 'statusSyncedAt', {
        fulfillmentStatus,
        billingStatus
    });

    await logAction({
        actorId,
        action: 'ORDER_STATUS_SYNCED',
        entityType: 'Order',
        entityId: order._id,
        quotationId: order.quotationId?._id || order.quotationId,
        customerId: order.customerId?._id || order.customerId,
        metadata: {status, fulfillmentStatus, billingStatus}
    });

    return updated;
};

const prepareBillingForNonStockAndRecurringLines = async (order, actorId) => {
    const lines = await ordersRepository.findOrderLines(order._id);

    for (const line of lines) {
        if (isNonStockOneTimeLine(line)) {
            const invoiceLine = await ensureServiceInvoiceForLine(order, line, actorId);
            await ordersRepository.updateOrderLine(line._id, {
                invoiceLineIds: [...new Set([...line.invoiceLineIds.map(String), invoiceLine._id.toString()])],
                invoicedQty: line.requestedQty,
                status: ORDER_LINE_STATUSES.BILLED
            });
        }

        if (isRecurringLine(line)) {
            const subscription = await ensureSubscriptionForLine(order, line, actorId);
            await ordersRepository.updateOrderLine(line._id, {
                subscriptionId: subscription._id,
                status: ORDER_LINE_STATUSES.SUBSCRIPTION_ACTIVE
            });
        }
    }

    return updateOrderCheckpoint(order._id, ORDER_STATUSES.BILLING_PENDING, 'billingPreparedAt');
};

const runConfirmedQuotationFlow = async ({quotationId, actor, throwOnFailure = false}) => {
    let order;

    try {
        const orderResult = await runStage('ORDER_CREATED', () => ensureOrderFromConfirmedQuotation(quotationId, actor));
        order = orderResult.order;

        const orderLines = await runStage('ORDER_LINES_CREATED', () => ensureOrderLines(order, actor));
        order = await runStage('INVENTORY_CHECKED', () => updateOrderCheckpoint(order._id, ORDER_STATUSES.INVENTORY_CHECKED, 'inventoryCheckedAt'));

        const needsFulfillment = orderLines.some((line) => line.status === ORDER_LINE_STATUSES.AWAITING_ALLOCATION);

        if (needsFulfillment) {
            const fulfillment = await runStage('FULFILLMENT_CREATED', () => createOrGetFulfillment({quotation_id: quotationId}, actor?.id || null));
            order = await runStage('FULFILLMENT_CREATED', () => updateOrderCheckpoint(order._id, ORDER_STATUSES.FULFILLMENT_PENDING, 'fulfillmentCreatedAt', {
                fulfillmentId: fulfillment._id,
                fulfillmentStatus: fulfillment.status
            }));

            if (!['RESERVED', 'PARTIALLY_SHIPPED', 'SHIPPED'].includes(fulfillment.status)) {
                const splitDetail = await runStage('SPLIT_SUGGESTED', () => suggestSplit(fulfillment._id, actor?.id || null));
                order = await runStage('SPLIT_SUGGESTED', () => updateOrderCheckpoint(order._id, ORDER_STATUSES.SPLIT_PROPOSED, 'splitSuggestedAt', {
                    fulfillmentStatus: splitDetail.fulfillment.status
                }));
            }
        }

        await runStage('BILLING_PREPARED', () => prepareBillingForNonStockAndRecurringLines(order, actor?.id || null));
        const updatedOrder = await runStage('STATUS_SYNCED', () => syncOrderStatus(order._id, actor?.id || null));

        return {order: updatedOrder, failed: false};
    } catch (err) {
        if (order?._id) {
            await markOrderFlowFailed(order._id, err.orderFlowStage || 'ORDER_FLOW', err);
        }

        if (throwOnFailure) {
            throw err;
        }

        return {
            order,
            failed: true,
            stage: err.orderFlowStage || 'ORDER_FLOW',
            message: err.message
        };
    }
};

const retryOrderFlow = async ({orderId, actor}) => {
    const order = await ordersRepository.findOrderById(orderId);

    if (!order) {
        throw new ApiError(404, 'Order not found', [], '', ErrorCodes.NOT_FOUND);
    }

    return runConfirmedQuotationFlow({
        quotationId: order.quotationId?._id || order.quotationId,
        actor,
        throwOnFailure: true
    });
};

const handleShipmentBilling = async ({fulfillmentId, allocationId, actor}) => {
    const detail = await getFulfillmentDetail(fulfillmentId);
    const order = await ordersRepository.findOrderByQuotationId(objectIdOf(detail.fulfillment.quotation_id));

    if (!order) {
        return null;
    }

    try {
        await generateInvoice({
            source_type: 'shipment',
            fulfillment_allocation_id: allocationId
        }, actor?.id || actor || null);
    } catch (err) {
        if (!/No un-invoiced shipped quantity/i.test(err.message || '')) {
            await markOrderFlowFailed(order._id, 'SHIPMENT_BILLING', err);
            return {
                order: await ordersRepository.findOrderById(order._id),
                failed: true,
                stage: 'SHIPMENT_BILLING',
                message: err.message
            };
        }
    }

    try {
        await syncOrderStatus(order._id, actor?.id || actor || null);
    } catch (err) {
        await markOrderFlowFailed(order._id, 'STATUS_SYNCED', err);
        return {
            order: await ordersRepository.findOrderById(order._id),
            failed: true,
            stage: 'STATUS_SYNCED',
            message: err.message
        };
    }

    return ordersRepository.findOrderById(order._id);
};

const syncOrderForFulfillment = async ({fulfillmentId, actorId = null}) => {
    const detail = await getFulfillmentDetail(fulfillmentId);
    const order = await ordersRepository.findOrderByQuotationId(objectIdOf(detail.fulfillment.quotation_id));

    if (!order) {
        return null;
    }

    try {
        return syncOrderStatus(order._id, actorId);
    } catch (err) {
        await markOrderFlowFailed(order._id, 'STATUS_SYNCED', err);
        return {
            order: await ordersRepository.findOrderById(order._id),
            failed: true,
            stage: 'STATUS_SYNCED',
            message: err.message
        };
    }
};

export {
    runConfirmedQuotationFlow,
    retryOrderFlow,
    syncOrderQuantitiesFromFulfillment,
    syncOrderStatus,
    handleShipmentBilling,
    syncOrderForFulfillment
};
