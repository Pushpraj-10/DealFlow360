import {
    APPROVAL_STATUSES,
    AUDIT_ACTIONS,
    NEGOTIATION_MESSAGE_TYPES,
    QUOTATION_STATUSES,
    USER_ROLES
} from '../../core/constants.js';
import {ApiError} from '../../core/utils/apiError.js';
import {ApprovalRequest} from '../approvals/approval.model.js';
import {
    buildApprovalStepsFromRoles,
    evaluateApprovalRule
} from '../approvals/approvals.service.js';
import {createAuditLog} from '../auditLogs/auditLogs.service.js';
import {Customer} from '../customers/customer.model.js';
import {getAllowedDiscount} from '../discountRules/discountRules.service.js';
import {Product} from '../products/product.model.js';
import {QuotationLine} from '../quotationLines/quotationLine.model.js';
import {calculateQuotationRisk} from '../riskEngine/riskEngine.service.js';
import {Quotation} from '../quotations/quotation.model.js';
import {transitionQuotationState} from '../quotations/quotationState.service.js';
import {
    calculateLineAmounts,
    calculateQuotationTotals,
    createQuotationVersionSnapshot,
    prepareQuotationForMaterialChange,
    recalculateQuotationCommercials
} from '../quotations/quotations.service.js';
import {Negotiation, NegotiationMessage} from './negotiation.model.js';

const parseDiscountPercent = (value) => {
    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
        throw new ApiError(400, 'Proposed discount percentage must be between 0 and 100');
    }

    return parsed;
};

const parseOptionalPositiveNumber = (value, label) => {
    if (value === undefined || value === null) {
        return null;
    }

    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new ApiError(400, `${label} must be greater than 0`);
    }

    return parsed;
};

const openNegotiationIfNeeded = async (quotation, {actor, openReason, transitionReason, negotiationId}) => {
    if (quotation.status === QUOTATION_STATUSES.UNDER_NEGOTIATION) {
        return;
    }

    await createQuotationVersionSnapshot(quotation._id, {
        actor,
        reason: openReason
    });

    await transitionQuotationState(quotation, QUOTATION_STATUSES.UNDER_NEGOTIATION, {
        actor,
        reason: transitionReason,
        metadata: {negotiationId}
    });
};

const createApprovalWorkflowForChangedQuote = async ({quotation, risk, approvalDecision, actor, reason}) => {
    const nextQuotationStatus = approvalDecision.approvalRequired
        ? QUOTATION_STATUSES.PENDING_APPROVAL
        : QUOTATION_STATUSES.READY_FOR_CUSTOMER;
    const nextApprovalStatus = approvalDecision.approvalRequired
        ? APPROVAL_STATUSES.PENDING
        : APPROVAL_STATUSES.NOT_REQUIRED;

    quotation.approvalStatus = nextApprovalStatus;
    quotation.riskScore = risk.totalRiskScore;
    quotation.riskSeverity = risk.severity;
    await quotation.save();

    const updatedQuotation = await transitionQuotationState(quotation, nextQuotationStatus, {
        actor,
        reason,
        metadata: {
            negotiatedChange: true,
            riskScore: risk.totalRiskScore,
            riskSeverity: risk.severity,
            approvalRequired: approvalDecision.approvalRequired
        }
    });

    let approvalRequest = null;

    if (approvalDecision.approvalRequired) {
        await ApprovalRequest.updateMany(
            {quotationId: quotation._id, status: APPROVAL_STATUSES.PENDING},
            {$set: {status: APPROVAL_STATUSES.CANCELLED}}
        );

        approvalRequest = await ApprovalRequest.create({
            quotationId: quotation._id,
            quotationVersion: quotation.currentVersion,
            requestedById: actor.id,
            status: APPROVAL_STATUSES.PENDING,
            riskLevel: risk.severity,
            riskScore: risk.totalRiskScore,
            totalExcessDiscountExposure: risk.totalExcessDiscountExposure,
            approvalRuleId: approvalDecision.rule._id,
            steps: buildApprovalStepsFromRoles(approvalDecision.requiredApprovalRoles)
        });

        await createAuditLog({
            actor,
            action: AUDIT_ACTIONS.APPROVAL_CREATED,
            entityType: 'ApprovalRequest',
            entityId: approvalRequest._id,
            quotationId: quotation._id,
            customerId: quotation.customerId,
            after: approvalRequest.toObject(),
            metadata: {
                quotationVersion: quotation.currentVersion,
                approvalRuleId: approvalDecision.rule._id,
                source: 'NEGOTIATION_ACCEPTED'
            }
        });
    }

    return {quotation: updatedQuotation, approvalRequest};
};

