import mongoose from 'mongoose';
import { ApiError } from '../../core/utils/apiError.js';
import { ErrorCodes } from '../../core/utils/errorCodes.js';
import { logAction } from '../_shared/audit-log/audit-log.service.js';
import { Fulfillment } from './fulfillment.model.js';
import { FulfillmentAllocation } from './fulfillment-allocation.model.js';
import { Backorder } from './backorder.model.js';
import * as fulfillmentRepository from './fulfillment.repository.js';

const getFulfillmentOrThrow = async (id) => {
    const fulfillment = await fulfillmentRepository.findFulfillmentById(id);
    if (!fulfillment) {
        throw new ApiError(404, 'Fulfillment not found', [], '', ErrorCodes.NOT_FOUND);
    }
    return fulfillment;
};

const listFulfillments = ({ status } = {}) => {
    const filter = {};
    if (status) filter.status = status;
    return fulfillmentRepository.findFulfillments(filter);
};

const getFulfillmentDetail = async (id) => {
    const fulfillment = await getFulfillmentOrThrow(id);
    const allocations = await fulfillmentRepository.findAllocationsByFulfillmentId(id);
    const backorders = await fulfillmentRepository.findBackordersByFulfillmentId(id);
    return { fulfillment, allocations, backorders };
};

const createOrGetFulfillment = async ({ quotation_id }, actorId) => {
    if (!quotation_id) {
        throw new ApiError(400, 'quotation_id is required', [], '', ErrorCodes.VALIDATION_ERROR);
    }

    let fulfillment = await fulfillmentRepository.findFulfillmentByQuotationId(quotation_id);
    if (fulfillment) return fulfillment;

    fulfillment = await fulfillmentRepository.createFulfillment({ quotation_id });

    await logAction({
        actorId,
        action: 'FULFILLMENT_CREATED',
        entityType: 'Fulfillment',
        entityId: fulfillment._id,
    });

    return fulfillment;
};

const objectIdOf = (value) => value?._id || value;

const syncOrderForFulfillmentIfPresent = async (fulfillmentId, actorId) => {
    try {
        const {syncOrderForFulfillment} = await import('../orders/orderFlowOrchestrator.service.js');
        return syncOrderForFulfillment({fulfillmentId, actorId});
    } catch {
        return null;
    }
};

const billShipmentForOrderIfPresent = async (fulfillmentId, allocationId, actorId) => {
    try {
        const {handleShipmentBilling} = await import('../orders/orderFlowOrchestrator.service.js');
        return handleShipmentBilling({fulfillmentId, allocationId, actor: actorId});
    } catch {
        return null;
    }
};

/**
 * Recomputes and persists the overall Fulfillment.status from the current
 * allocation/backorder rows. Shared by accept/override/ship/consolidate so
 * the state machine (NOT_READY -> SPLIT_PROPOSED -> RESERVED ->
 * PARTIALLY_SHIPPED -> SHIPPED, branching to BACKORDER/PARTIAL_BACKORDER)
 * stays consistent no matter which action last touched the fulfillment.
 */
const recomputeFulfillmentStatus = async (fulfillmentId, session) => {
    const allocations = await FulfillmentAllocation.find({ fulfillment_id: fulfillmentId }).session(session);
    const backorders = await Backorder.find({ fulfillment_id: fulfillmentId }).session(session);
    const openBackorderQty = backorders
        .filter((b) => b.status !== 'RESOLVED')
        .reduce((sum, b) => sum + b.qty, 0);

    let status;
    if (allocations.length === 0) {
        status = openBackorderQty > 0 ? 'BACKORDER' : 'NOT_READY';
    } else if (allocations.every((a) => a.status === 'SHIPPED') && openBackorderQty === 0) {
        status = 'SHIPPED';
    } else if (allocations.some((a) => a.shipped_qty > 0)) {
        status = 'PARTIALLY_SHIPPED';
    } else if (allocations.every((a) => ['RESERVED', 'PARTIALLY_SHIPPED', 'SHIPPED'].includes(a.status))) {
        status = openBackorderQty > 0 ? 'PARTIAL_BACKORDER' : 'RESERVED';
    } else {
        status = 'SPLIT_PROPOSED';
    }

    await Fulfillment.findByIdAndUpdate(fulfillmentId, { status }, { session });
    return status;
};

