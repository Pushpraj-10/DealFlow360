import {ApiResponse} from '../../core/utils/apiResponse.js';
import {asyncHandler} from '../../core/utils/asyncHandler.js';
import {getOrderByQuotation, getOrderDetail, listOrders} from './orders.service.js';
import {retryOrderFlow, syncOrderStatus} from './orderFlowOrchestrator.service.js';

const list = asyncHandler(async (req, res) => {
    const orders = await listOrders(req.query);
    return res.status(200).json(new ApiResponse(200, {orders}, 'Orders fetched successfully'));
});

const getById = asyncHandler(async (req, res) => {
    const detail = await getOrderDetail(req.params.orderId);
    return res.status(200).json(new ApiResponse(200, detail, 'Order fetched successfully'));
});

const getByQuotation = asyncHandler(async (req, res) => {
    const detail = await getOrderByQuotation(req.params.quotationId);
    return res.status(200).json(new ApiResponse(200, detail, 'Order fetched successfully'));
});

const retryFlow = asyncHandler(async (req, res) => {
    const result = await retryOrderFlow({orderId: req.params.orderId, actor: req.user});
    return res.status(200).json(new ApiResponse(200, result, 'Order flow retry completed'));
});

const syncStatus = asyncHandler(async (req, res) => {
    const order = await syncOrderStatus(req.params.orderId, req.user.id);
    return res.status(200).json(new ApiResponse(200, {order}, 'Order status synced successfully'));
});

export {
    list,
    getById,
    getByQuotation,
    retryFlow,
    syncStatus
};
