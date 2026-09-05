import {QuotationLine} from '../quotationLines/quotationLine.model.js';
import {AUDIT_ACTIONS, APPROVAL_STATUSES, CUSTOMER_STATUSES, QUOTATION_STATUSES} from '../../core/constants.js';
import {ApiError} from '../../core/utils/apiError.js';
import {ApprovalRequest} from '../approvals/approval.model.js';
import {createAuditLog} from '../auditLogs/auditLogs.service.js';
import {Customer} from '../customers/customer.model.js';
import {getAllowedDiscount} from '../discountRules/discountRules.service.js';
import {resolveSellingPrice} from '../priceLists/priceLists.service.js';
import {Product} from '../products/product.model.js';
import {ProductVariant} from '../products/productVariant.model.js';
import {Quotation} from './quotation.model.js';
import {QuotationVersion} from './quotationVersion.model.js';
import {transitionQuotationState} from './quotationState.service.js';
import {listSubscriptionsByQuoteLineIds} from '../subscriptions/subscription.service.js';

const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const roundPercent = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const calculateLineAmounts = ({quantity, unitPrice, costPrice, discountPercent, taxPercentage, allowedDiscountPercent}) => {
    const lineSubtotal = roundMoney(unitPrice * quantity);
    const discountAmount = roundMoney(lineSubtotal * (discountPercent / 100));
    const revenueAfterDiscount = roundMoney(lineSubtotal - discountAmount);
    const totalCost = roundMoney(costPrice * quantity);
    const tax = roundMoney(revenueAfterDiscount * (taxPercentage / 100));
    const lineTotal = roundMoney(revenueAfterDiscount + tax);
    const marginAmount = roundMoney(revenueAfterDiscount - totalCost);
    const marginPercentage = revenueAfterDiscount > 0
        ? roundPercent((marginAmount / revenueAfterDiscount) * 100)
        : 0;
    const excessDiscount = Math.max(0, roundPercent(discountPercent - allowedDiscountPercent));
    const isViolation = excessDiscount > 0;

    return {
        lineSubtotal,
        discountAmount,
        revenueAfterDiscount,
        totalCost,
        tax,
        lineTotal,
        margin: marginAmount,
        marginAmount,
        grossMarginAmount: marginAmount,
        marginPercentage,
        allowed_discount: allowedDiscountPercent,
        actual_discount: discountPercent,
        excess_discount: excessDiscount,
        is_violation: isViolation,
        violationAmount: excessDiscount
    };
};

const calculateQuotationTotals = async (quotationId) => {
    const lines = await QuotationLine.find({quotationId});

    return lines.reduce((totals, line) => {
        totals.subtotal = roundMoney(totals.subtotal + line.lineSubtotal);
        totals.totalDiscount = roundMoney(totals.totalDiscount + line.discountAmount);
        totals.totalRevenueAfterDiscount = roundMoney(totals.totalRevenueAfterDiscount + line.revenueAfterDiscount);
        totals.totalCost = roundMoney(totals.totalCost + line.totalCost);
        totals.tax = roundMoney(totals.tax + line.tax);
        totals.grandTotal = roundMoney(totals.grandTotal + line.lineTotal);
        totals.margin = roundMoney(totals.margin + line.marginAmount);
        totals.totalMarginAmount = roundMoney(totals.totalMarginAmount + line.marginAmount);
        totals.grossMarginAmount = totals.totalMarginAmount;
        totals.riskScore = Math.max(totals.riskScore, Number(line.excess_discount ?? line.violationAmount ?? 0));
        totals.marginPercentage = totals.totalRevenueAfterDiscount > 0
            ? roundPercent((totals.totalMarginAmount / totals.totalRevenueAfterDiscount) * 100)
            : 0;

        return totals;
    }, {
        subtotal: 0,
        totalDiscount: 0,
        totalRevenueAfterDiscount: 0,
        totalCost: 0,
        tax: 0,
        grandTotal: 0,
        margin: 0,
        totalMarginAmount: 0,
        grossMarginAmount: 0,
        marginPercentage: 0,
        riskScore: 0
    });
};

const buildQuotationSnapshot = async (quotationId) => {
    const [quotation, lines] = await Promise.all([
        Quotation.findById(quotationId).lean(),
        QuotationLine.find({quotationId}).lean().sort({createdAt: 1})
    ]);

    if (!quotation) {
        throw new ApiError(404, 'Quotation not found');
    }

    return {
        quotation,
        lines,
        totals: {
            subtotal: quotation.subtotal,
            totalDiscount: quotation.totalDiscount,
            totalRevenueAfterDiscount: quotation.totalRevenueAfterDiscount,
            totalCost: quotation.totalCost,
            tax: quotation.tax,
            grandTotal: quotation.grandTotal,
            margin: quotation.margin,
            totalMarginAmount: quotation.totalMarginAmount,
            grossMarginAmount: quotation.grossMarginAmount,
            marginPercentage: quotation.marginPercentage
        }
    };
};