/**
 * Warehouse split recommendation - PRD section 8.7.
 * Only stock-managed physical lines participate; services/subscriptions
 * bypass warehouse allocation entirely.
 */
const buildSplitPlan = async (quotationId) => {
    const lines = await fulfillmentRepository.findQuoteLinesByQuotationId(quotationId);
    // RECURRING lines bypass warehouse allocation regardless of the product's
    // isStockManaged flag; ONE_TIME lines participate only when the product
    // is a physical, stock-managed good.
    const stockLines = lines.filter(
        (line) => line.lineType !== 'RECURRING' && line.productId?.isStockManaged
    );

    if (stockLines.length === 0) {
        return { requirements: [], warehouses: [], allocations: [], backorders: [] };
    }

    for (const line of stockLines) {
        if (!line.variantId?.sku) {
            throw new ApiError(
                400,
                `Quotation line ${line._id} is stock-managed but has no product variant/SKU`,
                [],
                '',
                ErrorCodes.VALIDATION_ERROR
            );
        }
    }

    const requirements = stockLines.map((line) => ({
        quote_line_id: line._id,
        sku: line.variantId.sku,
        qty: line.quantity,
    }));

    const warehouses = await fulfillmentRepository.findActiveWarehouses();
    if (warehouses.length === 0) {
        throw new ApiError(409, 'No active warehouses configured', [], '', ErrorCodes.INSUFFICIENT_STOCK);
    }

    const skus = [...new Set(requirements.map((r) => r.sku))];
    const inventoryRows = await fulfillmentRepository.findInventoryForSkus(skus);

    // available[warehouseId][sku] = on_hand - reserved
    const available = {};
    for (const w of warehouses) available[w._id.toString()] = {};
    for (const row of inventoryRows) {
        const wId = row.warehouse_id.toString();
        if (!available[wId]) continue;
        available[wId][row.sku] = row.on_hand - row.reserved;
    }

    const fulfilledQtyForSubset = (subsetIds) =>
        requirements.reduce((total, req) => {
            const totalAvailable = subsetIds.reduce(
                (sum, wId) => sum + (available[wId]?.[req.sku] || 0),
                0
            );
            return total + Math.min(req.qty, totalAvailable);
        }, 0);

    // 1. Single warehouse that satisfies every required line.
    const singleCandidates = warehouses.filter((w) =>
        requirements.every((req) => (available[w._id.toString()]?.[req.sku] || 0) >= req.qty)
    );

    let chosenWarehouses;
    if (singleCandidates.length > 0) {
        singleCandidates.sort((a, b) => a.shipping_cost_weight - b.shipping_cost_weight);
        chosenWarehouses = [singleCandidates[0]];
    } else {
        // 2. Bitmask enumeration over warehouse subsets (small demo counts).
        const n = warehouses.length;
        const allIds = warehouses.map((w) => w._id.toString());
        const maxPossible = fulfilledQtyForSubset(allIds);

        let best = null; // { ids, size, totalWeight }
        for (let mask = 1; mask < 1 << n; mask += 1) {
            const subsetWarehouses = [];
            for (let i = 0; i < n; i += 1) {
                if (mask & (1 << i)) subsetWarehouses.push(warehouses[i]);
            }
            const subsetIds = subsetWarehouses.map((w) => w._id.toString());
            const fulfilled = fulfilledQtyForSubset(subsetIds);
            if (fulfilled !== maxPossible) continue;

            const size = subsetWarehouses.length;
            const totalWeight = subsetWarehouses.reduce((s, w) => s + w.shipping_cost_weight, 0);

            if (
                !best ||
                size < best.size ||
                (size === best.size && totalWeight < best.totalWeight)
            ) {
                best = { warehouses: subsetWarehouses, size, totalWeight };
            }
        }

        chosenWarehouses = best ? best.warehouses : [];
    }

    chosenWarehouses = [...chosenWarehouses].sort(
        (a, b) => a.shipping_cost_weight - b.shipping_cost_weight
    );

    // 3. Greedily allocate each line across chosen warehouses, cheapest first.
    const allocations = [];
    const backorders = [];

    for (const req of requirements) {
        let remaining = req.qty;
        for (const warehouse of chosenWarehouses) {
            if (remaining <= 0) break;
            const wId = warehouse._id.toString();
            const availableQty = available[wId]?.[req.sku] || 0;
            if (availableQty <= 0) continue;

            const take = Math.min(remaining, availableQty);
            allocations.push({
                quote_line_id: req.quote_line_id,
                warehouse_id: warehouse._id,
                allocated_qty: take,
                est_cost: take * warehouse.shipping_cost_weight,
            });

            available[wId][req.sku] -= take;
            remaining -= take;
        }

        if (remaining > 0) {
            backorders.push({ quote_line_id: req.quote_line_id, qty: remaining });
        }
    }

    return { requirements, warehouses: chosenWarehouses, allocations, backorders };
};

