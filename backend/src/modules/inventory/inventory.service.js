import { ApiError } from '../../core/utils/apiError.js';
import { ErrorCodes } from '../../core/utils/errorCodes.js';
import * as inventoryRepository from './inventory.repository.js';

const listInventory = ({ warehouse_id, sku } = {}) => {
    const filter = {};
    if (warehouse_id) filter.warehouse_id = warehouse_id;
    if (sku) filter.sku = sku.toUpperCase();
    return inventoryRepository.findAll(filter);
};

const getAvailability = async (sku) => {
    if (!sku) {
        throw new ApiError(400, 'sku query param is required', [], '', ErrorCodes.VALIDATION_ERROR);
    }

    const rows = await inventoryRepository.findBySku(sku);

    return rows.map((row) => ({
        warehouse_id: row.warehouse_id?._id,
        warehouse_name: row.warehouse_id?.name,
        sku: row.sku,
        on_hand: row.on_hand,
        reserved: row.reserved,
        available: row.on_hand - row.reserved,
    }));
};

const updateInventory = async (id, data) => {
    const inventory = await inventoryRepository.updateById(id, data);
    if (!inventory) {
        throw new ApiError(404, 'Inventory row not found', [], '', ErrorCodes.NOT_FOUND);
    }
    return inventory;
};

export { listInventory, getAvailability, updateInventory };
