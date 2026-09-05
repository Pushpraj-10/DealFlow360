import mongoose from 'mongoose';

import {ApiError} from '../../core/utils/apiError.js';
import {ApiResponse} from '../../core/utils/apiResponse.js';
import {asyncHandler} from '../../core/utils/asyncHandler.js';
import {Category} from './category.model.js';

const isBlank = (value) => typeof value !== 'string' || value.trim().length === 0;

const parseDiscountPercent = (value) => {
    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
        throw new ApiError(400, 'Maximum allowed discount percentage must be between 0 and 100');
    }

    return parsed;
};

const validateCategoryId = (categoryId) => {
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        throw new ApiError(400, 'Invalid product category id');
    }
};

const listCategories = asyncHandler(async (req, res) => {
    const categories = await Category.find().sort({name: 1});

    return res
    .status(200)
    .json(new ApiResponse(200, {categories}, 'Product categories fetched successfully'));
});

const getCategory = asyncHandler(async (req, res) => {
    validateCategoryId(req.params.categoryId);

    const category = await Category.findById(req.params.categoryId);

    if (!category) {
        throw new ApiError(404, 'Product category not found');
    }

    return res
    .status(200)
    .json(new ApiResponse(200, {category}, 'Product category fetched successfully'));
});

const createCategory = asyncHandler(async (req, res) => {
    const {name, description, maxAllowedDiscountPercent, isActive} = req.body;

    if (isBlank(name)) {
        throw new ApiError(400, 'Product category name is required');
    }

    const existingCategory = await Category.findOne({name: name.trim()});

    if (existingCategory) {
        throw new ApiError(409, 'Product category name already exists');
    }

    const category = await Category.create({
        name,
        description: isBlank(description) ? null : description,
        maxAllowedDiscountPercent: parseDiscountPercent(maxAllowedDiscountPercent),
        isActive: typeof isActive === 'boolean' ? isActive : true
    });

    return res
    .status(201)
    .json(new ApiResponse(201, {category}, 'Product category created successfully'));
});

const updateCategory = asyncHandler(async (req, res) => {
    validateCategoryId(req.params.categoryId);

    const updates = {};

    if (Object.hasOwn(req.body, 'name')) {
        if (isBlank(req.body.name)) {
            throw new ApiError(400, 'Product category name cannot be blank');
        }

        updates.name = req.body.name;
    }

    if (Object.hasOwn(req.body, 'description')) {
        updates.description = isBlank(req.body.description) ? null : req.body.description;
    }

    if (Object.hasOwn(req.body, 'maxAllowedDiscountPercent')) {
        updates.maxAllowedDiscountPercent = parseDiscountPercent(req.body.maxAllowedDiscountPercent);
    }

    if (Object.hasOwn(req.body, 'isActive')) {
        if (typeof req.body.isActive !== 'boolean') {
            throw new ApiError(400, 'isActive must be true or false');
        }

        updates.isActive = req.body.isActive;
    }

    const category = await Category.findByIdAndUpdate(
        req.params.categoryId,
        {$set: updates},
        {new: true, runValidators: true}
    );

    if (!category) {
        throw new ApiError(404, 'Product category not found');
    }

    return res
    .status(200)
    .json(new ApiResponse(200, {category}, 'Product category updated successfully'));
});

const deleteCategory = asyncHandler(async (req, res) => {
    validateCategoryId(req.params.categoryId);

    const category = await Category.findByIdAndUpdate(
        req.params.categoryId,
        {$set: {isActive: false}},
        {new: true}
    );

    if (!category) {
        throw new ApiError(404, 'Product category not found');
    }

    return res
    .status(200)
    .json(new ApiResponse(200, {category}, 'Product category deactivated successfully'));
});

export {
    listCategories,
    getCategory,
    createCategory,
    updateCategory,
    deleteCategory
};