const suggestSplit = async (fulfillmentId, actorId) => {
    const fulfillment = await getFulfillmentOrThrow(fulfillmentId);

    if (['RESERVED', 'PARTIALLY_SHIPPED', 'SHIPPED'].includes(fulfillment.status)) {
        throw new ApiError(
            409,
            'Fulfillment already reserved/shipped; cannot re-suggest a split',
            [],
            '',
            ErrorCodes.VALIDATION_ERROR
        );
    }

    const plan = await buildSplitPlan(objectIdOf(fulfillment.quotation_id));

    // Idempotent recompute: clear any previous, not-yet-accepted proposal.
    await fulfillmentRepository.deleteProposedAllocations(fulfillmentId);
    await fulfillmentRepository.deleteOpenBackorders(fulfillmentId);

    const allocationRows = plan.allocations.map((a) => ({ ...a, fulfillment_id: fulfillmentId }));
    const backorderRows = plan.backorders.map((b) => ({ ...b, fulfillment_id: fulfillmentId }));

    if (allocationRows.length > 0) await fulfillmentRepository.createAllocations(allocationRows);
    if (backorderRows.length > 0) await fulfillmentRepository.createBackorders(backorderRows);

    await fulfillmentRepository.updateFulfillmentStatus(fulfillmentId, 'SPLIT_PROPOSED', {
        proposed_at: new Date(),
    });

    await logAction({
        actorId,
        action: 'FULFILLMENT_SUGGESTED',
        entityType: 'Fulfillment',
        entityId: fulfillmentId,
        metadata: { allocations: allocationRows.length, backorders: backorderRows.length },
    });

    await syncOrderForFulfillmentIfPresent(fulfillmentId, actorId);

    return getFulfillmentDetail(fulfillmentId);
};

const acceptSplit = async (fulfillmentId, actorId) => {
    const fulfillment = await getFulfillmentOrThrow(fulfillmentId);

    if (fulfillment.status !== 'SPLIT_PROPOSED') {
        throw new ApiError(
            409,
            'Fulfillment must have a proposed split before it can be accepted',
            [],
            '',
            ErrorCodes.VALIDATION_ERROR
        );
    }

    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            const allocations = await fulfillmentRepository.findAllocationsByFulfillmentId(
                fulfillmentId,
                session
            );

            for (const allocation of allocations) {
                const sku = allocation.quote_line_id.variantId.sku;
                const inventory = await fulfillmentRepository.findInventoryRow(
                    allocation.warehouse_id,
                    sku,
                    session
                );

                const availableQty = inventory ? inventory.on_hand - inventory.reserved : 0;
                if (availableQty < allocation.allocated_qty) {
                    throw new ApiError(
                        409,
                        `Insufficient stock for SKU ${sku} at the proposed warehouse`,
                        [],
                        '',
                        ErrorCodes.INSUFFICIENT_STOCK
                    );
                }

                await fulfillmentRepository.incrementReserved(
                    inventory._id,
                    allocation.allocated_qty,
                    session
                );
                await fulfillmentRepository.updateAllocation(
                    allocation._id,
                    { status: 'RESERVED' },
                    session
                );
            }

            await Fulfillment.findByIdAndUpdate(fulfillmentId, { accepted_at: new Date() }, { session });
            await recomputeFulfillmentStatus(fulfillmentId, session);

            await logAction({
                actorId,
                action: 'FULFILLMENT_ACCEPTED',
                entityType: 'Fulfillment',
                entityId: fulfillmentId,
                session,
            });
        });
    } finally {
        await session.endSession();
    }

    await syncOrderForFulfillmentIfPresent(fulfillmentId, actorId);

    return getFulfillmentDetail(fulfillmentId);
};

