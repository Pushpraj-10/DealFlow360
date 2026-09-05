import { asyncHandler } from '../../core/utils/asyncHandler.js';
import { ApiResponse } from '../../core/utils/apiResponse.js';
import * as subscriptionService from './subscription.service.js';

const listPlans = asyncHandler(async (req, res) => {
    const plans = await subscriptionService.listPlans();
    return res.status(200).json(new ApiResponse(200, plans));
});

const createPlan = asyncHandler(async (req, res) => {
    const plan = await subscriptionService.createPlan(req.body);
    return res.status(201).json(new ApiResponse(201, plan, 'Subscription plan created'));
});

const getPlan = asyncHandler(async (req, res) => {
    const plan = await subscriptionService.getPlanById(req.params.id);
    return res.status(200).json(new ApiResponse(200, plan));
});

const updatePlan = asyncHandler(async (req, res) => {
    const plan = await subscriptionService.updatePlan(req.params.id, req.body);
    return res.status(200).json(new ApiResponse(200, plan, 'Subscription plan updated'));
});

const deletePlan = asyncHandler(async (req, res) => {
    const plan = await subscriptionService.deletePlan(req.params.id);
    return res.status(200).json(new ApiResponse(200, plan, 'Subscription plan deactivated'));
});

const listSubscriptions = asyncHandler(async (req, res) => {
    const subscriptions = await subscriptionService.listSubscriptions(req.query);
    return res.status(200).json(new ApiResponse(200, subscriptions));
});

const getSubscription = asyncHandler(async (req, res) => {
    const subscription = await subscriptionService.getSubscriptionOrThrow(req.params.id);
    return res.status(200).json(new ApiResponse(200, subscription));
});

const createSubscription = asyncHandler(async (req, res) => {
    const subscription = await subscriptionService.createSubscription(req.body, req.user.id);
    return res.status(201).json(new ApiResponse(201, subscription, 'Subscription created'));
});

const modifySubscription = asyncHandler(async (req, res) => {
    const result = await subscriptionService.modifySubscription(req.params.id, req.body, req.user.id);
    return res.status(200).json(new ApiResponse(200, result, 'Subscription modified'));
});

const cancelSubscription = asyncHandler(async (req, res) => {
    const result = await subscriptionService.cancelSubscription(req.params.id, req.body, req.user.id);
    return res.status(200).json(new ApiResponse(200, result, 'Subscription cancelled'));
});

const dryRunProration = asyncHandler(async (req, res) => {
    const { subscriptionId, newQty, newUnitPriceCents } = req.query;
    const result = await subscriptionService.dryRunProration({ subscriptionId, newQty, newUnitPriceCents });
    return res.status(200).json(new ApiResponse(200, result));
});

export {
    listPlans,
    createPlan,
    getPlan,
    updatePlan,
    deletePlan,
    listSubscriptions,
    getSubscription,
    createSubscription,
    modifySubscription,
    cancelSubscription,
    dryRunProration,
};
