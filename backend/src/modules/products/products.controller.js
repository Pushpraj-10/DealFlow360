import mongoose from 'mongoose';

import {PRODUCT_BILLING_TYPES, PRODUCT_STATUSES} from '../../core/constants.js';
import {ApiError} from '../../core/utils/apiError.js';
import {ApiResponse} from '../../core/utils/apiResponse.js';
import {asyncHandler} from '../../core/utils/asyncHandler.js';
import {Category} from '../categories/category.model.js';
import {Product} from './product.model.js';

const isBlank = (value) => typeof value !== 'string' || value.trim().length === 0;

const validateProductId = (productId) => {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
        throw new ApiError(400, 'Invalid product id');
    }
};

const parseBoundedNumber = (value, fieldName, min = 0, max = Number.POSITIVE_INFINITY) => {
    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
        throw new ApiError(400, `${fieldName} must be between ${min} and ${max}`);
    }

    return parsed;
};

const validateCategory = async (categoryId) => {
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        throw new ApiError(400, 'Invalid product category id');
    }

    const category = await Category.findOne({_id: categoryId, isActive: true});

    if (!category) {
        throw new ApiError(400, 'Active product category not found');
    }
};

const buildProductPayload = async (body, {partial = false} = {}) => {
    const payload = {};
    const requiredFields = [
        'name',
        'categoryId',
        'productType',
        'billingType',
        'basePrice',
        'costPrice',
        'taxPercentage',
        'unit'
    ];

    if (!partial) {
        const missingField = requiredFields.find((field) => body[field] === undefined || body[field] === null || body[field] === '');

        if (missingField) {
            throw new ApiError(400, `${missingField} is required`);
        }
    }

    if (Object.hasOwn(body, 'name')) {
        if (isBlank(body.name)) {
            throw new ApiError(400, 'Product name cannot be blank');
        }

        payload.name = body.name;
    }

    if (Object.hasOwn(body, 'description')) {
        payload.description = isBlank(body.description) ? null : body.description;
    }

    if (Object.hasOwn(body, 'categoryId')) {
        await validateCategory(body.categoryId);
        payload.categoryId = body.categoryId;
    }

    if (Object.hasOwn(body, 'productType')) {
        if (isBlank(body.productType)) {
            throw new ApiError(400, 'Product type cannot be blank');
        }

        payload.productType = body.productType;
    }

    if (Object.hasOwn(body, 'billingType')) {
        if (!Object.values(PRODUCT_BILLING_TYPES).includes(body.billingType)) {
            throw new ApiError(400, 'billingType must be ONE_TIME or RECURRING');
        }

        payload.billingType = body.billingType;
    }

    if (Object.hasOwn(body, 'basePrice')) {
        payload.basePrice = parseBoundedNumber(body.basePrice, 'Base price');
    }

    if (Object.hasOwn(body, 'costPrice')) {
        payload.costPrice = parseBoundedNumber(body.costPrice, 'Cost price');
    }

    if (Object.hasOwn(body, 'taxPercentage')) {
        payload.taxPercentage = parseBoundedNumber(body.taxPercentage, 'Tax percentage', 0, 100);
    }

    if (Object.hasOwn(body, 'unit')) {
        if (isBlank(body.unit)) {
            throw new ApiError(400, 'Unit cannot be blank');
        }

        payload.unit = body.unit;
    }

    if (Object.hasOwn(body, 'isActive')) {
        if (typeof body.isActive !== 'boolean') {
            throw new ApiError(400, 'isActive must be true or false');
        }

        payload.isActive = body.isActive;
    }

    if (Object.hasOwn(body, 'status')) {
        if (!Object.values(PRODUCT_STATUSES).includes(body.status)) {
            throw new ApiError(400, 'Invalid product status');
        }

        payload.status = body.status;
        payload.isActive = body.status === PRODUCT_STATUSES.ACTIVE;
    }

    return payload;
};

const listProducts = asyncHandler(async (req, res) => {
    const products = await Product.find()
    .populate('categoryId', 'name maxAllowedDiscountPercent')
    .sort({name: 1});

    return res
    .status(200)
    .json(new ApiResponse(200, {products}, 'Products fetched successfully'));
});

const getProduct = asyncHandler(async (req, res) => {
    validateProductId(req.params.productId);

    const product = await Product.findById(req.params.productId)
    .populate('categoryId', 'name maxAllowedDiscountPercent');

    if (!product) {
        throw new ApiError(404, 'Product not found');
    }

    return res
    .status(200)
    .json(new ApiResponse(200, {product}, 'Product fetched successfully'));
});

const createProduct = asyncHandler(async (req, res) => {
    const payload = await buildProductPayload(req.body);

    const existingProduct = await Product.findOne({
        name: payload.name.trim(),
        categoryId: payload.categoryId
    });

    if (existingProduct) {
        throw new ApiError(409, 'Product already exists in this category');
    }

    const product = await Product.create(payload);
    const populatedProduct = await Product.findById(product._id)
    .populate('categoryId', 'name maxAllowedDiscountPercent');

    return res
    .status(201)
    .json(new ApiResponse(201, {product: populatedProduct}, 'Product created successfully'));
});

const updateProduct = asyncHandler(async (req, res) => {
    validateProductId(req.params.productId);

    const payload = await buildProductPayload(req.body, {partial: true});

    const product = await Product.findByIdAndUpdate(
        req.params.productId,
        {$set: payload},
        {new: true, runValidators: true}
    ).populate('categoryId', 'name maxAllowedDiscountPercent');

    if (!product) {
        throw new ApiError(404, 'Product not found');
    }

    return res
    .status(200)
    .json(new ApiResponse(200, {product}, 'Product updated successfully'));
});

const deleteProduct = asyncHandler(async (req, res) => {
    validateProductId(req.params.productId);

    const product = await Product.findByIdAndUpdate(
        req.params.productId,
        {$set: {status: PRODUCT_STATUSES.ARCHIVED, isActive: false}},
        {new: true}
    ).populate('categoryId', 'name maxAllowedDiscountPercent');

    if (!product) {
        throw new ApiError(404, 'Product not found');
    }

    return res
    .status(200)
    .json(new ApiResponse(200, {product}, 'Product archived successfully'));
});

export {
    listProducts,
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct
};