const overrideSplit = async (fulfillmentId, { allocations: requested, reason }, actorId) => {
    if (!reason || !reason.trim()) {
        throw new ApiError(400, 'reason is required for a manual override', [], '', ErrorCodes.VALIDATION_ERROR);
    }
    if (!Array.isArray(requested) || requested.length === 0) {
        throw new ApiError(400, 'allocations array is required', [], '', ErrorCodes.VALIDATION_ERROR);
    }

    const fulfillment = await getFulfillmentOrThrow(fulfillmentId);
    if (['PARTIALLY_SHIPPED', 'SHIPPED'].includes(fulfillment.status)) {
        throw new ApiError(
            409,
            'Cannot override a fulfillment that has already shipped',
            [],
            '',
            ErrorCodes.VALIDATION_ERROR
        );
    }

    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            await fulfillmentRepository.deleteAllAllocations(fulfillmentId, session);
            await fulfillmentRepository.deleteOpenBackorders(fulfillmentId);

            const allocatedByLine = new Map();

            for (const item of requested) {
                const quoteLine = await fulfillmentRepository.findQuoteLineById(item.quote_line_id);
                if (!quoteLine) {
                    throw new ApiError(404, 'Quote line not found', [], '', ErrorCodes.NOT_FOUND);
                }

                if (!quoteLine.variantId?.sku) {
                    throw new ApiError(
                        400,
                        `Quote line ${item.quote_line_id} has no product variant/SKU`,
                        [],
                        '',
                        ErrorCodes.VALIDATION_ERROR
                    );
                }
                const sku = quoteLine.variantId.sku;
                const inventory = await fulfillmentRepository.findInventoryRow(
                    item.warehouse_id,
                    sku,
                    session
                );
                const availableQty = inventory ? inventory.on_hand - inventory.reserved : 0;

                // Excess beyond available stock is rejected for that warehouse;
                // the caller only gets what is actually available.
                const grantedQty = Math.min(item.qty, availableQty);
                if (grantedQty <= 0) continue;

                await fulfillmentRepository.incrementReserved(inventory._id, grantedQty, session);
                await FulfillmentAllocation.create(
                    [
                        {
                            fulfillment_id: fulfillmentId,
                            quote_line_id: item.quote_line_id,
                            warehouse_id: item.warehouse_id,
                            allocated_qty: grantedQty,
                            est_cost: 0,
                            status: 'RESERVED',
                        },
                    ],
                    { session }
                );

                allocatedByLine.set(
                    item.quote_line_id.toString(),
                    (allocatedByLine.get(item.quote_line_id.toString()) || 0) + grantedQty
                );
            }

            // Any requested line quantity not fully covered becomes a backorder.
            const linesTouched = [...new Set(requested.map((r) => r.quote_line_id.toString()))];
            for (const lineId of linesTouched) {
                const quoteLine = await fulfillmentRepository.findQuoteLineById(lineId);
                const allocatedQty = allocatedByLine.get(lineId) || 0;
                const remainder = quoteLine.quantity - allocatedQty;
                if (remainder > 0) {
                    await Backorder.create(
                        [{ fulfillment_id: fulfillmentId, quote_line_id: lineId, qty: remainder }],
                        { session }
                    );
                }
            }

            await recomputeFulfillmentStatus(fulfillmentId, session);

            await logAction({
                actorId,
                action: 'FULFILLMENT_OVERRIDDEN',
                entityType: 'Fulfillment',
                entityId: fulfillmentId,
                reason,
                session,
            });
        });
    } finally {
        await session.endSession();
    }

    await syncOrderForFulfillmentIfPresent(fulfillmentId, actorId);

    return getFulfillmentDetail(fulfillmentId);
};

