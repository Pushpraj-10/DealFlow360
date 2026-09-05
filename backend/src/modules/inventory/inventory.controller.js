import { asyncHandler } from '../../core/utils/asyncHandler.js';
import { ApiResponse } from '../../core/utils/apiResponse.js';
import * as inventoryService from './inventory.service.js';

const listInventory = asyncHandler(async (req, res) => {
    const inventory = await inventoryService.listInventory(req.query);
    return res.status(200).json(new ApiResponse(200, inventory));
});

const getAvailability = asyncHandler(async (req, res) => {
    const availability = await inventoryService.getAvailability(req.query.sku);
    return res.status(200).json(new ApiResponse(200, availability));
});

const updateInventory = asyncHandler(async (req, res) => {
    const inventory = await inventoryService.updateInventory(req.params.id, req.body);
    return res.status(200).json(new ApiResponse(200, inventory, 'Inventory updated'));
});

export { listInventory, getAvailability, updateInventory };
