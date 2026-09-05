import mongoose from 'mongoose';

import {
    AUDIT_ACTIONS,
    CUSTOMER_STATUSES,
    PRODUCT_BILLING_TYPES,
    QUOTATION_STATUSES,
    USER_ROLES
} from '../../core/constants.js';
import {ApiError} from '../../core/utils/apiError.js';
import {ApiResponse} from '../../core/utils/apiResponse.js';
import {asyncHandler} from '../../core/utils/asyncHandler.js';
import {Customer} from '../customers/customer.model.js';
import {getAllowedDiscount} from '../discountRules/discountRules.service.js';
import {resolveSellingPrice} from '../priceLists/priceLists.service.js';
import {Product} from '../products/product.model.js';
import {QuotationLine} from '../quotationLines/quotationLine.model.js';
import {Quotation} from '../quotations/quotation.model.js';
import {
    calculateLineAmounts,
    calculateQuotationTotals,
    prepareQuotationForMaterialChange
} from '../quotations/quotations.service.js';
import {createAuditLog} from '../auditLogs/auditLogs.service.js';
import {buildQuotationUpsellRecommendations} from './recommendations.service.js';
import {UpsellRule} from './upsellRule.model.js';

const validateObjectId = (value, label) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new ApiError(400, `Invalid ${label}`);
    }
};

const parseNonNegativeNumber = (value, label) => {
    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed < 0) {
        throw new ApiError(400, `${label} must be a non-negative number`);
    }

    return parsed;
};

const parseMarginPercent = (value) => {
    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
        throw new ApiError(400, 'minimumRequiredMarginPercent must be between 0 and 100');
    }

    return parsed;
};

const normalizeSuggestedProductIds = (value) => {
    if (!Array.isArray(value) || !value.length) {
        throw new ApiError(400, 'suggestedProductIds must contain at least one product id');
    }

    value.forEach((productId) => validateObjectId(productId, 'suggested product id'));

    return [...new Set(value.map(String))];
};

const ensureProductsExist = async (productIds) => {
    const products = await Product.find({_id: {$in: productIds}, isActive: true}).select('_id');

    if (products.length !== productIds.length) {
        throw new ApiError(400, 'All source and suggested products must be active products');
    }
};

const buildUpsellRulePayload = async (body, {partial = false} = {}) => {
    const payload = {};

    if (!partial) {
        if (!body.sourceProductId) {
            throw new ApiError(400, 'sourceProductId is required');
        }

        if (!body.suggestedProductIds) {
            throw new ApiError(400, 'suggestedProductIds is required');
        }
    }

    if (Object.hasOwn(body, 'sourceProductId')) {
        validateObjectId(body.sourceProductId, 'source product id');
        payload.sourceProductId = body.sourceProductId;
    }

    if (Object.hasOwn(body, 'suggestedProductIds')) {
        payload.suggestedProductIds = normalizeSuggestedProductIds(body.suggestedProductIds);
    }

    if (payload.sourceProductId && payload.suggestedProductIds?.includes(payload.sourceProductId.toString())) {
        throw new ApiError(400, 'A product cannot upsell itself');
    }

    if (Object.hasOwn(body, 'coPurchaseScore')) {
        payload.coPurchaseScore = parseNonNegativeNumber(body.coPurchaseScore, 'coPurchaseScore');
    }

    if (Object.hasOwn(body, 'promotionBoost')) {
        payload.promotionBoost = parseNonNegativeNumber(body.promotionBoost, 'promotionBoost');
    }

    if (Object.hasOwn(body, 'minimumRequiredMarginPercent')) {
        payload.minimumRequiredMarginPercent = parseMarginPercent(body.minimumRequiredMarginPercent);
    }

    if (Object.hasOwn(body, 'isActive')) {
        if (typeof body.isActive !== 'boolean') {
            throw new ApiError(400, 'isActive must be true or false');
        }

        payload.isActive = body.isActive;
    }

    const idsToCheck = [
        payload.sourceProductId,
        ...(payload.suggestedProductIds || [])
    ].filter(Boolean);

    if (idsToCheck.length) {
        await ensureProductsExist([...new Set(idsToCheck.map(String))]);
    }

    return payload;
};

const getRecommendationsModuleStatus = asyncHandler(async (req, res) => {
    return res
    .status(200)
    .json(new ApiResponse(200, {module: 'recommendations', ready: true}, 'Recommendations module ready'));
});

