import mongoose from 'mongoose';

import {ApiResponse} from '../../core/utils/apiResponse.js';
import {ApiError} from '../../core/utils/apiError.js';
import {asyncHandler} from '../../core/utils/asyncHandler.js';
import {APPROVAL_STATUSES, AUDIT_ACTIONS, CUSTOMER_STATUSES, QUOTATION_STATUSES, USER_ROLES} from '../../core/constants.js';
import {ApprovalRequest} from '../approvals/approval.model.js';
import {
    buildApprovalStepsFromRoles,
    evaluateApprovalRule
} from '../approvals/approvals.service.js';
import {createAuditLog} from '../auditLogs/auditLogs.service.js';
import {AuditLog} from '../auditLogs/auditLog.model.js';
import {Customer} from '../customers/customer.model.js';
import {getAllowedDiscount} from '../discountRules/discountRules.service.js';
import {resolveSellingPrice} from '../priceLists/priceLists.service.js';
import {Product} from '../products/product.model.js';
import {ProductVariant} from '../products/productVariant.model.js';
import {QuotationLine} from '../quotationLines/quotationLine.model.js';
import {calculateQuotationRisk} from '../riskEngine/riskEngine.service.js';
import {Negotiation, NegotiationMessage} from '../negotiations/negotiation.model.js';
import {Quotation} from './quotation.model.js';
import {QuotationVersion} from './quotationVersion.model.js';
import {
    buildConfirmedQuotationOrderSnapshot,
    calculateLineAmounts,
    calculateQuotationTotals,
    createQuotationVersionSnapshot,
    prepareQuotationForMaterialChange,
    recalculateQuotationCommercials
} from './quotations.service.js';
import {transitionQuotationState} from './quotationState.service.js';

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

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getLastActivityMap = async (quotationIds) => {
    if (!quotationIds.length) {
        return new Map();
    }

    const activities = await AuditLog.aggregate([
        {$match: {quotationId: {$in: quotationIds}}},
        {$sort: {createdAt: -1}},
        {
            $group: {
                _id: '$quotationId',
                action: {$first: '$action'},
                timestamp: {$first: '$createdAt'},
                actorRole: {$first: '$actorRole'}
            }
        }
    ]);

    return new Map(activities.map((activity) => [activity._id.toString(), activity]));
};

const buildQuotationFilter = async (query, user) => {
    const filter = {};

    if (user.role === USER_ROLES.SALES_REP) {
        filter.ownerId = user.id;
    }

    if (query.status) {
        filter.status = query.status;
    }

    if (query.customerId) {
        validateObjectId(query.customerId, 'customer id');
        filter.customerId = query.customerId;
    }

    if (query.customer) {
        if (mongoose.Types.ObjectId.isValid(query.customer)) {
            filter.customerId = query.customer;
        } else {
            const customerRegex = new RegExp(escapeRegex(query.customer.trim()), 'i');
            const matchingCustomers = await Customer.find({
                $or: [
                    {name: customerRegex},
                    {company: customerRegex},
                    {email: customerRegex}
                ]
            }).select('_id');
            filter.customerId = {$in: matchingCustomers.map((customer) => customer._id)};
        }
    }

    if (query.date && !query.dateFrom && !query.dateTo) {
        const date = new Date(query.date);

        if (Number.isNaN(date.getTime())) {
            throw new ApiError(400, 'date must be a valid date');
        }

        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);
        filter.createdAt = {$gte: date, $lt: nextDate};
    }

    if (query.dateFrom || query.dateTo) {
        filter.createdAt = {};

        if (query.dateFrom) {
            const dateFrom = new Date(query.dateFrom);

            if (Number.isNaN(dateFrom.getTime())) {
                throw new ApiError(400, 'dateFrom must be a valid date');
            }

            filter.createdAt.$gte = dateFrom;
        }

        if (query.dateTo) {
            const dateTo = new Date(query.dateTo);

            if (Number.isNaN(dateTo.getTime())) {
                throw new ApiError(400, 'dateTo must be a valid date');
            }

            filter.createdAt.$lte = dateTo;
        }
    }

    if (query.search?.trim()) {
        const searchRegex = new RegExp(escapeRegex(query.search.trim()), 'i');
        const matchingCustomers = await Customer.find({
            $or: [
                {name: searchRegex},
                {company: searchRegex},
                {email: searchRegex}
            ]
        }).select('_id');

        filter.$or = [
            {quoteNumber: searchRegex},
            {customerId: {$in: matchingCustomers.map((customer) => customer._id)}}
        ];
    }

    return filter;
};

