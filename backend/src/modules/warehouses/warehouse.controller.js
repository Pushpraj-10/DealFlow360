import { asyncHandler } from '../../core/utils/asyncHandler.js';
import { ApiResponse } from '../../core/utils/apiResponse.js';
import * as warehouseService from './warehouse.service.js';

const listWarehouses = asyncHandler(async (req, res) => {
    const warehouses = await warehouseService.listWarehouses(req.query);
    return res.status(200).json(new ApiResponse(200, warehouses));
});

const createWarehouse = asyncHandler(async (req, res) => {
    const warehouse = await warehouseService.createWarehouse(req.body);
    return res.status(201).json(new ApiResponse(201, warehouse, 'Warehouse created'));
});

const updateWarehouse = asyncHandler(async (req, res) => {
    const warehouse = await warehouseService.updateWarehouse(req.params.id, req.body);
    return res.status(200).json(new ApiResponse(200, warehouse, 'Warehouse updated'));
});

export { listWarehouses, createWarehouse, updateWarehouse };