const recordShipment = async (fulfillmentId, { allocation_id, qty }, actorId) => {
    if (!allocation_id || !qty || qty <= 0) {
        throw new ApiError(400, 'allocation_id and a positive qty are required', [], '', ErrorCodes.VALIDATION_ERROR);
    }

    const allocation = await fulfillmentRepository.findAllocationById(allocation_id);
    if (!allocation || allocation.fulfillment_id.toString() !== fulfillmentId) {
        throw new ApiError(404, 'Allocation not found for this fulfillment', [], '', ErrorCodes.NOT_FOUND);
    }
    if (!['RESERVED', 'PARTIALLY_SHIPPED'].includes(allocation.status)) {
        throw new ApiError(
            409,
            'Allocation must be reserved before it can be shipped',
            [],
            '',
            ErrorCodes.VALIDATION_ERROR
        );
    }

    const newShippedQty = allocation.shipped_qty + qty;
    if (newShippedQty > allocation.allocated_qty) {
        throw new ApiError(
            400,
            'Shipped quantity cannot exceed allocated quantity',
            [],
            '',
            ErrorCodes.INVALID_SHIPMENT_QTY
        );
    }

    await fulfillmentRepository.updateAllocation(allocation_id, {
        shipped_qty: newShippedQty,
        status: newShippedQty === allocation.allocated_qty ? 'SHIPPED' : 'PARTIALLY_SHIPPED',
    });

    await recomputeFulfillmentStatus(fulfillmentId);

    await logAction({
        actorId,
        action: 'SHIPMENT_RECORDED',
        entityType: 'FulfillmentAllocation',
        entityId: allocation_id,
        metadata: { qty, newShippedQty },
    });

    await billShipmentForOrderIfPresent(fulfillmentId, allocation_id, actorId);

    return getFulfillmentDetail(fulfillmentId);
};

const listBackorders = ({ status, fulfillment_id } = {}) => {
    const filter = {};
    if (status) filter.status = status;
    if (fulfillment_id) filter.fulfillment_id = fulfillment_id;
    return fulfillmentRepository.findBackorders(filter);
};

const consolidateBackorder = async (backorderId, actorId) => {
    const session = await mongoose.startSession();
    let result;

    try {
        await session.withTransaction(async () => {
            const backorder = await fulfillmentRepository.findBackorderById(backorderId, session);
            if (!backorder) {
                throw new ApiError(404, 'Backorder not found', [], '', ErrorCodes.NOT_FOUND);
            }
            if (backorder.status === 'RESOLVED') {
                throw new ApiError(409, 'Backorder is already resolved', [], '', ErrorCodes.VALIDATION_ERROR);
            }

            const quoteLine = await fulfillmentRepository.findQuoteLineById(backorder.quote_line_id);
            const sku = quoteLine.variantId.sku;
            const warehouses = await fulfillmentRepository.findActiveWarehouses();

            let remaining = backorder.qty;
            for (const warehouse of warehouses) {
                if (remaining <= 0) break;

                const inventory = await fulfillmentRepository.findInventoryRow(warehouse._id, sku, session);
                const availableQty = inventory ? inventory.on_hand - inventory.reserved : 0;
                if (availableQty <= 0) continue;

                const take = Math.min(remaining, availableQty);
                await fulfillmentRepository.incrementReserved(inventory._id, take, session);
                await FulfillmentAllocation.create(
                    [
                        {
                            fulfillment_id: backorder.fulfillment_id,
                            quote_line_id: backorder.quote_line_id,
                            warehouse_id: warehouse._id,
                            allocated_qty: take,
                            est_cost: take * warehouse.shipping_cost_weight,
                            status: 'RESERVED',
                        },
                    ],
                    { session }
                );

                remaining -= take;
            }

            const resolvedQty = backorder.qty - remaining;
            await fulfillmentRepository.updateBackorder(
                backorderId,
                {
                    qty: remaining,
                    status: remaining === 0 ? 'RESOLVED' : 'PARTIALLY_RESOLVED',
                    resolved_at: remaining === 0 ? new Date() : null,
                },
                session
            );

            await recomputeFulfillmentStatus(backorder.fulfillment_id, session);

            await logAction({
                actorId,
                action: 'BACKORDER_CONSOLIDATED',
                entityType: 'Backorder',
                entityId: backorderId,
                metadata: { resolvedQty, remaining },
                session,
            });

            result = { resolvedQty, remainingQty: remaining };
        });
    } finally {
        await session.endSession();
    }

    if (result) {
        const backorder = await fulfillmentRepository.findBackorderById(backorderId);
        if (backorder) {
            await syncOrderForFulfillmentIfPresent(backorder.fulfillment_id, actorId);
        }
    }

    return result;
};

export {
    listFulfillments,
    getFulfillmentDetail,
    createOrGetFulfillment,
    suggestSplit,
    acceptSplit,
    overrideSplit,
    recordShipment,
    listBackorders,
    consolidateBackorder,
};