const toQuotationListItem = (quotation, lastActivity) => ({
    id: quotation._id,
    quoteNumber: quotation.quoteNumber,
    customer: quotation.customerId ? {
        id: quotation.customerId._id,
        name: quotation.customerId.name,
        company: quotation.customerId.company
    } : null,
    total: quotation.grandTotal,
    status: quotation.status,
    approvalStatus: quotation.approvalStatus,
    riskSeverity: quotation.riskSeverity,
    owner: quotation.ownerId ? {
        id: quotation.ownerId._id,
        fullName: quotation.ownerId.fullName,
        email: quotation.ownerId.email
    } : null,
    createdAt: quotation.createdAt,
    lastActivity: lastActivity ? {
        action: lastActivity.action,
        actorRole: lastActivity.actorRole,
        timestamp: lastActivity.timestamp
    } : {
        action: 'UPDATED',
        actorRole: null,
        timestamp: quotation.updatedAt
    }
});

const assertCanEditQuotation = async (quotation, user, reason) => {
    if (
        user.role === USER_ROLES.SALES_REP &&
        quotation.ownerId.toString() !== user.id.toString()
    ) {
        throw new ApiError(403, 'Sales reps can only update their own quotations');
    }

    if ([QUOTATION_STATUSES.REJECTED, QUOTATION_STATUSES.CONFIRMED, QUOTATION_STATUSES.EXPIRED, QUOTATION_STATUSES.CANCELLED].includes(quotation.status)) {
        throw new ApiError(400, `Quotation cannot be edited while ${quotation.status}`);
    }

    return prepareQuotationForMaterialChange(quotation, {actor: user, reason});
};

const listQuotations = asyncHandler(async (req, res) => {
    const filter = await buildQuotationFilter(req.query, req.user);
    const quotations = await Quotation.find(filter)
    .populate('customerId', 'name company tierId')
    .populate('salesRepId', 'fullName email role')
    .populate('ownerId', 'fullName email role')
    .sort({createdAt: -1});
    const lastActivityMap = await getLastActivityMap(quotations.map((quotation) => quotation._id));
    const items = quotations.map((quotation) => toQuotationListItem(
        quotation,
        lastActivityMap.get(quotation._id.toString())
    ));

    return res
    .status(200)
    .json(new ApiResponse(200, {quotations: items}, 'Quotations fetched successfully'));
});

