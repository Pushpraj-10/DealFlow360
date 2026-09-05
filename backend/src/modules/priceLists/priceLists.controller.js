import mongoose from 'mongoose';

import {USER_ROLES} from '../../core/constants.js';
import {ApiError} from '../../core/utils/apiError.js';
import {ApiResponse} from '../../core/utils/apiResponse.js';
import {asyncHandler} from '../../core/utils/asyncHandler.js';
import {Customer} from '../customers/customer.model.js';
import {CustomerTier} from '../customerTiers/customerTier.model.js';
import {Product} from '../products/product.model.js';
import {ProductVariant} from '../products/productVariant.model.js';
import {PriceList} from './priceList.model.js';

const isBlank = (value) => typeof value !== 'string' || value.trim().length === 0;

const validateObjectId = (value, label) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new ApiError(400, `Invalid ${label}`);
    }
};

const parsePrice = (value, label = 'Price') => {
    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed < 0) {
        throw new ApiError(400, `${label} must be a non-negative number`);
    }

    return parsed;
};

const parseOptionalDate = (value, label) => {
    if (value === undefined || value === null || value === '') {
        return null;
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
        throw new ApiError(400, `${label} must be a valid date`);
    }

    return parsed;
};

const validateDateRange = (validFrom, validTo) => {
    if (validFrom && validTo && validFrom > validTo) {
        throw new ApiError(400, 'validFrom cannot be after validTo');
    }
};

const ensureCustomerTier = async (customerTierId) => {
    validateObjectId(customerTierId, 'customer tier id');

    const tier = await CustomerTier.findById(customerTierId);

    if (!tier || tier.isActive === false) {
        throw new ApiError(400, 'Active customer tier not found');
    }

    return tier;
};

const ensureProduct = async (productId) => {
    validateObjectId(productId, 'product id');

    const product = await Product.findById(productId);

    if (!product || product.isActive === false) {
        throw new ApiError(400, 'Active product not found');
    }

    return product;
};

const ensureVariant = async (variantId, productId) => {
    if (!variantId) {
        return null;
    }

    validateObjectId(variantId, 'product variant id');

    const variant = await ProductVariant.findOne({_id: variantId, productId});

    if (!variant || variant.isActive === false) {
        throw new ApiError(400, 'Active product variant not found for this product');
    }

    return variant;
};

const buildPriceListItem = async (body) => {
    const {productId, variantId} = body;

    if (isBlank(productId)) {
        throw new ApiError(400, 'productId is required');
    }

    await ensureProduct(productId);
    await ensureVariant(variantId, productId);

    const basePriceOverride = parsePrice(
        body.basePriceOverride ?? body.unitPrice,
        'Base price override'
    );
    const validFrom = parseOptionalDate(body.validFrom, 'validFrom');
    const validTo = parseOptionalDate(body.validTo, 'validTo');

    validateDateRange(validFrom, validTo);

    return {
        productId,
        variantId: variantId || null,
        unitPrice: basePriceOverride,
        basePriceOverride,
        validFrom,
        validTo
    };
};

const isCurrentlyValid = (item, asOfDate) => {
    return (!item.validFrom || item.validFrom <= asOfDate) && (!item.validTo || item.validTo >= asOfDate);
};

const findApplicablePriceItem = (priceLists, productId, variantId, asOfDate) => {
    const allItems = priceLists.flatMap((priceList) => priceList.items || []);
    const activeItems = allItems
    .filter((item) => item.productId.toString() === productId.toString() && isCurrentlyValid(item, asOfDate))
    .sort((left, right) => {
        const leftTime = left.validFrom ? left.validFrom.getTime() : 0;
        const rightTime = right.validFrom ? right.validFrom.getTime() : 0;

        return rightTime - leftTime;
    });

    if (variantId) {
        const variantMatch = activeItems.find((item) => item.variantId?.toString() === variantId.toString());

        if (variantMatch) {
            return variantMatch;
        }
    }

    return activeItems.find((item) => !item.variantId) || null;
};

const listPriceLists = asyncHandler(async (req, res) => {
    const priceLists = await PriceList.find()
    .populate('customerTierId', 'name defaultMaxDiscountPercent')
    .populate('items.productId', 'name basePrice')
    .populate('items.variantId', 'sku name extraPrice')
    .sort({name: 1});

    return res
    .status(200)
    .json(new ApiResponse(200, {priceLists}, 'Price lists fetched successfully'));
});

