import { Warehouse } from './warehouse.model.js';

const findAll = (filter = {}) => Warehouse.find(filter).sort({ name: 1 });

const findById = (id) => Warehouse.findById(id);

const create = (data) => Warehouse.create(data);

const updateById = (id, data) =>
    Warehouse.findByIdAndUpdate(id, data, { new: true, runValidators: true });

export { findAll, findById, create, updateById };