const submitCustomerNegotiation = async ({quotationId, actor, messages, requests, reason}) => {
    const quotation = await Quotation.findById(quotationId);

    if (!quotation) {
        throw new ApiError(404, 'Quotation not found');
    }

    if (![
        QUOTATION_STATUSES.SENT_TO_CUSTOMER,
        QUOTATION_STATUSES.READY_FOR_CUSTOMER,
        QUOTATION_STATUSES.APPROVED,
        QUOTATION_STATUSES.UNDER_NEGOTIATION
    ].includes(quotation.status)) {
        throw new ApiError(400, 'Quotation is not open for negotiation');
    }

    const referencedLineIds = messages
    .filter((message) => message.quotationLineId)
    .map((message) => message.quotationLineId);

    if (referencedLineIds.length) {
        const matchingLineCount = await QuotationLine.countDocuments({
            _id: {$in: referencedLineIds},
            quotationId: quotation._id
        });

        if (matchingLineCount !== new Set(referencedLineIds.map(String)).size) {
            throw new ApiError(400, 'One or more referenced quotation lines do not belong to this quotation');
        }
    }

    const negotiation = await Negotiation.create({
        quotationId: quotation._id,
        quotationVersion: quotation.currentVersion,
        customerId: quotation.customerId,
        submittedById: actor.id,
        status: 'SUBMITTED',
        requests
    });
    const negotiationMessages = await NegotiationMessage.insertMany(messages.map((message) => ({
        negotiationId: negotiation._id,
        quotationId: quotation._id,
        quotationVersion: quotation.currentVersion,
        quotationLineId: message.quotationLineId,
        messageType: message.messageType,
        message: message.message,
        proposedValue: message.proposedValue,
        senderId: actor.id,
        senderRole: actor.role
    })));

    await openNegotiationIfNeeded(quotation, {
        actor,
        openReason: 'Customer negotiation opened',
        transitionReason: reason || 'Customer negotiation submitted',
        negotiationId: negotiation._id
    });

    await createAuditLog({
        actor,
        action: AUDIT_ACTIONS.CUSTOMER_NEGOTIATION,
        entityType: 'Negotiation',
        entityId: negotiation._id,
        quotationId: quotation._id,
        customerId: quotation.customerId,
        reason: reason || null,
        after: negotiation.toObject()
    });

    return {negotiation, messages: negotiationMessages};
};

const listNegotiationsForQuotation = async ({quotationId, actor}) => {
    const quotation = await Quotation.findById(quotationId);

    if (!quotation) {
        throw new ApiError(404, 'Quotation not found');
    }

    if (
        actor.role === USER_ROLES.SALES_REP &&
        quotation.ownerId.toString() !== actor.id.toString()
    ) {
        throw new ApiError(403, 'Sales reps can only view negotiations for their own quotations');
    }

    const negotiations = await Negotiation.find({quotationId: quotation._id})
    .populate('submittedById', 'fullName email role')
    .sort({createdAt: -1});
    const messages = await NegotiationMessage.find({quotationId: quotation._id})
    .populate('senderId', 'fullName email role')
    .sort({createdAt: 1});
    const messagesByNegotiation = messages.reduce((map, message) => {
        const key = message.negotiationId.toString();
        map[key] = map[key] || [];
        map[key].push(message);
        return map;
    }, {});

    return negotiations.map((negotiation) => ({
        ...negotiation.toObject(),
        messages: messagesByNegotiation[negotiation._id.toString()] || []
    }));
};