const getPriceList = asyncHandler(async (req, res) => {
    validateObjectId(req.params.priceListId, 'price list id');

    const priceList = await PriceList.findById(req.params.priceListId)
    .populate('customerTierId', 'name defaultMaxDiscountPercent')
    .populate('items.productId', 'name basePrice')
    .populate('items.variantId', 'sku name extraPrice');

    if (!priceList) {
        throw new ApiError(404, 'Price list not found');
    }

    return res
    .status(200)
    .json(new ApiResponse(200, {priceList}, 'Price list fetched successfully'));
});

const createPriceList = asyncHandler(async (req, res) => {
    const {name, customerTierId, currencyCode = 'USD', isActive} = req.body;

    if (isBlank(name) || isBlank(customerTierId)) {
        throw new ApiError(400, 'Name and customerTierId are required');
    }

    await ensureCustomerTier(customerTierId);

    const items = [];

    for (const item of req.body.items || []) {
        items.push(await buildPriceListItem(item));
    }

    const priceList = await PriceList.create({
        name,
        customerTierId,
        currencyCode,
        items,
        isActive: typeof isActive === 'boolean' ? isActive : true
    });

    return res
    .status(201)
    .json(new ApiResponse(201, {priceList}, 'Price list created successfully'));
});

const updatePriceList = asyncHandler(async (req, res) => {
    validateObjectId(req.params.priceListId, 'price list id');

    const updates = {};

    if (Object.hasOwn(req.body, 'name')) {
        if (isBlank(req.body.name)) {
            throw new ApiError(400, 'Price list name cannot be blank');
        }

        updates.name = req.body.name;
    }

    if (Object.hasOwn(req.body, 'customerTierId')) {
        await ensureCustomerTier(req.body.customerTierId);
        updates.customerTierId = req.body.customerTierId;
    }

    if (Object.hasOwn(req.body, 'currencyCode')) {
        if (isBlank(req.body.currencyCode)) {
            throw new ApiError(400, 'Currency code cannot be blank');
        }

        updates.currencyCode = req.body.currencyCode;
    }

    if (Object.hasOwn(req.body, 'isActive')) {
        if (typeof req.body.isActive !== 'boolean') {
            throw new ApiError(400, 'isActive must be true or false');
        }

        updates.isActive = req.body.isActive;
    }

    const priceList = await PriceList.findByIdAndUpdate(
        req.params.priceListId,
        {$set: updates},
        {new: true, runValidators: true}
    );

    if (!priceList) {
        throw new ApiError(404, 'Price list not found');
    }

    return res
    .status(200)
    .json(new ApiResponse(200, {priceList}, 'Price list updated successfully'));
});

const deletePriceList = asyncHandler(async (req, res) => {
    validateObjectId(req.params.priceListId, 'price list id');

    const priceList = await PriceList.findByIdAndUpdate(
        req.params.priceListId,
        {$set: {isActive: false}},
        {new: true}
    );

    if (!priceList) {
        throw new ApiError(404, 'Price list not found');
    }

    return res
    .status(200)
    .json(new ApiResponse(200, {priceList}, 'Price list deactivated successfully'));
});

const addPriceListItem = asyncHandler(async (req, res) => {
    validateObjectId(req.params.priceListId, 'price list id');

    const item = await buildPriceListItem(req.body);
    const priceList = await PriceList.findById(req.params.priceListId);

    if (!priceList) {
        throw new ApiError(404, 'Price list not found');
    }

    priceList.items.push(item);
    await priceList.save();

    return res
    .status(201)
    .json(new ApiResponse(201, {priceList}, 'Price list item added successfully'));
});