const createQuotationVersionSnapshot = async (quotationId, {actor = null, reason = null} = {}) => {
    const {quotation, lines, totals} = await buildQuotationSnapshot(quotationId);
    const existingVersion = await QuotationVersion.findOne({
        quotationId,
        versionNumber: quotation.currentVersion
    });

    if (existingVersion) {
        return existingVersion;
    }

    const version = await QuotationVersion.create({
        quotationId,
        versionNumber: quotation.currentVersion,
        status: quotation.status,
        approvalStatus: quotation.approvalStatus,
        riskScore: quotation.riskScore,
        riskSeverity: quotation.riskSeverity,
        totals,
        lines,
        snapshotReason: reason,
        createdById: actor?.id || actor?._id || null
    });

    await createAuditLog({
        actor,
        action: AUDIT_ACTIONS.QUOTATION_VERSION_CREATED,
        entityType: 'QuotationVersion',
        entityId: version._id,
        quotationId,
        customerId: quotation.customerId,
        reason,
        after: {
            versionNumber: version.versionNumber,
            status: version.status,
            approvalStatus: version.approvalStatus
        }
    });

    return version;
};

const prepareQuotationForMaterialChange = async (quotation, {actor = null, reason = 'Material quotation change'} = {}) => {
    const draftLikeStatuses = [
        QUOTATION_STATUSES.DRAFT,
        QUOTATION_STATUSES.REAPPROVAL_REQUIRED
    ];

    if (draftLikeStatuses.includes(quotation.status)) {
        return quotation;
    }

    const before = {
        status: quotation.status,
        currentVersion: quotation.currentVersion,
        approvalStatus: quotation.approvalStatus
    };

    await createQuotationVersionSnapshot(quotation._id, {actor, reason});

    await ApprovalRequest.updateMany(
        {quotationId: quotation._id, status: APPROVAL_STATUSES.PENDING},
        {$set: {status: APPROVAL_STATUSES.CANCELLED}}
    );

    quotation.currentVersion += 1;
    quotation.approvalStatus = APPROVAL_STATUSES.PENDING;
    await transitionQuotationState(quotation, QUOTATION_STATUSES.REAPPROVAL_REQUIRED, {
        actor,
        reason,
        metadata: {materialChange: true}
    });

    await createAuditLog({
        actor,
        action: AUDIT_ACTIONS.QUOTATION_VERSION_CREATED,
        entityType: 'Quotation',
        entityId: quotation._id,
        quotationId: quotation._id,
        customerId: quotation.customerId,
        reason,
        before,
        after: {
            status: quotation.status,
            currentVersion: quotation.currentVersion,
            approvalStatus: quotation.approvalStatus
        },
        metadata: {type: 'NEW_EDITABLE_VERSION'}
    });

    return quotation;
};

const recalculateQuotationCommercials = async (quotationId) => {
    const quotation = await Quotation.findById(quotationId);

    if (!quotation) {
        throw new ApiError(404, 'Quotation not found');
    }

    const customer = await Customer.findById(quotation.customerId)
    .populate('tierId', 'name defaultMaxDiscountPercent isActive');

    if (!customer || customer.status !== CUSTOMER_STATUSES.ACTIVE) {
        throw new ApiError(400, 'Active customer not found');
    }

    const lines = await QuotationLine.find({quotationId});

    for (const line of lines) {
        const product = await Product.findById(line.productId).populate('categoryId', 'name maxAllowedDiscountPercent isActive');

        if (!product || product.isActive === false) {
            throw new ApiError(400, `Active product not found for quotation line ${line._id}`);
        }

        const variant = line.variantId
            ? await ProductVariant.findOne({_id: line.variantId, productId: product._id, isActive: true})
            : null;

        if (line.variantId && !variant) {
            throw new ApiError(400, `Active product variant not found for quotation line ${line._id}`);
        }

        const pricing = line.isNegotiatedPrice
            ? {sellingPrice: line.unitPrice, source: 'NEGOTIATED_PRICE'}
            : await resolveSellingPrice({
                customer,
                product,
                variant,
                currencyCode: quotation.currencyCode
            });
        const allowedDiscount = await getAllowedDiscount(customer, product);
        const amounts = calculateLineAmounts({
            quantity: line.quantity,
            unitPrice: pricing.sellingPrice,
            costPrice: product.costPrice,
            discountPercent: line.discountPercent,
            taxPercentage: product.taxPercentage,
            allowedDiscountPercent: allowedDiscount.allowedDiscountPercent
        });

        line.unitPrice = pricing.sellingPrice;
        line.costPrice = product.costPrice;
        line.taxPercentage = product.taxPercentage;
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
    }

    const totals = await calculateQuotationTotals(quotationId);
    const updatedQuotation = await Quotation.findByIdAndUpdate(
        quotationId,
        {$set: totals},
        {new: true, runValidators: true}
    );

    return {
        quotation: updatedQuotation,
        lines: await QuotationLine.find({quotationId}).sort({createdAt: 1})
    };
};

