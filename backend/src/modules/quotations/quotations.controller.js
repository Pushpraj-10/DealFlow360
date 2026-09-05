import mongoose from 'mongoose';

import {ApiResponse} from '../../core/utils/apiResponse.js';
import {ApiError} from '../../core/utils/apiError.js';
import {asyncHandler} from '../../core/utils/asyncHandler.js';
import {APPROVAL_STATUSES, CUSTOMER_STATUSES, QUOTATION_STATUSES, USER_ROLES} from '../../core/constants.js';
import {ApprovalRequest} from '../approvals/approval.model.js';
import {
    buildApprovalStepsFromRoles,
    evaluateApprovalRule
} from '../approvals/approvals.service.js';
import {Customer} from '../customers/customer.model.js';
import {getAllowedDiscount} from '../discountRules/discountRules.service.js';
import {resolveSellingPrice} from '../priceLists/priceLists.service.js';
import {Product} from '../products/product.model.js';
import {ProductVariant} from '../products/productVariant.model.js';
import {QuotationLine} from '../quotationLines/quotationLine.model.js';
import {calculateQuotationRisk} from '../riskEngine/riskEngine.service.js';
import {Quotation} from './quotation.model.js';
import {
    calculateLineAmounts,
    calculateQuotationTotals,
    recalculateQuotationCommercials
} from './quotations.service.js';

const validateObjectId = (value, label) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new ApiError(400, `Invalid ${label}`);
    }
};

const parsePositiveQuantity = (value) => {
    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new ApiError(400, 'Quantity must be greater than 0');
    }

    return parsed;
};

const parseDiscountPercent = (value = 0) => {
    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
        throw new ApiError(400, 'Discount percentage must be between 0 and 100');
    }

    return parsed;
};

const generateQuoteNumber = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();

    return `Q-${timestamp}-${suffix}`;
};

const loadQuotationWithLines = async (quotationId) => {
    const [quotation, lines] = await Promise.all([
        Quotation.findById(quotationId)
        .populate('customerId', 'name email company tierId status')
        .populate('salesRepId', 'fullName email role')
        .populate('ownerId', 'fullName email role'),
        QuotationLine.find({quotationId})
        .populate('productId', 'name productType billingType')
        .populate('variantId', 'sku name attributes extraPrice')
        .sort({createdAt: 1})
    ]);

    return {quotation, lines};
};

const listQuotations = asyncHandler(async (req, res) => {
    const quotations = await Quotation.find()
    .populate('customerId', 'name company tierId')
    .populate('salesRepId', 'fullName email role')
    .sort({createdAt: -1});

    return res
    .status(200)
    .json(new ApiResponse(200, {quotations}, 'Quotations fetched successfully'));
});

const createDraftQuotation = asyncHandler(async (req, res) => {
    const {customerId, currencyCode = 'USD'} = req.body;

    if (req.user.role !== USER_ROLES.SALES_REP) {
        throw new ApiError(403, 'Only sales reps can create draft quotations');
    }

    validateObjectId(customerId, 'customer id');

    const customer = await Customer.findById(customerId)
    .populate('tierId', 'name defaultMaxDiscountPercent isActive');

    if (!customer || customer.status !== CUSTOMER_STATUSES.ACTIVE) {
        throw new ApiError(400, 'Active customer not found');
    }

    if (!customer.tierId) {
        throw new ApiError(400, 'Customer must have a tier before creating a quotation');
    }

    const quotation = await Quotation.create({
        quoteNumber: generateQuoteNumber(),
        customerId: customer._id,
        salesRepId: req.user.id,
        ownerId: req.user.id,
        status: QUOTATION_STATUSES.DRAFT,
        currencyCode
    });

    const responseQuotation = await Quotation.findById(quotation._id)
    .populate('customerId', 'name email company tierId status')
    .populate('salesRepId', 'fullName email role')
    .populate('ownerId', 'fullName email role');

    return res
    .status(201)
    .json(new ApiResponse(201, {
        quotation: responseQuotation,
        lines: [],
        pricingContext: {
            customerTier: customer.tierId,
            currencyCode: responseQuotation.currencyCode
        }
    }, 'Draft quotation created successfully'));
});