const listUpsellRules = asyncHandler(async (req, res) => {
    const rules = await UpsellRule.find()
    .populate('sourceProductId', 'name productType billingType')
    .populate('suggestedProductIds', 'name productType billingType')
    .sort({updatedAt: -1});

    return res
    .status(200)
    .json(new ApiResponse(200, {rules}, 'Upsell rules fetched successfully'));
});

const createUpsellRule = asyncHandler(async (req, res) => {
    const payload = await buildUpsellRulePayload(req.body);
    const rule = await UpsellRule.create(payload);
    const populatedRule = await UpsellRule.findById(rule._id)
    .populate('sourceProductId', 'name productType billingType')
    .populate('suggestedProductIds', 'name productType billingType');

    return res
    .status(201)
    .json(new ApiResponse(201, {rule: populatedRule}, 'Upsell rule created successfully'));
});

const updateUpsellRule = asyncHandler(async (req, res) => {
    validateObjectId(req.params.ruleId, 'upsell rule id');

    const existingRule = await UpsellRule.findById(req.params.ruleId);

    if (!existingRule) {
        throw new ApiError(404, 'Upsell rule not found');
    }

    const payload = await buildUpsellRulePayload(req.body, {partial: true});
    const nextSourceProductId = payload.sourceProductId || existingRule.sourceProductId.toString();
    const nextSuggestedProductIds = payload.suggestedProductIds || existingRule.suggestedProductIds.map(String);

    if (nextSuggestedProductIds.includes(nextSourceProductId.toString())) {
        throw new ApiError(400, 'A product cannot upsell itself');
    }

    const rule = await UpsellRule.findByIdAndUpdate(
        req.params.ruleId,
        {$set: payload},
        {new: true, runValidators: true}
    )
    .populate('sourceProductId', 'name productType billingType')
    .populate('suggestedProductIds', 'name productType billingType');

    return res
    .status(200)
    .json(new ApiResponse(200, {rule}, 'Upsell rule updated successfully'));
});

const deleteUpsellRule = asyncHandler(async (req, res) => {
    validateObjectId(req.params.ruleId, 'upsell rule id');

    const rule = await UpsellRule.findByIdAndUpdate(
        req.params.ruleId,
        {$set: {isActive: false}},
        {new: true}
    );

    if (!rule) {
        throw new ApiError(404, 'Upsell rule not found');
    }

    return res
    .status(200)
    .json(new ApiResponse(200, {rule}, 'Upsell rule deactivated successfully'));
});

const getQuotationUpsellRecommendations = asyncHandler(async (req, res) => {
    validateObjectId(req.params.quotationId, 'quotation id');

    if (![USER_ROLES.SALES_REP, USER_ROLES.SALES_MANAGER, USER_ROLES.ADMIN].includes(req.user.role)) {
        throw new ApiError(403, 'Only sales users can view quotation upsell recommendations');
    }

    const result = await buildQuotationUpsellRecommendations(req.params.quotationId);

    return res
    .status(200)
    .json(new ApiResponse(200, result, 'Quotation upsell recommendations fetched successfully'));
});

