import { ApiError } from '../../core/utils/apiError.js';
import { ErrorCodes } from '../../core/utils/errorCodes.js';
import * as warehouseRepository from './warehouse.repository.js';

const listWarehouses = ({ active } = {}) => {
    const filter = {};
    if (active !== undefined) filter.active = active === 'true' || active === true;
    return warehouseRepository.findAll(filter);
};

const createWarehouse = async ({ name, shipping_cost_weight, active }) => {
    if (!name || !name.trim()) {
        throw new ApiError(400, 'name is required', [], '', ErrorCodes.VALIDATION_ERROR);
    }

    return warehouseRepository.create({
        name: name.trim(),
        shipping_cost_weight,
        active,
    });
};

const updateWarehouse = async (id, data) => {
    const warehouse = await warehouseRepository.updateById(id, data);
    if (!warehouse) {
        throw new ApiError(404, 'Warehouse not found', [], '', ErrorCodes.NOT_FOUND);
    }
    return warehouse;
};

export { listWarehouses, createWarehouse, updateWarehouse };