const addProductToQuotation = asyncHandler(async (req, res) => {
    validateObjectId(req.params.quotationId, 'quotation id');

    const {
        productId,
        variantId = null,
        quantity = 1,
        discountPercent = 0
    } = req.body;

    validateObjectId(productId, 'product id');

    if (variantId) {
        validateObjectId(variantId, 'product variant id');
    }

    const quotation = await Quotation.findById(req.params.quotationId);

    if (!quotation) {
        throw new ApiError(404, 'Quotation not found');
    }

    if (quotation.status !== QUOTATION_STATUSES.DRAFT) {
        throw new ApiError(400, 'Products can only be added to draft quotations');
    }

    if (
        req.user.role === USER_ROLES.SALES_REP &&
        quotation.ownerId.toString() !== req.user.id.toString()
    ) {
        throw new ApiError(403, 'Sales reps can only update their own quotations');
    }

    const [customer, product] = await Promise.all([
        Customer.findById(quotation.customerId).populate('tierId', 'name defaultMaxDiscountPercent isActive'),
        Product.findById(productId).populate('categoryId', 'name maxAllowedDiscountPercent isActive')
    ]);

    if (!customer || customer.status !== CUSTOMER_STATUSES.ACTIVE) {
        throw new ApiError(400, 'Active customer not found');
    }

    if (!product || product.isActive === false) {
        throw new ApiError(400, 'Active product not found');
    }

    const variant = variantId
        ? await ProductVariant.findOne({_id: variantId, productId, isActive: true})
        : null;

    if (variantId && !variant) {
        throw new ApiError(400, 'Active product variant not found for this product');
    }

    const parsedQuantity = parsePositiveQuantity(quantity);
    const parsedDiscountPercent = parseDiscountPercent(discountPercent);
    const pricing = await resolveSellingPrice({
        customer,
        product,
        variant,
        currencyCode: quotation.currencyCode
    });
    const allowedDiscount = await getAllowedDiscount(customer, product);
    const amounts = calculateLineAmounts({
        quantity: parsedQuantity,
        unitPrice: pricing.sellingPrice,
        costPrice: product.costPrice,
        discountPercent: parsedDiscountPercent,
        taxPercentage: product.taxPercentage,
        allowedDiscountPercent: allowedDiscount.allowedDiscountPercent
    });

    const line = await QuotationLine.create({
        quotationId: quotation._id,
        productId: product._id,
        variantId: variant?._id || null,
        lineType: product.billingType,
        quantity: parsedQuantity,
        unitPrice: pricing.sellingPrice,
        costPrice: product.costPrice,
        discountPercent: parsedDiscountPercent,
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
    const {quotation: populatedQuotation, lines} = await loadQuotationWithLines(updatedQuotation._id);

    return res
    .status(201)
    .json(new ApiResponse(201, {
        quotation: populatedQuotation,
        line,
        lines,
        pricing,
        discount: allowedDiscount
    }, 'Product added to quotation successfully'));
});

const updateQuotationLine = asyncHandler(async (req, res) => {
    validateObjectId(req.params.quotationId, 'quotation id');
    validateObjectId(req.params.lineId, 'quotation line id');

    const allowedFields = ['quantity', 'discountPercent'];
    const unknownField = Object.keys(req.body).find((field) => !allowedFields.includes(field));

    if (unknownField) {
        throw new ApiError(400, 'Only quantity and discountPercent can be updated on a quotation line');
    }

    const quotation = await Quotation.findById(req.params.quotationId);

    if (!quotation) {
        throw new ApiError(404, 'Quotation not found');
    }

    if (quotation.status !== QUOTATION_STATUSES.DRAFT) {
        throw new ApiError(400, 'Quotation lines can only be updated while the quotation is in draft');
    }

    if (
        req.user.role === USER_ROLES.SALES_REP &&
        quotation.ownerId.toString() !== req.user.id.toString()
    ) {
        throw new ApiError(403, 'Sales reps can only update their own quotations');
    }

    const line = await QuotationLine.findOne({
        _id: req.params.lineId,
        quotationId: quotation._id
    });

    if (!line) {
        throw new ApiError(404, 'Quotation line not found');
    }

    const [customer, product] = await Promise.all([
        Customer.findById(quotation.customerId).populate('tierId', 'name defaultMaxDiscountPercent isActive'),
        Product.findById(line.productId).populate('categoryId', 'name maxAllowedDiscountPercent isActive')
    ]);

    if (!customer || customer.status !== CUSTOMER_STATUSES.ACTIVE) {
        throw new ApiError(400, 'Active customer not found');
    }

    if (!product || product.isActive === false) {
        throw new ApiError(400, 'Active product not found');
    }

    const nextQuantity = Object.hasOwn(req.body, 'quantity')
        ? parsePositiveQuantity(req.body.quantity)
        : line.quantity;
    const nextDiscountPercent = Object.hasOwn(req.body, 'discountPercent')
        ? parseDiscountPercent(req.body.discountPercent)
        : line.discountPercent;
    const allowedDiscount = await getAllowedDiscount(customer, product);
    const amounts = calculateLineAmounts({
        quantity: nextQuantity,
        unitPrice: line.unitPrice,
        costPrice: line.costPrice,
        discountPercent: nextDiscountPercent,
        taxPercentage: line.taxPercentage,
        allowedDiscountPercent: allowedDiscount.allowedDiscountPercent
    });

    line.quantity = nextQuantity;
    line.discountPercent = nextDiscountPercent;
    line.tax = amounts.tax;
    line.lineSubtotal = amounts.lineSubtotal;
    line.discountAmount = amounts.discountAmount;
    line.revenueAfterDiscount = amounts.revenueAfterDiscount;
    line.totalCost = amounts.totalCost;
    line.lineTotal = amounts.lineTotal;
    line.margin = amounts.margin;
    line.marginAmount = amounts.marginAmount;
    line.grossMarginAmount = amounts.grossMarginAmount;
    line.marginPercentage = amounts.marginPercentage;
    line.allowedDiscountPercent = allowedDiscount.allowedDiscountPercent;
    line.allowed_discount = amounts.allowed_discount;
    line.actual_discount = amounts.actual_discount;
    line.excess_discount = amounts.excess_discount;
    line.is_violation = amounts.is_violation;
    line.violationAmount = amounts.violationAmount;

    await line.save();

    const totals = await calculateQuotationTotals(quotation._id);
    const updatedQuotation = await Quotation.findByIdAndUpdate(
        quotation._id,
        {$set: totals},
        {new: true, runValidators: true}
    );
    const {quotation: populatedQuotation, lines} = await loadQuotationWithLines(updatedQuotation._id);

    return res
    .status(200)
    .json(new ApiResponse(200, {
        quotation: populatedQuotation,
        line,
        lines,
        discount: allowedDiscount
    }, 'Quotation line updated successfully'));
});

const submitQuotation = asyncHandler(async (req, res) => {
    validateObjectId(req.params.quotationId, 'quotation id');

    const quotation = await Quotation.findById(req.params.quotationId);

    if (!quotation) {
        throw new ApiError(404, 'Quotation not found');
    }

    if (quotation.status !== QUOTATION_STATUSES.DRAFT) {
        throw new ApiError(400, 'Only draft quotations can be submitted');
    }

    if (
        req.user.role === USER_ROLES.SALES_REP &&
        quotation.ownerId.toString() !== req.user.id.toString()
    ) {
        throw new ApiError(403, 'Sales reps can only submit their own quotations');
    }

    const lineCount = await QuotationLine.countDocuments({quotationId: quotation._id});

    if (lineCount === 0) {
        throw new ApiError(400, 'Cannot submit a quotation without lines');
    }

    await recalculateQuotationCommercials(quotation._id);
    const risk = await calculateQuotationRisk(quotation._id);
    const approvalDecision = await evaluateApprovalRule({
        riskScore: risk.totalRiskScore,
        totalExcessDiscountExposure: risk.totalExcessDiscountExposure
    });

    const nextQuotationStatus = approvalDecision.approvalRequired
        ? QUOTATION_STATUSES.PENDING_APPROVAL
        : QUOTATION_STATUSES.READY_FOR_CUSTOMER;
    const nextApprovalStatus = approvalDecision.approvalRequired
        ? APPROVAL_STATUSES.PENDING
        : APPROVAL_STATUSES.NOT_REQUIRED;

    const updatedQuotation = await Quotation.findByIdAndUpdate(
        quotation._id,
        {
            $set: {
                status: nextQuotationStatus,
                approvalStatus: nextApprovalStatus,
                riskScore: risk.totalRiskScore,
                riskSeverity: risk.severity
            }
        },
        {new: true, runValidators: true}
    );

    let approvalRequest = null;

    if (approvalDecision.approvalRequired) {
        await ApprovalRequest.updateMany(
            {quotationId: quotation._id, status: 'PENDING'},
            {$set: {status: 'CANCELLED'}}
        );

        approvalRequest = await ApprovalRequest.create({
            quotationId: quotation._id,
            quotationVersion: updatedQuotation.currentVersion,
            requestedById: req.user.id,
            status: 'PENDING',
            riskLevel: risk.severity,
            riskScore: risk.totalRiskScore,
            totalExcessDiscountExposure: risk.totalExcessDiscountExposure,
            approvalRuleId: approvalDecision.rule._id,
            steps: buildApprovalStepsFromRoles(approvalDecision.requiredApprovalRoles)
        });
    }

    const {quotation: populatedQuotation, lines} = await loadQuotationWithLines(updatedQuotation._id);

    return res
    .status(200)
    .json(new ApiResponse(200, {
        quotation: populatedQuotation,
        lines,
        risk,
        approval: {
            approvalRequired: approvalDecision.approvalRequired,
            rule: approvalDecision.rule,
            requiredApprovalRoles: approvalDecision.requiredApprovalRoles,
            approvalRequest
        }
    }, 'Quotation submitted successfully'));
});

const getCustomerPortalQuotation = asyncHandler(async (req, res) => {
    const quotation = await Quotation.findById(req.params.quotationId).select(
        'quoteNumber customerId status currencyCode subtotal totalDiscount totalRevenueAfterDiscount totalCost tax grandTotal margin totalMarginAmount grossMarginAmount marginPercentage currentVersion createdAt updatedAt'
    );

    if (!quotation) {
        throw new ApiError(404, 'Quotation not found');
    }

    const portalQuotation = {
        id: quotation._id,
        quoteNumber: quotation.quoteNumber,
        status: quotation.status,
        currencyCode: quotation.currencyCode,
        customerId: req.user.role === USER_ROLES.CUSTOMER ? undefined : quotation.customerId,
        createdAt: quotation.createdAt,
        updatedAt: quotation.updatedAt
    };

    return res
    .status(200)
    .json(new ApiResponse(200, {quotation: portalQuotation}, 'Portal quotation fetched successfully'));
});

export {
    listQuotations,
    createDraftQuotation,
    addProductToQuotation,
    updateQuotationLine,
    submitQuotation,
    getCustomerPortalQuotation
};
