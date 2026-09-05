import {ApiError} from '../../core/utils/apiError.js';
import {Category} from '../categories/category.model.js';
import {CustomerTier} from '../customerTiers/customerTier.model.js';
import {DiscountRule} from './discountRule.model.js';

const getDocumentId = (value) => {
    if (!value) {
        return null;
    }

    return value._id || value;
};

const readPercent = (value) => {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
};

const getConfiguredTierLimit = async (tier) => {
    const tierId = getDocumentId(tier);

    if (!tierId) {
        throw new ApiError(400, 'Customer tier is required to calculate allowed discount');
    }

    const tierDocument = tier.defaultMaxDiscountPercent !== undefined
        ? tier
        : await CustomerTier.findById(tierId);

    if (!tierDocument || tierDocument.isActive === false) {
        throw new ApiError(400, 'Active customer tier not found');
    }

    const tierRule = await DiscountRule.findOne({
        customerTierId: tierId,
        categoryId: null,
        isActive: true
    }).sort({updatedAt: -1});

    return {
        source: tierRule ? 'DISCOUNT_RULE_CUSTOMER_TIER' : 'CUSTOMER_TIER_DEFAULT',
        sourceId: tierRule?._id || tierDocument._id,
        name: tierDocument.name,
        percent: readPercent(tierRule?.maxDiscountPercent ?? tierDocument.defaultMaxDiscountPercent)
    };
};

const getConfiguredCategoryLimit = async (category) => {
    const categoryId = getDocumentId(category);

    if (!categoryId) {
        throw new ApiError(400, 'Product category is required to calculate allowed discount');
    }

    const categoryDocument = category.maxAllowedDiscountPercent !== undefined
        ? category
        : await Category.findById(categoryId);

    if (!categoryDocument || categoryDocument.isActive === false) {
        throw new ApiError(400, 'Active product category not found');
    }

    const categoryRule = await DiscountRule.findOne({
        customerTierId: null,
        categoryId,
        isActive: true
    }).sort({updatedAt: -1});

    return {
        source: categoryRule ? 'DISCOUNT_RULE_PRODUCT_CATEGORY' : 'PRODUCT_CATEGORY_DEFAULT',
        sourceId: categoryRule?._id || categoryDocument._id,
        name: categoryDocument.name,
        percent: readPercent(categoryRule?.maxDiscountPercent ?? categoryDocument.maxAllowedDiscountPercent)
    };
};

const buildReason = (tierLimit, categoryLimit, allowedDiscountPercent) => {
    if (tierLimit.percent === categoryLimit.percent) {
        return `Customer tier ${tierLimit.name} and product category ${categoryLimit.name} both allow ${allowedDiscountPercent}%.`;
    }

    if (tierLimit.percent < categoryLimit.percent) {
        return `Customer tier ${tierLimit.name} is stricter at ${tierLimit.percent}% than product category ${categoryLimit.name} at ${categoryLimit.percent}%.`;
    }

    return `Product category ${categoryLimit.name} is stricter at ${categoryLimit.percent}% than customer tier ${tierLimit.name} at ${tierLimit.percent}%.`;
};

const getAllowedDiscount = async (customer, product) => {
    if (!customer || !product) {
        throw new ApiError(400, 'Customer and product are required to calculate allowed discount');
    }

    const tierLimit = await getConfiguredTierLimit(customer.tierId || customer.tier);
    const categoryLimit = await getConfiguredCategoryLimit(product.categoryId || product.category);

    if (tierLimit.percent === null || categoryLimit.percent === null) {
        throw new ApiError(400, 'Discount limits must be configured for customer tier and product category');
    }

    const allowedDiscountPercent = Math.min(tierLimit.percent, categoryLimit.percent);
    const limitingRule = tierLimit.percent <= categoryLimit.percent ? tierLimit : categoryLimit;

    return {
        allowedDiscountPercent,
        reason: buildReason(tierLimit, categoryLimit, allowedDiscountPercent),
        limitingSource: limitingRule.source,
        limitingSourceId: limitingRule.sourceId,
        limits: {
            customerTier: tierLimit,
            productCategory: categoryLimit
        }
    };
};

const discountRulesService = Object.freeze({
    moduleName: 'discountRules',
    getAllowedDiscount
});

export {
    discountRulesService,
    getAllowedDiscount
};
