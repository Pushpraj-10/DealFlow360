import { Fulfillment } from './fulfillment.model.js';
import { FulfillmentAllocation } from './fulfillment-allocation.model.js';
import { Backorder } from './backorder.model.js';
import { QuotationLine } from '../quotationLines/quotationLine.model.js';
import { Warehouse } from '../warehouses/warehouse.model.js';
import { Inventory } from '../inventory/inventory.model.js';

const findFulfillmentById = (id) => Fulfillment.findById(id);

const findFulfillmentByQuotationId = (quotationId) => Fulfillment.findOne({ quotation_id: quotationId });

const findFulfillments = (filter = {}) => Fulfillment.find(filter).sort({ created_at: -1 });

const createFulfillment = (data) => Fulfillment.create(data);

const updateFulfillmentStatus = (id, status, extra = {}, session) =>
    Fulfillment.findByIdAndUpdate(id, { status, ...extra }, { new: true, session });

const findQuoteLinesByQuotationId = (quotationId) =>
    QuotationLine.find({ quotationId }).populate('productId').populate('variantId');

const findQuoteLineById = (id) => QuotationLine.findById(id).populate('productId').populate('variantId');

const findActiveWarehouses = () => Warehouse.find({ active: true }).sort({ shipping_cost_weight: 1 });

const findInventoryForSkus = (skus) => Inventory.find({ sku: { $in: skus.map((s) => s.toUpperCase()) } });

const findInventoryRow = (warehouseId, sku, session) => {
    const query = Inventory.findOne({ warehouse_id: warehouseId, sku: sku.toUpperCase() });
    return session ? query.session(session) : query;
};

const incrementReserved = (inventoryId, delta, session) =>
    Inventory.findByIdAndUpdate(inventoryId, { $inc: { reserved: delta } }, { new: true, session });

const deleteProposedAllocations = (fulfillmentId) =>
    FulfillmentAllocation.deleteMany({ fulfillment_id: fulfillmentId, status: 'PROPOSED' });

const deleteAllAllocations = (fulfillmentId, session) =>
    FulfillmentAllocation.deleteMany({ fulfillment_id: fulfillmentId }, { session });

const deleteOpenBackorders = (fulfillmentId) =>
    Backorder.deleteMany({ fulfillment_id: fulfillmentId, status: { $ne: 'RESOLVED' } });

const createAllocations = (rows, session) => FulfillmentAllocation.insertMany(rows, { session });

const createBackorders = (rows) => Backorder.insertMany(rows);

const findAllocationsByFulfillmentId = (fulfillmentId, session) => {
    const query = FulfillmentAllocation.find({ fulfillment_id: fulfillmentId }).populate({
        path: 'quote_line_id',
        populate: ['productId', 'variantId'],
    });
    return session ? query.session(session) : query;
};

const findAllocationById = (id, session) => {
    const query = FulfillmentAllocation.findById(id).populate({
        path: 'quote_line_id',
        populate: ['productId', 'variantId'],
    });
    return session ? query.session(session) : query;
};

const updateAllocation = (id, data, session) =>
    FulfillmentAllocation.findByIdAndUpdate(id, data, { new: true, session });

const findBackorders = (filter = {}) => Backorder.find(filter).sort({ created_at: -1 });

const findBackorderById = (id, session) => {
    const query = Backorder.findById(id);
    return session ? query.session(session) : query;
};

const updateBackorder = (id, data, session) =>
    Backorder.findByIdAndUpdate(id, data, { new: true, session });

const findBackordersByFulfillmentId = (fulfillmentId, session) => {
    const query = Backorder.find({ fulfillment_id: fulfillmentId });
    return session ? query.session(session) : query;
};

export {
    findFulfillmentById,
    findFulfillmentByQuotationId,
    findFulfillments,
    createFulfillment,
    updateFulfillmentStatus,
    findQuoteLinesByQuotationId,
    findQuoteLineById,
    findActiveWarehouses,
    findInventoryForSkus,
    findInventoryRow,
    incrementReserved,
    deleteProposedAllocations,
    deleteAllAllocations,
    deleteOpenBackorders,
    createAllocations,
    createBackorders,
    findAllocationsByFulfillmentId,
    findAllocationById,
    updateAllocation,
    findBackorders,
    findBackorderById,
    updateBackorder,
    findBackordersByFulfillmentId,
};