const buildConfirmedQuotationOrderSnapshot = async (quotationId) => {
    const quotation = await Quotation.findById(quotationId).lean();

    if (!quotation) {
        throw new ApiError(404, 'Quotation not found');
    }

    if (quotation.status !== QUOTATION_STATUSES.CONFIRMED) {
        throw new ApiError(400, 'Only confirmed quotations can be converted into orders');
    }

    const lines = await QuotationLine.find({quotationId})
    .populate('productId', 'billingType recurringPlanReference')
    .populate('variantId', 'sku name attributes')
    .lean()
    .sort({createdAt: 1});

    // PRD B7: recurring lines need their billing schedule shown alongside
    // the order, so look up each line's originating subscription (if any).
    const recurringLineIds = lines.filter((line) => line.lineType === 'RECURRING').map((line) => line._id);
    const subscriptions = await listSubscriptionsByQuoteLineIds(recurringLineIds);
    const subscriptionByLineId = new Map(
        subscriptions.map((subscription) => [subscription.originating_quote_line_id.toString(), subscription])
    );

    return {
        quotationId: quotation._id,
        quotationVersion: quotation.confirmedVersion || quotation.currentVersion,
        customerId: quotation.customerId,
        currency: quotation.currencyCode,
        confirmedAt: quotation.confirmedAt,
        confirmedById: quotation.confirmedById,
        totals: {
            subtotal: quotation.subtotal,
            totalDiscount: quotation.totalDiscount,
            revenueAfterDiscount: quotation.totalRevenueAfterDiscount,
            tax: quotation.tax,
            grandTotal: quotation.grandTotal
        },
        lines: lines.map((line) => {
            const subscription = subscriptionByLineId.get(line._id.toString()) || null;

            return {
                quotationLineId: line._id,
                productId: line.productId?._id || line.productId,
                variant: line.variantId ? {
                    id: line.variantId._id,
                    sku: line.variantId.sku,
                    name: line.variantId.name,
                    attributes: line.variantId.attributes || {}
                } : null,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                discount: {
                    percent: line.discountPercent,
                    amount: line.discountAmount
                },
                tax: {
                    percent: line.taxPercentage,
                    amount: line.tax
                },
                lineTotal: line.lineTotal,
                revenueAfterDiscount: line.revenueAfterDiscount,
                type: line.lineType,
                recurringPlanReference: line.lineType === 'RECURRING'
                    ? line.productId?.recurringPlanReference || null
                    : null,
                subscription: subscription ? {
                    id: subscription._id,
                    status: subscription.status,
                    qty: subscription.qty,
                    recurringUnitPriceCents: subscription.recurring_unit_price_cents,
                    nextBillDate: subscription.next_bill_date,
                    currentPeriodStart: subscription.current_period_start,
                    currentPeriodEnd: subscription.current_period_end,
                    plan: subscription.plan_id ? {
                        id: subscription.plan_id._id,
                        name: subscription.plan_id.name,
                        cycle: subscription.plan_id.cycle
                    } : null
                } : null
            };
        })
    };
};

const quotationsService = Object.freeze({
    moduleName: 'quotations',
    calculateLineAmounts,
    calculateQuotationTotals,
    buildConfirmedQuotationOrderSnapshot,
    createQuotationVersionSnapshot,
    prepareQuotationForMaterialChange,
    recalculateQuotationCommercials,
    roundMoney,
    roundPercent
});

export {
    quotationsService,
    calculateLineAmounts,
    calculateQuotationTotals,
    buildConfirmedQuotationOrderSnapshot,
    createQuotationVersionSnapshot,
    prepareQuotationForMaterialChange,
    recalculateQuotationCommercials,
    roundMoney,
    roundPercent
};