const updatePriceListItem = asyncHandler(async (req, res) => {
    validateObjectId(req.params.priceListId, 'price list id');
    validateObjectId(req.params.itemId, 'price list item id');

    const priceList = await PriceList.findById(req.params.priceListId);

    if (!priceList) {
        throw new ApiError(404, 'Price list not found');
    }

    const item = priceList.items.id(req.params.itemId);

    if (!item) {
        throw new ApiError(404, 'Price list item not found');
    }

    const nextProductId = req.body.productId || item.productId.toString();
    const nextVariantId = Object.hasOwn(req.body, 'variantId') ? req.body.variantId : item.variantId?.toString();

    if (Object.hasOwn(req.body, 'productId')) {
        await ensureProduct(req.body.productId);
        item.productId = req.body.productId;
    }

    if (Object.hasOwn(req.body, 'variantId')) {
        await ensureVariant(req.body.variantId, nextProductId);
        item.variantId = req.body.variantId || null;
    } else if (nextVariantId) {
        await ensureVariant(nextVariantId, nextProductId);
    }

    if (Object.hasOwn(req.body, 'basePriceOverride') || Object.hasOwn(req.body, 'unitPrice')) {
        const price = parsePrice(req.body.basePriceOverride ?? req.body.unitPrice, 'Base price override');
        item.basePriceOverride = price;
        item.unitPrice = price;
    }

    if (Object.hasOwn(req.body, 'validFrom')) {
        item.validFrom = parseOptionalDate(req.body.validFrom, 'validFrom');
    }

    if (Object.hasOwn(req.body, 'validTo')) {
        item.validTo = parseOptionalDate(req.body.validTo, 'validTo');
    }

    validateDateRange(item.validFrom, item.validTo);
    await priceList.save();

    return res
    .status(200)
    .json(new ApiResponse(200, {priceList}, 'Price list item updated successfully'));
});

const deletePriceListItem = asyncHandler(async (req, res) => {
    validateObjectId(req.params.priceListId, 'price list id');
    validateObjectId(req.params.itemId, 'price list item id');

    const priceList = await PriceList.findById(req.params.priceListId);

    if (!priceList) {
        throw new ApiError(404, 'Price list not found');
    }

    const item = priceList.items.id(req.params.itemId);

    if (!item) {
        throw new ApiError(404, 'Price list item not found');
    }

    item.deleteOne();
    await priceList.save();

    return res
    .status(200)
    .json(new ApiResponse(200, {priceList}, 'Price list item deleted successfully'));
});

const resolveProductPriceForCustomer = asyncHandler(async (req, res) => {
    const {customerId, productId, variantId, currencyCode = 'USD', asOf} = req.query;

    if (isBlank(customerId) || isBlank(productId)) {
        throw new ApiError(400, 'customerId and productId are required');
    }

    validateObjectId(customerId, 'customer id');
    const product = await ensureProduct(productId);
    const variant = await ensureVariant(variantId, productId);
    const asOfDate = parseOptionalDate(asOf, 'asOf') || new Date();

    const customer = await Customer.findById(customerId).populate('tierId', 'name defaultMaxDiscountPercent');

    if (!customer) {
        throw new ApiError(404, 'Customer not found');
    }

    if (!customer.tierId) {
        throw new ApiError(400, 'Customer does not have a tier assigned');
    }

    if (req.user.role === USER_ROLES.CUSTOMER && customer._id.toString() !== req.user.customerId?.toString()) {
        throw new ApiError(404, 'Customer not found');
    }

    const priceLists = await PriceList.find({
        customerTierId: customer.tierId._id,
        currencyCode: String(currencyCode).toUpperCase(),
        isActive: true
    });
    const matchingItem = findApplicablePriceItem(priceLists, productId, variantId, asOfDate);
    const fallbackPrice = product.basePrice + (variant?.extraPrice || 0);
    const sellingPrice = matchingItem?.basePriceOverride ?? fallbackPrice;

    return res
    .status(200)
    .json(new ApiResponse(200, {
        customerId,
        customerTier: customer.tierId,
        productId,
        variantId: variant?._id || null,
        currencyCode: String(currencyCode).toUpperCase(),
        sellingPrice,
        source: matchingItem ? 'PRICE_LIST' : 'PRODUCT_BASE_PRICE',
        priceListItemId: matchingItem?._id || null,
        asOf: asOfDate
    }, 'Applicable selling price resolved successfully'));
});

export {
    listPriceLists,
    getPriceList,
    createPriceList,
    updatePriceList,
    deletePriceList,
    addPriceListItem,
    updatePriceListItem,
    deletePriceListItem,
    resolveProductPriceForCustomer
};
