import { Inventory } from './inventory.model.js';

const findAll = (filter = {}) => Inventory.find(filter).populate('warehouse_id', 'name active');

const findById = (id) => Inventory.findById(id);

const findByWarehouseAndSku = (warehouseId, sku, session) => {
    const query = Inventory.findOne({ warehouse_id: warehouseId, sku: sku.toUpperCase() });
    return session ? query.session(session) : query;
};

const findBySku = (sku, session) => {
    const query = Inventory.find({ sku: sku.toUpperCase() }).populate('warehouse_id');
    return session ? query.session(session) : query;
};

const updateById = (id, data) =>
    Inventory.findByIdAndUpdate(id, data, { new: true, runValidators: true });

const incrementReserved = (id, delta, session) =>
    Inventory.findByIdAndUpdate(id, { $inc: { reserved: delta } }, { new: true, session });

export { findAll, findById, findByWarehouseAndSku, findBySku, updateById, incrementReserved };