const submitCustomerDiscountProposal = async ({
    quotationId,
    actor,
    scope,
    quotationLineId,
    proposedDiscountPercent,
    message
}) => {
    const quotation = await Quotation.findById(quotationId);

    if (!quotation) {
        throw new ApiError(404, 'Quotation not found');
    }

    if (![
        QUOTATION_STATUSES.APPROVED,
        QUOTATION_STATUSES.READY_FOR_CUSTOMER,
        QUOTATION_STATUSES.SENT_TO_CUSTOMER,
        QUOTATION_STATUSES.UNDER_NEGOTIATION
    ].includes(quotation.status)) {
        throw new ApiError(400, 'Quotation is not open for discount negotiation');
    }

    if (scope === 'LINE') {
        const lineExists = await QuotationLine.exists({
            _id: quotationLineId,
            quotationId: quotation._id
        });

        if (!lineExists) {
            throw new ApiError(400, 'Quotation line does not belong to this quotation');
        }
    }

    const proposalBaseline = scope === 'LINE'
        ? await QuotationLine.findOne({
            _id: quotationLineId,
            quotationId: quotation._id
        }).select('discountPercent')
        : await calculateQuotationTotals(quotation._id);
    const currentDiscountPercent = scope === 'LINE'
        ? Number(proposalBaseline.discountPercent || 0)
        : (proposalBaseline.subtotal > 0
            ? Number(((proposalBaseline.totalDiscount / proposalBaseline.subtotal) * 100).toFixed(2))
            : 0);

    if (proposedDiscountPercent <= currentDiscountPercent) {
        throw new ApiError(400, `Proposed discount must be greater than the current ${scope === 'LINE' ? 'line' : 'quotation'} discount`);
    }

    const negotiation = await Negotiation.create({
        quotationId: quotation._id,
        quotationVersion: quotation.currentVersion,
        customerId: quotation.customerId,
        submittedById: actor.id,
        status: 'SUBMITTED',
        requests: [{
            quotationLineId: scope === 'LINE' ? quotationLineId : null,
            comment: message || `Customer proposed ${proposedDiscountPercent}% discount`,
            requestedDiscountPercent: proposedDiscountPercent
        }]
    });
    const negotiationMessage = await NegotiationMessage.create({
        negotiationId: negotiation._id,
        quotationId: quotation._id,
        quotationVersion: quotation.currentVersion,
        quotationLineId: scope === 'LINE' ? quotationLineId : null,
        messageType: NEGOTIATION_MESSAGE_TYPES.COUNTER_DISCOUNT,
        message: message || `Proposed ${proposedDiscountPercent}% discount`,
        proposedValue: {
            scope,
            discountPercent: proposedDiscountPercent
        },
        senderId: actor.id,
        senderRole: actor.role
    });

    await openNegotiationIfNeeded(quotation, {
        actor,
        openReason: 'Customer discount proposal opened negotiation',
        transitionReason: 'Customer proposed discount change',
        negotiationId: negotiation._id
    });

    await createAuditLog({
        actor,
        action: AUDIT_ACTIONS.CUSTOMER_NEGOTIATION,
        entityType: 'Negotiation',
        entityId: negotiation._id,
        quotationId: quotation._id,
        customerId: quotation.customerId,
        reason: message || null,
        after: {
            negotiation: negotiation.toObject(),
            message: negotiationMessage.toObject()
        },
        metadata: {proposalType: 'DISCOUNT'}
    });

    return {negotiation, message: negotiationMessage};
};

