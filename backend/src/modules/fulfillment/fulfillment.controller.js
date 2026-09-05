import { asyncHandler } from '../../core/utils/asyncHandler.js';
import { ApiResponse } from '../../core/utils/apiResponse.js';
import * as fulfillmentService from './fulfillment.service.js';

const listFulfillments = asyncHandler(async (req, res) => {
    const fulfillments = await fulfillmentService.listFulfillments(req.query);
    return res.status(200).json(new ApiResponse(200, fulfillments));
});

const getFulfillment = asyncHandler(async (req, res) => {
    const detail = await fulfillmentService.getFulfillmentDetail(req.params.id);
    return res.status(200).json(new ApiResponse(200, detail));
});

const createFulfillment = asyncHandler(async (req, res) => {
    const fulfillment = await fulfillmentService.createOrGetFulfillment(req.body, req.user.id);
    return res.status(201).json(new ApiResponse(201, fulfillment, 'Fulfillment created'));
});

const suggestSplit = asyncHandler(async (req, res) => {
    const detail = await fulfillmentService.suggestSplit(req.params.id, req.user.id);
    return res.status(200).json(new ApiResponse(200, detail, 'Split suggested'));
});

const acceptSplit = asyncHandler(async (req, res) => {
    const detail = await fulfillmentService.acceptSplit(req.params.id, req.user.id);
    return res.status(200).json(new ApiResponse(200, detail, 'Split accepted and reserved'));
});

const overrideSplit = asyncHandler(async (req, res) => {
    const detail = await fulfillmentService.overrideSplit(req.params.id, req.body, req.user.id);
    return res.status(200).json(new ApiResponse(200, detail, 'Split overridden'));
});

const recordShipment = asyncHandler(async (req, res) => {
    const detail = await fulfillmentService.recordShipment(req.params.id, req.body, req.user.id);
    return res.status(200).json(new ApiResponse(200, detail, 'Shipment recorded'));
});

const listBackorders = asyncHandler(async (req, res) => {
    const backorders = await fulfillmentService.listBackorders(req.query);
    return res.status(200).json(new ApiResponse(200, backorders));
});

const consolidateBackorder = asyncHandler(async (req, res) => {
    const result = await fulfillmentService.consolidateBackorder(req.params.id, req.user.id);
    return res.status(200).json(new ApiResponse(200, result, 'Backorder consolidation attempted'));
});

export {
    listFulfillments,
    getFulfillment,
    createFulfillment,
    suggestSplit,
    acceptSplit,
    overrideSplit,
    recordShipment,
    listBackorders,
    consolidateBackorder,
};
