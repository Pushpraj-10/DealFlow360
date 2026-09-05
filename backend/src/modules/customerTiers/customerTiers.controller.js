import mongoose from 'mongoose';

import {ApiError} from '../../core/utils/apiError.js';
import {ApiResponse} from '../../core/utils/apiResponse.js';
import {asyncHandler} from '../../core/utils/asyncHandler.js';
import {CustomerTier} from './customerTier.model.js';

const isBlank = (value) => typeof value !== 'string' || value.trim().length === 0;

const parseDiscountPercent = (value) => {
    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
        throw new ApiError(400, 'Default maximum discount percentage must be between 0 and 100');
    }

    return parsed;
};

const validateTierId = (tierId) => {
    if (!mongoose.Types.ObjectId.isValid(tierId)) {
        throw new ApiError(400, 'Invalid customer tier id');
    }
};

const listCustomerTiers = asyncHandler(async (req, res) => {
    const tiers = await CustomerTier.find().sort({defaultMaxDiscountPercent: 1, name: 1});

    return res
    .status(200)
    .json(new ApiResponse(200, {tiers}, 'Customer tiers fetched successfully'));
});

const getCustomerTier = asyncHandler(async (req, res) => {
    validateTierId(req.params.tierId);

    const tier = await CustomerTier.findById(req.params.tierId);

    if (!tier) {
        throw new ApiError(404, 'Customer tier not found');
    }

    return res
    .status(200)
    .json(new ApiResponse(200, {tier}, 'Customer tier fetched successfully'));
});

const createCustomerTier = asyncHandler(async (req, res) => {
    const {name, defaultMaxDiscountPercent, description, isActive} = req.body;

    if (isBlank(name)) {
        throw new ApiError(400, 'Customer tier name is required');
    }

    const existingTier = await CustomerTier.findOne({name: name.trim()});

    if (existingTier) {
        throw new ApiError(409, 'Customer tier name already exists');
    }

    const tier = await CustomerTier.create({
        name,
        defaultMaxDiscountPercent: parseDiscountPercent(defaultMaxDiscountPercent),
        description: isBlank(description) ? null : description,
        isActive: typeof isActive === 'boolean' ? isActive : true
    });

    return res
    .status(201)
    .json(new ApiResponse(201, {tier}, 'Customer tier created successfully'));
});

const updateCustomerTier = asyncHandler(async (req, res) => {
    validateTierId(req.params.tierId);

    const updates = {};

    if (Object.hasOwn(req.body, 'name')) {
        if (isBlank(req.body.name)) {
            throw new ApiError(400, 'Customer tier name cannot be blank');
        }

        updates.name = req.body.name;
    }

    if (Object.hasOwn(req.body, 'defaultMaxDiscountPercent')) {
        updates.defaultMaxDiscountPercent = parseDiscountPercent(req.body.defaultMaxDiscountPercent);
    }

    if (Object.hasOwn(req.body, 'description')) {
        updates.description = isBlank(req.body.description) ? null : req.body.description;
    }

    if (Object.hasOwn(req.body, 'isActive')) {
        if (typeof req.body.isActive !== 'boolean') {
            throw new ApiError(400, 'isActive must be true or false');
        }

        updates.isActive = req.body.isActive;
    }

    const tier = await CustomerTier.findByIdAndUpdate(
        req.params.tierId,
        {$set: updates},
        {new: true, runValidators: true}
    );

    if (!tier) {
        throw new ApiError(404, 'Customer tier not found');
    }

    return res
    .status(200)
    .json(new ApiResponse(200, {tier}, 'Customer tier updated successfully'));
});

const deleteCustomerTier = asyncHandler(async (req, res) => {
    validateTierId(req.params.tierId);

    const tier = await CustomerTier.findByIdAndUpdate(
        req.params.tierId,
        {$set: {isActive: false}},
        {new: true}
    );

    if (!tier) {
        throw new ApiError(404, 'Customer tier not found');
    }

    return res
    .status(200)
    .json(new ApiResponse(200, {tier}, 'Customer tier deactivated successfully'));
});

export {
    listCustomerTiers,
    getCustomerTier,
    createCustomerTier,
    updateCustomerTier,
    deleteCustomerTier
};