const getQuotationPipeline = asyncHandler(async (req, res) => {
    const filter = await buildQuotationFilter(req.query, req.user);
    const quotations = await Quotation.find(filter)
    .populate('customerId', 'name company')
    .populate('ownerId', 'fullName email role')
    .sort({updatedAt: -1});
    const lastActivityMap = await getLastActivityMap(quotations.map((quotation) => quotation._id));
    const stageOrder = Object.values(QUOTATION_STATUSES);
    const stageMap = new Map(stageOrder.map((status) => [status, {
        status,
        title: status.replace(/_/g, ' '),
        count: 0,
        cards: []
    }]));

    for (const quotation of quotations) {
        if (!stageMap.has(quotation.status)) {
            stageMap.set(quotation.status, {
                status: quotation.status,
                title: quotation.status.replace(/_/g, ' '),
                count: 0,
                cards: []
            });
        }

        const lastActivity = lastActivityMap.get(quotation._id.toString());
        const stage = stageMap.get(quotation.status);
        stage.cards.push({
            quotationId: quotation._id,
            quoteNumber: quotation.quoteNumber,
            customer: quotation.customerId ? {
                id: quotation.customerId._id,
                name: quotation.customerId.name,
                company: quotation.customerId.company
            } : null,
            amount: quotation.grandTotal,
            riskSeverity: quotation.riskSeverity,
            owner: quotation.ownerId ? {
                id: quotation.ownerId._id,
                fullName: quotation.ownerId.fullName,
                email: quotation.ownerId.email
            } : null,
            lastActivity: lastActivity ? {
                action: lastActivity.action,
                actorRole: lastActivity.actorRole,
                timestamp: lastActivity.timestamp
            } : {
                action: 'UPDATED',
                actorRole: null,
                timestamp: quotation.updatedAt
            },
            approvalState: quotation.approvalStatus
        });
        stage.count = stage.cards.length;
    }

    return res
    .status(200)
    .json(new ApiResponse(200, {stages: Array.from(stageMap.values())}, 'Quotation pipeline fetched successfully'));
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

    await createAuditLog({
        actor: req.user,
        action: AUDIT_ACTIONS.QUOTATION_CREATED,
        entityType: 'Quotation',
        entityId: quotation._id,
        quotationId: quotation._id,
        customerId: customer._id,
        after: {
            quoteNumber: quotation.quoteNumber,
            status: quotation.status,
            currentVersion: quotation.currentVersion
        }
    });

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

const getQuotationDetail = asyncHandler(async (req, res) => {
    validateObjectId(req.params.quotationId, 'quotation id');

    const {quotation, lines} = await loadQuotationWithLines(req.params.quotationId);

    if (!quotation) {
        throw new ApiError(404, 'Quotation not found');
    }

    if (
        req.user.role === USER_ROLES.SALES_REP &&
        quotation.ownerId._id.toString() !== req.user.id.toString()
    ) {
        throw new ApiError(403, 'Sales reps can only view their own quotations');
    }

    return res
    .status(200)
    .json(new ApiResponse(200, {quotation, lines}, 'Quotation detail fetched successfully'));
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

    let quotation = await Quotation.findById(req.params.quotationId);

    if (!quotation) {
        throw new ApiError(404, 'Quotation not found');
    }

    quotation = await assertCanEditQuotation(quotation, req.user, 'Product added to quotation');

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

    await createAuditLog({
        actor: req.user,
        action: AUDIT_ACTIONS.QUOTATION_LINE_ADDED,
        entityType: 'QuotationLine',
        entityId: line._id,
        quotationId: quotation._id,
        customerId: quotation.customerId,
        after: line.toObject(),
        metadata: {
            quotationVersion: updatedQuotation.currentVersion,
            pricingSource: pricing.source
        }
    });

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

    let quotation = await Quotation.findById(req.params.quotationId);

    if (!quotation) {
        throw new ApiError(404, 'Quotation not found');
    }

    quotation = await assertCanEditQuotation(quotation, req.user, 'Quotation line changed');

    const line = await QuotationLine.findOne({
        _id: req.params.lineId,
        quotationId: quotation._id
    });

    if (!line) {
        throw new ApiError(404, 'Quotation line not found');
    }

    const beforeLine = line.toObject();

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

    await createAuditLog({
        actor: req.user,
        action: AUDIT_ACTIONS.QUOTATION_LINE_CHANGED,
        entityType: 'QuotationLine',
        entityId: line._id,
        quotationId: quotation._id,
        customerId: quotation.customerId,
        before: beforeLine,
        after: line.toObject(),
        metadata: {quotationVersion: updatedQuotation.currentVersion}
    });

    if (beforeLine.discountPercent !== line.discountPercent) {
        await createAuditLog({
            actor: req.user,
            action: AUDIT_ACTIONS.DISCOUNT_CHANGED,
            entityType: 'QuotationLine',
            entityId: line._id,
            quotationId: quotation._id,
            customerId: quotation.customerId,
            before: {discountPercent: beforeLine.discountPercent},
            after: {
                discountPercent: line.discountPercent,
                allowed_discount: line.allowed_discount,
                excess_discount: line.excess_discount,
                is_violation: line.is_violation
            },
            metadata: {quotationVersion: updatedQuotation.currentVersion}
        });
    }

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

    if (![QUOTATION_STATUSES.DRAFT, QUOTATION_STATUSES.RETURNED_FOR_REVISION, QUOTATION_STATUSES.REAPPROVAL_REQUIRED].includes(quotation.status)) {
        throw new ApiError(400, 'Only draft or revision quotations can be submitted');
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

    const riskedQuotation = await Quotation.findByIdAndUpdate(
        quotation._id,
        {
            $set: {
                approvalStatus: nextApprovalStatus,
                riskScore: risk.totalRiskScore,
                riskSeverity: risk.severity
            }
        },
        {new: true, runValidators: true}
    );

    const updatedQuotation = await transitionQuotationState(riskedQuotation, nextQuotationStatus, {
        actor: req.user,
        reason: 'Quotation submitted',
        metadata: {
            riskScore: risk.totalRiskScore,
            riskSeverity: risk.severity,
            approvalRequired: approvalDecision.approvalRequired
        }
    });

    await createAuditLog({
        actor: req.user,
        action: AUDIT_ACTIONS.RISK_CALCULATED,
        entityType: 'Quotation',
        entityId: quotation._id,
        quotationId: quotation._id,
        customerId: quotation.customerId,
        after: risk,
        metadata: {quotationVersion: updatedQuotation.currentVersion}
    });

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

        await createAuditLog({
            actor: req.user,
            action: AUDIT_ACTIONS.APPROVAL_CREATED,
            entityType: 'ApprovalRequest',
            entityId: approvalRequest._id,
            quotationId: quotation._id,
            customerId: quotation.customerId,
            after: approvalRequest.toObject(),
            metadata: {
                quotationVersion: updatedQuotation.currentVersion,
                approvalRuleId: approvalDecision.rule._id
            }
        });
    }

    await createQuotationVersionSnapshot(quotation._id, {
        actor: req.user,
        reason: 'Quotation submitted'
    });

    await createAuditLog({
        actor: req.user,
        action: AUDIT_ACTIONS.QUOTATION_SUBMITTED,
        entityType: 'Quotation',
        entityId: quotation._id,
        quotationId: quotation._id,
        customerId: quotation.customerId,
        after: {
            status: updatedQuotation.status,
            approvalStatus: updatedQuotation.approvalStatus,
            currentVersion: updatedQuotation.currentVersion,
            riskScore: updatedQuotation.riskScore,
            riskSeverity: updatedQuotation.riskSeverity
        }
    });

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

const listQuotationVersions = asyncHandler(async (req, res) => {
    validateObjectId(req.params.quotationId, 'quotation id');

    const versions = await QuotationVersion.find({quotationId: req.params.quotationId})
    .select('-lines')
    .sort({versionNumber: -1});

    return res
    .status(200)
    .json(new ApiResponse(200, {versions}, 'Quotation versions fetched successfully'));
});

const getQuotationVersion = asyncHandler(async (req, res) => {
    validateObjectId(req.params.quotationId, 'quotation id');

    const versionNumber = Number(req.params.versionNumber);

    if (!Number.isInteger(versionNumber) || versionNumber < 1) {
        throw new ApiError(400, 'Invalid quotation version number');
    }

    const version = await QuotationVersion.findOne({
        quotationId: req.params.quotationId,
        versionNumber
    });

    if (!version) {
        throw new ApiError(404, 'Quotation version not found');
    }

    return res
    .status(200)
    .json(new ApiResponse(200, {version}, 'Quotation version fetched successfully'));
});

const getConfirmedQuotationOrderSnapshot = asyncHandler(async (req, res) => {
    validateObjectId(req.params.quotationId, 'quotation id');

    const snapshot = await buildConfirmedQuotationOrderSnapshot(req.params.quotationId);

    return res
    .status(200)
    .json(new ApiResponse(200, {snapshot}, 'Confirmed quotation order snapshot fetched successfully'));
});

const sendQuotationToCustomer = asyncHandler(async (req, res) => {
    validateObjectId(req.params.quotationId, 'quotation id');

    const quotation = await Quotation.findById(req.params.quotationId);

    if (!quotation) {
        throw new ApiError(404, 'Quotation not found');
    }

    if (
        req.user.role === USER_ROLES.SALES_REP &&
        quotation.ownerId.toString() !== req.user.id.toString()
    ) {
        throw new ApiError(403, 'Sales reps can only send their own quotations');
    }

    if (![QUOTATION_STATUSES.APPROVED, QUOTATION_STATUSES.READY_FOR_CUSTOMER].includes(quotation.status)) {
        throw new ApiError(400, 'Only approved or customer-ready quotations can be sent to the customer');
    }

    if (![APPROVAL_STATUSES.APPROVED, APPROVAL_STATUSES.NOT_REQUIRED].includes(quotation.approvalStatus)) {
        throw new ApiError(409, 'Quotation has unresolved approval requirements');
    }

    const updatedQuotation = await transitionQuotationState(quotation, QUOTATION_STATUSES.SENT_TO_CUSTOMER, {
        actor: req.user,
        reason: req.body.reason || 'Quotation sent to customer'
    });

    await createAuditLog({
        actor: req.user,
        action: AUDIT_ACTIONS.QUOTATION_SENT_TO_CUSTOMER,
        entityType: 'Quotation',
        entityId: quotation._id,
        quotationId: quotation._id,
        customerId: quotation.customerId,
        reason: req.body.reason || null,
        after: {
            status: updatedQuotation.status,
            currentVersion: updatedQuotation.currentVersion
        }
    });

    return res
    .status(200)
    .json(new ApiResponse(200, {quotation: updatedQuotation}, 'Quotation sent to customer successfully'));
});

const confirmQuotation = asyncHandler(async (req, res) => {
    validateObjectId(req.params.quotationId, 'quotation id');

    const quotation = await Quotation.findById(req.params.quotationId);

    if (!quotation) {
        throw new ApiError(404, 'Quotation not found');
    }

    if (req.user.role !== USER_ROLES.CUSTOMER) {
        throw new ApiError(403, 'Only customers can confirm quotations');
    }

    if (![QUOTATION_STATUSES.APPROVED, QUOTATION_STATUSES.READY_FOR_CUSTOMER, QUOTATION_STATUSES.SENT_TO_CUSTOMER].includes(quotation.status)) {
        throw new ApiError(400, 'Only approved or customer-ready quotations can be confirmed');
    }

    if (![APPROVAL_STATUSES.APPROVED, APPROVAL_STATUSES.NOT_REQUIRED].includes(quotation.approvalStatus)) {
        throw new ApiError(400, 'Quotation has an unresolved approval requirement');
    }

    const pendingApproval = await ApprovalRequest.exists({
        quotationId: quotation._id,
        quotationVersion: quotation.currentVersion,
        status: APPROVAL_STATUSES.PENDING
    });

    if (pendingApproval) {
        throw new ApiError(400, 'Quotation has an unresolved approval requirement');
    }

    const before = {
        status: quotation.status,
        currentVersion: quotation.currentVersion
    };

    quotation.confirmedById = req.user.id;
    quotation.confirmedAt = new Date();
    quotation.confirmedVersion = quotation.currentVersion;

    const updatedQuotation = await transitionQuotationState(quotation, QUOTATION_STATUSES.CONFIRMED, {
        actor: req.user,
        reason: req.body.reason || 'Quotation confirmed'
    });

    await createAuditLog({
        actor: req.user,
        action: AUDIT_ACTIONS.QUOTATION_CONFIRMED,
        entityType: 'Quotation',
        entityId: quotation._id,
        quotationId: quotation._id,
        customerId: quotation.customerId,
        reason: req.body.reason || null,
        before,
        after: {
            status: updatedQuotation.status,
            currentVersion: updatedQuotation.currentVersion,
            confirmedById: updatedQuotation.confirmedById,
            confirmedAt: updatedQuotation.confirmedAt,
            confirmedVersion: updatedQuotation.confirmedVersion
        }
    });

    return res
    .status(200)
    .json(new ApiResponse(200, {quotation: updatedQuotation}, 'Quotation confirmed successfully'));
});

const listCustomerPortalQuotations = asyncHandler(async (req, res) => {
    const quotations = await Quotation.find({
        customerId: req.user.customerId,
        status: {$nin: [QUOTATION_STATUSES.DRAFT, QUOTATION_STATUSES.PENDING_APPROVAL]}
    })
    .select('quoteNumber status grandTotal currencyCode createdAt updatedAt')
    .sort({updatedAt: -1});

    const items = quotations.map((quotation) => ({
        id: quotation._id,
        quoteNumber: quotation.quoteNumber,
        status: quotation.status,
        grandTotal: quotation.grandTotal,
        currencyCode: quotation.currencyCode,
        updatedAt: quotation.updatedAt
    }));

    return res
    .status(200)
    .json(new ApiResponse(200, {quotations: items}, 'Portal quotations fetched successfully'));
});

const getCustomerPortalQuotation = asyncHandler(async (req, res) => {
    const quotation = await Quotation.findById(req.params.quotationId)
    .select('quoteNumber customerId status currencyCode subtotal totalDiscount totalRevenueAfterDiscount tax grandTotal currentVersion createdAt updatedAt')
    .populate('customerId', 'name company email');

    if (!quotation) {
        throw new ApiError(404, 'Quotation not found');
    }

    const [lines, negotiations, messages] = await Promise.all([
        QuotationLine.find({quotationId: quotation._id})
        .select('productId variantId lineType quantity unitPrice discountPercent taxPercentage tax lineSubtotal discountAmount revenueAfterDiscount lineTotal description createdAt updatedAt')
        .populate('productId', 'name description productType billingType unit')
        .populate('variantId', 'sku name attributes extraPrice')
        .sort({createdAt: 1}),
        Negotiation.find({quotationId: quotation._id})
        .select('status submittedById createdAt updatedAt')
        .populate('submittedById', 'fullName role')
        .sort({createdAt: -1}),
        NegotiationMessage.find({quotationId: quotation._id})
        .select('negotiationId quotationVersion quotationLineId messageType message proposedValue senderId senderRole createdAt')
        .populate('senderId', 'fullName role')
        .sort({createdAt: 1})
    ]);

    const portalQuotation = {
        id: quotation._id,
        quoteNumber: quotation.quoteNumber,
        status: quotation.status,
        currencyCode: quotation.currencyCode,
        version: quotation.currentVersion,
        customer: quotation.customerId ? {
            name: quotation.customerId.name,
            company: quotation.customerId.company,
            email: quotation.customerId.email
        } : null,
        totals: {
            subtotal: quotation.subtotal,
            totalDiscount: quotation.totalDiscount,
            revenueAfterDiscount: quotation.totalRevenueAfterDiscount,
            tax: quotation.tax,
            grandTotal: quotation.grandTotal
        },
        lines: lines.map((line) => ({
            id: line._id,
            product: line.productId ? {
                id: line.productId._id,
                name: line.productId.name,
                description: line.productId.description,
                productType: line.productId.productType,
                billingType: line.productId.billingType,
                unit: line.productId.unit
            } : null,
            variant: line.variantId ? {
                id: line.variantId._id,
                sku: line.variantId.sku,
                name: line.variantId.name,
                attributes: line.variantId.attributes,
                extraPrice: line.variantId.extraPrice
            } : null,
            lineType: line.lineType,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discountPercent: line.discountPercent,
            taxPercentage: line.taxPercentage,
            tax: line.tax,
            lineSubtotal: line.lineSubtotal,
            discountAmount: line.discountAmount,
            revenueAfterDiscount: line.revenueAfterDiscount,
            lineTotal: line.lineTotal,
            description: line.description
        })),
        negotiationHistory: {
            negotiations: negotiations.map((negotiation) => ({
                id: negotiation._id,
                status: negotiation.status,
                submittedBy: negotiation.submittedById ? {
                    name: negotiation.submittedById.fullName,
                    role: negotiation.submittedById.role
                } : null,
                createdAt: negotiation.createdAt,
                updatedAt: negotiation.updatedAt
            })),
            messages: messages.map((message) => ({
                id: message._id,
                negotiationId: message.negotiationId,
                quotationVersion: message.quotationVersion,
                quotationLineId: message.quotationLineId,
                messageType: message.messageType,
                message: message.message,
                proposedValue: message.proposedValue,
                sender: message.senderId ? {
                    name: message.senderId.fullName,
                    role: message.senderRole
                } : {
                    name: null,
                    role: message.senderRole
                },
                createdAt: message.createdAt
            }))
        },
        createdAt: quotation.createdAt,
        updatedAt: quotation.updatedAt
    };

    return res
    .status(200)
    .json(new ApiResponse(200, {quotation: portalQuotation}, 'Portal quotation fetched successfully'));
});

export {
    listQuotations,
    getQuotationPipeline,
    createDraftQuotation,
    getQuotationDetail,
    addProductToQuotation,
    updateQuotationLine,
    submitQuotation,
    listQuotationVersions,
    getQuotationVersion,
    getConfirmedQuotationOrderSnapshot,
    sendQuotationToCustomer,
    confirmQuotation,
    getCustomerPortalQuotation,
    listCustomerPortalQuotations
};