const applyAcceptedMessageToLines = async ({quotation, customer, message}) => {
    const proposedValue = message.proposedValue || {};

    if (message.messageType === NEGOTIATION_MESSAGE_TYPES.COUNTER_DISCOUNT) {
        const discountPercent = parseDiscountPercent(proposedValue.discountPercent);
        const scope = proposedValue.scope || (message.quotationLineId ? 'LINE' : 'QUOTE');
        const lineFilter = scope === 'LINE'
            ? {_id: message.quotationLineId, quotationId: quotation._id}
            : {quotationId: quotation._id};
        const lines = await QuotationLine.find(lineFilter);

        if (!lines.length) {
            throw new ApiError(400, 'No quotation lines found for accepted discount proposal');
        }

        for (const line of lines) {
            const product = await Product.findById(line.productId).populate('categoryId', 'name maxAllowedDiscountPercent isActive');
            const allowedDiscount = await getAllowedDiscount(customer, product);
            const amounts = calculateLineAmounts({
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                costPrice: line.costPrice,
                discountPercent,
                taxPercentage: line.taxPercentage,
                allowedDiscountPercent: allowedDiscount.allowedDiscountPercent
            });

            line.discountPercent = discountPercent;
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
    }

    if (message.messageType === NEGOTIATION_MESSAGE_TYPES.QUANTITY_CHANGE) {
        if (!message.quotationLineId) {
            throw new ApiError(400, 'Quantity change proposals require a quotation line');
        }

        const quantity = parseOptionalPositiveNumber(proposedValue.quantity, 'Proposed quantity');
        if (quantity === null) {
            throw new ApiError(400, 'Proposed quantity is required');
        }
        const line = await QuotationLine.findOne({_id: message.quotationLineId, quotationId: quotation._id});

        if (!line) {
            throw new ApiError(400, 'Quotation line not found for quantity proposal');
        }

        const product = await Product.findById(line.productId).populate('categoryId', 'name maxAllowedDiscountPercent isActive');
        const allowedDiscount = await getAllowedDiscount(customer, product);
        const amounts = calculateLineAmounts({
            quantity,
            unitPrice: line.unitPrice,
            costPrice: line.costPrice,
            discountPercent: line.discountPercent,
            taxPercentage: line.taxPercentage,
            allowedDiscountPercent: allowedDiscount.allowedDiscountPercent
        });

        Object.assign(line, {
            quantity,
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
            violationAmount: amounts.violationAmount
        });
        await line.save();
    }

    if (message.messageType === NEGOTIATION_MESSAGE_TYPES.PRICE_CHANGE) {
        if (!message.quotationLineId) {
            throw new ApiError(400, 'Price change proposals require a quotation line');
        }

        const unitPrice = parseOptionalPositiveNumber(proposedValue.unitPrice, 'Proposed unit price');
        if (unitPrice === null) {
            throw new ApiError(400, 'Proposed unit price is required');
        }
        const line = await QuotationLine.findOne({_id: message.quotationLineId, quotationId: quotation._id});

        if (!line) {
            throw new ApiError(400, 'Quotation line not found for price proposal');
        }

        const product = await Product.findById(line.productId).populate('categoryId', 'name maxAllowedDiscountPercent isActive');
        const allowedDiscount = await getAllowedDiscount(customer, product);
        const amounts = calculateLineAmounts({
            quantity: line.quantity,
            unitPrice,
            costPrice: line.costPrice,
            discountPercent: line.discountPercent,
            taxPercentage: line.taxPercentage,
            allowedDiscountPercent: allowedDiscount.allowedDiscountPercent
        });

        Object.assign(line, {
            unitPrice,
            isNegotiatedPrice: true,
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
            violationAmount: amounts.violationAmount
        });
        await line.save();
    }
};

const acceptNegotiationById = async ({negotiationId, actor, reason}) => {
    const negotiation = await Negotiation.findById(negotiationId);

    if (!negotiation) {
        throw new ApiError(404, 'Negotiation not found');
    }

    if (negotiation.status !== 'SUBMITTED') {
        throw new ApiError(400, 'Only submitted negotiations can be accepted');
    }

    let quotation = await Quotation.findById(negotiation.quotationId);

    if (!quotation) {
        throw new ApiError(404, 'Quotation not found');
    }

    if (actor.role === USER_ROLES.SALES_REP && quotation.ownerId.toString() !== actor.id.toString()) {
        throw new ApiError(403, 'Sales reps can only accept negotiations for their own quotations');
    }

    if ([QUOTATION_STATUSES.CONFIRMED, QUOTATION_STATUSES.REJECTED, QUOTATION_STATUSES.EXPIRED, QUOTATION_STATUSES.CANCELLED].includes(quotation.status)) {
        throw new ApiError(400, `Cannot accept negotiation while quotation is ${quotation.status}`);
    }

    const messages = await NegotiationMessage.find({negotiationId: negotiation._id}).sort({createdAt: 1});

    if (!messages.length) {
        throw new ApiError(400, 'Negotiation has no messages to accept');
    }

    if (negotiation.quotationVersion !== quotation.currentVersion) {
        throw new ApiError(409, 'Negotiation belongs to an older quotation version and cannot be applied');
    }

    const actionableMessages = messages.filter((message) => [
        NEGOTIATION_MESSAGE_TYPES.COUNTER_DISCOUNT,
        NEGOTIATION_MESSAGE_TYPES.QUANTITY_CHANGE,
        NEGOTIATION_MESSAGE_TYPES.PRICE_CHANGE
    ].includes(message.messageType));

    if (!actionableMessages.length) {
        throw new ApiError(400, 'Negotiation has no pricing, discount, or quantity proposal to accept');
    }

    quotation = await prepareQuotationForMaterialChange(quotation, {
        actor,
        reason: reason || 'Customer negotiation accepted'
    });

    const customer = await Customer.findById(quotation.customerId)
    .populate('tierId', 'name defaultMaxDiscountPercent isActive');

    for (const message of actionableMessages) {
        await applyAcceptedMessageToLines({quotation, customer, message});
    }

    const totals = await calculateQuotationTotals(quotation._id);
    quotation = await Quotation.findByIdAndUpdate(
        quotation._id,
        {$set: totals},
        {new: true, runValidators: true}
    );
    await recalculateQuotationCommercials(quotation._id);
    quotation = await Quotation.findById(quotation._id);

    const risk = await calculateQuotationRisk(quotation._id);
    const approvalDecision = await evaluateApprovalRule({
        riskScore: risk.totalRiskScore,
        totalExcessDiscountExposure: risk.totalExcessDiscountExposure
    });
    const approvalResult = await createApprovalWorkflowForChangedQuote({
        quotation,
        risk,
        approvalDecision,
        actor,
        reason: 'Accepted customer negotiation'
    });

    await createQuotationVersionSnapshot(approvalResult.quotation._id, {
        actor,
        reason: 'Negotiated quotation version created'
    });

    negotiation.status = 'ACCEPTED';
    await negotiation.save();

    await createAuditLog({
        actor,
        action: AUDIT_ACTIONS.CUSTOMER_NEGOTIATION,
        entityType: 'Negotiation',
        entityId: negotiation._id,
        quotationId: quotation._id,
        customerId: quotation.customerId,
        reason: reason || null,
        before: {status: 'SUBMITTED'},
        after: {
            status: negotiation.status,
            quotationVersion: approvalResult.quotation.currentVersion,
            quotationStatus: approvalResult.quotation.status,
            approvalRequired: approvalDecision.approvalRequired
        },
        metadata: {action: 'ACCEPTED_BY_SALES_REP'}
    });

    return {
        negotiation,
        quotation: approvalResult.quotation,
        approvalRequest: approvalResult.approvalRequest,
        risk,
        approvalDecision
    };
};

const rejectNegotiationById = async ({negotiationId, actor, reason}) => {
    const negotiation = await Negotiation.findById(negotiationId);

    if (!negotiation) {
        throw new ApiError(404, 'Negotiation not found');
    }

    if (negotiation.status !== 'SUBMITTED') {
        throw new ApiError(400, 'Only submitted negotiations can be rejected');
    }

    const quotation = await Quotation.findById(negotiation.quotationId);

    if (!quotation) {
        throw new ApiError(404, 'Quotation not found');
    }

    if (actor.role === USER_ROLES.SALES_REP && quotation.ownerId.toString() !== actor.id.toString()) {
        throw new ApiError(403, 'Sales reps can only reject negotiations for their own quotations');
    }

    negotiation.status = 'REJECTED';
    await negotiation.save();

    await createAuditLog({
        actor,
        action: AUDIT_ACTIONS.CUSTOMER_NEGOTIATION,
        entityType: 'Negotiation',
        entityId: negotiation._id,
        quotationId: quotation._id,
        customerId: quotation.customerId,
        reason: reason || null,
        before: {status: 'SUBMITTED'},
        after: {status: negotiation.status},
        metadata: {action: 'REJECTED_BY_SALES_REP'}
    });

    return {negotiation};
};

const negotiationsService = Object.freeze({
    moduleName: 'negotiations',
    submitCustomerNegotiation,
    listNegotiationsForQuotation,
    submitCustomerDiscountProposal,
    acceptNegotiationById,
    rejectNegotiationById
});

export {
    negotiationsService,
    submitCustomerNegotiation,
    listNegotiationsForQuotation,
    submitCustomerDiscountProposal,
    acceptNegotiationById,
    rejectNegotiationById
};