const acceptQuotationUpsellRecommendation = asyncHandler(async (req, res) => {
    validateObjectId(req.params.quotationId, 'quotation id');
    validateObjectId(req.body.productId, 'product id');

    let quotation = await Quotation.findById(req.params.quotationId);

    if (!quotation) {
        throw new ApiError(404, 'Quotation not found');
    }

    if (
        req.user.role === USER_ROLES.SALES_REP &&
        quotation.ownerId.toString() !== req.user.id.toString()
    ) {
        throw new ApiError(403, 'Sales reps can only add upsells to their own quotations');
    }

    if ([QUOTATION_STATUSES.CONFIRMED, QUOTATION_STATUSES.REJECTED, QUOTATION_STATUSES.EXPIRED, QUOTATION_STATUSES.CANCELLED].includes(quotation.status)) {
        throw new ApiError(400, `Cannot add upsells while quotation is ${quotation.status}`);
    }

    const recommendations = await buildQuotationUpsellRecommendations(quotation._id);
    const recommendation = recommendations.recommendations.find(
        (item) => item.product.id.toString() === req.body.productId.toString()
    );

    if (!recommendation) {
        throw new ApiError(400, 'Product is not an active eligible upsell recommendation for this quotation');
    }

    quotation = await prepareQuotationForMaterialChange(quotation, {
        actor: req.user,
        reason: 'Upsell recommendation accepted'
    });

    const [customer, product] = await Promise.all([
        Customer.findById(quotation.customerId).populate('tierId', 'name defaultMaxDiscountPercent isActive'),
        Product.findById(req.body.productId).populate('categoryId', 'name maxAllowedDiscountPercent isActive')
    ]);

    if (!customer || customer.status !== CUSTOMER_STATUSES.ACTIVE) {
        throw new ApiError(400, 'Active customer not found');
    }

    if (!product || product.isActive === false) {
        throw new ApiError(400, 'Active product not found');
    }

    const quantity = req.body.quantity === undefined ? 1 : Number(req.body.quantity);

    if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new ApiError(400, 'Quantity must be greater than 0');
    }

    const pricing = await resolveSellingPrice({
        customer,
        product,
        currencyCode: quotation.currencyCode
    });
    const allowedDiscount = await getAllowedDiscount(customer, product);
    const amounts = calculateLineAmounts({
        quantity,
        unitPrice: pricing.sellingPrice,
        costPrice: product.costPrice,
        discountPercent: 0,
        taxPercentage: product.taxPercentage,
        allowedDiscountPercent: allowedDiscount.allowedDiscountPercent
    });

    const line = await QuotationLine.create({
        quotationId: quotation._id,
        productId: product._id,
        variantId: null,
        lineType: product.billingType || PRODUCT_BILLING_TYPES.ONE_TIME,
        quantity,
        unitPrice: pricing.sellingPrice,
        costPrice: product.costPrice,
        discountPercent: 0,
        taxPercentage: product.taxPercentage,
        tax: amounts.tax,
        lineSubtotal: amounts.lineSubtotal,
        discountAmount: amounts.discountAmount,
        revenueAfterDiscount: amounts.revenueAfterDiscount,
        totalCost: amounts.totalCost,
        lineTotal: amounts.lineTotal,
        margin: amounts.margin,
        marginAmount: amounts.marginAmount,
        grossMarginAmount: amounts.grossMarginAmount,
        marginPercentage: amounts.marginPercentage,
        allowedDiscountPercent: allowedDiscount.allowedDiscountPercent,
        allowed_discount: amounts.allowed_discount,
        actual_discount: amounts.actual_discount,
        excess_discount: amounts.excess_discount,
        is_violation: amounts.is_violation,
        violationAmount: amounts.violationAmount,
        description: product.name
    });

    const totals = await calculateQuotationTotals(quotation._id);
    const updatedQuotation = await Quotation.findByIdAndUpdate(
        quotation._id,
        {$set: totals},
        {new: true, runValidators: true}
    );
    const lines = await QuotationLine.find({quotationId: quotation._id})
    .populate('productId', 'name productType billingType')
    .populate('variantId', 'sku name attributes extraPrice')
    .sort({createdAt: 1});

    await createAuditLog({
        actor: req.user,
        action: AUDIT_ACTIONS.QUOTATION_LINE_ADDED,
        entityType: 'QuotationLine',
        entityId: line._id,
        quotationId: quotation._id,
        customerId: quotation.customerId,
        after: line.toObject(),
        metadata: {
            source: 'UPSELL_RECOMMENDATION',
            recommendation,
            quotationVersion: updatedQuotation.currentVersion,
            pricingSource: pricing.source
        }
    });

    return res
    .status(201)
    .json(new ApiResponse(201, {
        quotation: updatedQuotation,
        line,
        lines,
        marginImpact: {
            expectedRevenue: recommendation.expectedRevenue,
            estimatedMarginDelta: recommendation.estimatedMarginDelta,
            newTotalMarginAmount: updatedQuotation.totalMarginAmount,
            newMarginPercentage: updatedQuotation.marginPercentage
        }
    }, 'Upsell recommendation accepted and added to quotation successfully'));
});

export {
    getRecommendationsModuleStatus,
    listUpsellRules,
    createUpsellRule,
    updateUpsellRule,
    deleteUpsellRule,
    getQuotationUpsellRecommendations,
    acceptQuotationUpsellRecommendation
};
