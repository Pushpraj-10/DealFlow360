import mongoose from 'mongoose';

import {ApiError} from '../../core/utils/apiError.js';
import {ApiResponse} from '../../core/utils/apiResponse.js';
import {asyncHandler} from '../../core/utils/asyncHandler.js';
import {Product} from './product.model.js';
import {ProductVariant} from './productVariant.model.js';

const isBlank = (value) => typeof value !== 'string' || value.trim().length === 0;

const validateObjectId = (value, label) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new ApiError(400, `Invalid ${label}`);
    }
};

const parseExtraPrice = (value) => {
    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed < 0) {
        throw new ApiError(400, 'Extra price must be a non-negative number');
    }

    return parsed;
};

const normalizeAttributes = (attributes) => {
    if (attributes === undefined) {
        return undefined;
    }

    if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) {
        throw new ApiError(400, 'Attributes must be an object');
    }

    return Object.entries(attributes).reduce((normalized, [key, value]) => {
        if (isBlank(key) || value === undefined || value === null || String(value).trim() === '') {
            return normalized;
        }

        normalized[key.trim()] = String(value).trim();
        return normalized;
    }, {});
};

const ensureProductExists = async (productId) => {
    validateObjectId(productId, 'product id');

    const product = await Product.findById(productId);

    if (!product) {
        throw new ApiError(404, 'Product not found');
    }

    return product;
};

const ensureVariantBelongsToProduct = async (productId, variantId) => {
    validateObjectId(variantId, 'product variant id');

    const variant = await ProductVariant.findOne({_id: variantId, productId});

    if (!variant) {
        throw new ApiError(404, 'Product variant not found');
    }

    return variant;
};

const listProductVariants = asyncHandler(async (req, res) => {
    await ensureProductExists(req.params.productId);

    const variants = await ProductVariant.find({productId: req.params.productId}).sort({sku: 1});

    return res
    .status(200)
    .json(new ApiResponse(200, {variants}, 'Product variants fetched successfully'));
});

const createProductVariant = asyncHandler(async (req, res) => {
    await ensureProductExists(req.params.productId);

    const {sku, name, extraPrice = 0, isActive} = req.body;

    if (isBlank(sku)) {
        throw new ApiError(400, 'SKU is required');
    }

    const attributes = normalizeAttributes(req.body.attributes);

    const existingVariant = await ProductVariant.findOne({sku: sku.trim()});

    if (existingVariant) {
        throw new ApiError(409, 'SKU already exists');
    }

    const variant = await ProductVariant.create({
        productId: req.params.productId,
        sku,
        name: isBlank(name) ? null : name,
        attributes: attributes || {},
        extraPrice: parseExtraPrice(extraPrice),
        isActive: typeof isActive === 'boolean' ? isActive : true
    });

    return res
    .status(201)
    .json(new ApiResponse(201, {variant}, 'Product variant created successfully'));
});

const updateProductVariant = asyncHandler(async (req, res) => {
    await ensureProductExists(req.params.productId);
    await ensureVariantBelongsToProduct(req.params.productId, req.params.variantId);

    const updates = {};

    if (Object.hasOwn(req.body, 'sku')) {
        if (isBlank(req.body.sku)) {
            throw new ApiError(400, 'SKU cannot be blank');
        }

        updates.sku = req.body.sku;
    }

    if (Object.hasOwn(req.body, 'name')) {
        updates.name = isBlank(req.body.name) ? null : req.body.name;
    }

    if (Object.hasOwn(req.body, 'attributes')) {
        updates.attributes = normalizeAttributes(req.body.attributes);
    }

    if (Object.hasOwn(req.body, 'extraPrice')) {
        updates.extraPrice = parseExtraPrice(req.body.extraPrice);
    }

    if (Object.hasOwn(req.body, 'isActive')) {
        if (typeof req.body.isActive !== 'boolean') {
            throw new ApiError(400, 'isActive must be true or false');
        }

        updates.isActive = req.body.isActive;
    }

    const variant = await ProductVariant.findOneAndUpdate(
        {_id: req.params.variantId, productId: req.params.productId},
        {$set: updates},
        {new: true, runValidators: true}
    );

    return res
    .status(200)
    .json(new ApiResponse(200, {variant}, 'Product variant updated successfully'));
});

const deleteProductVariant = asyncHandler(async (req, res) => {
    await ensureProductExists(req.params.productId);
    await ensureVariantBelongsToProduct(req.params.productId, req.params.variantId);

    const variant = await ProductVariant.findOneAndUpdate(
        {_id: req.params.variantId, productId: req.params.productId},
        {$set: {isActive: false}},
        {new: true}
    );

    return res
    .status(200)
    .json(new ApiResponse(200, {variant}, 'Product variant deactivated successfully'));
});

export {
    listProductVariants,
    createProductVariant,
    updateProductVariant,
    deleteProductVariant
};
