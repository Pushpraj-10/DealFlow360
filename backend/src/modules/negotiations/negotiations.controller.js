import mongoose from 'mongoose';

import {
    NEGOTIATION_MESSAGE_TYPES,
    USER_ROLES
} from '../../core/constants.js';
import {ApiError} from '../../core/utils/apiError.js';
import {ApiResponse} from '../../core/utils/apiResponse.js';
import {asyncHandler} from '../../core/utils/asyncHandler.js';
import {
    acceptNegotiationById,
    listNegotiationsForQuotation,
    rejectNegotiationById,
    submitCustomerDiscountProposal,
    submitCustomerNegotiation
} from './negotiations.service.js';

const validateObjectId = (value, label) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new ApiError(400, `Invalid ${label}`);
    }
};

const normalizeMessages = (body) => {
    const rawMessages = Array.isArray(body.messages)
        ? body.messages
        : [{
            quotationLineId: body.quotationLineId,
            messageType: body.messageType,
            message: body.message,
            proposedValue: body.proposedValue
        }];

    if (!rawMessages.length) {
        throw new ApiError(400, 'At least one negotiation message is required');
    }

    return rawMessages.map((item) => {
        if (!Object.values(NEGOTIATION_MESSAGE_TYPES).includes(item.messageType)) {
            throw new ApiError(400, 'Invalid negotiation message type');
        }

        if (!item.message?.trim()) {
            throw new ApiError(400, 'Negotiation message is required');
        }

        if (item.quotationLineId) {
            validateObjectId(item.quotationLineId, 'quotation line id');
        }

        return {
            quotationLineId: item.quotationLineId || null,
            messageType: item.messageType,
            message: item.message,
            proposedValue: item.proposedValue ?? null
        };
    });
};

const parseDiscountPercent = (value) => {
    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
        throw new ApiError(400, 'Proposed discount percentage must be between 0 and 100');
    }

    return parsed;
};

const getNegotiationsModuleStatus = asyncHandler(async (req, res) => {
    return res
    .status(200)
    .json(new ApiResponse(200, {module: 'negotiations', ready: true}, 'Negotiations module ready'));
});

const createCustomerNegotiation = asyncHandler(async (req, res) => {
    validateObjectId(req.params.quotationId, 'quotation id');

    const normalizedMessages = normalizeMessages(req.body);
    const requests = Array.isArray(req.body.requests) ? req.body.requests : [];

    const result = await submitCustomerNegotiation({
        quotationId: req.params.quotationId,
        actor: req.user,
        messages: normalizedMessages,
        requests,
        reason: req.body.reason
    });

    return res
    .status(201)
    .json(new ApiResponse(201, result, 'Customer negotiation submitted successfully'));
});

const listQuotationNegotiations = asyncHandler(async (req, res) => {
    validateObjectId(req.params.quotationId, 'quotation id');

    const negotiations = await listNegotiationsForQuotation({
        quotationId: req.params.quotationId,
        actor: req.user
    });

    return res
    .status(200)
    .json(new ApiResponse(200, {negotiations}, 'Quotation negotiations fetched successfully'));
});

const proposeCustomerDiscount = asyncHandler(async (req, res) => {
    validateObjectId(req.params.quotationId, 'quotation id');

    const proposedDiscountPercent = parseDiscountPercent(req.body.proposedDiscountPercent);
    const scope = req.body.scope || (req.body.quotationLineId ? 'LINE' : 'QUOTE');

    if (!['LINE', 'QUOTE'].includes(scope)) {
        throw new ApiError(400, 'scope must be LINE or QUOTE');
    }

    if (scope === 'LINE') {
        if (!req.body.quotationLineId) {
            throw new ApiError(400, 'quotationLineId is required for line-level discount proposals');
        }

        validateObjectId(req.body.quotationLineId, 'quotation line id');
    }

    const result = await submitCustomerDiscountProposal({
        quotationId: req.params.quotationId,
        actor: req.user,
        scope,
        quotationLineId: scope === 'LINE' ? req.body.quotationLineId : null,
        proposedDiscountPercent,
        message: req.body.message
    });

    return res
    .status(201)
    .json(new ApiResponse(201, result, 'Discount proposal submitted successfully'));
});

const acceptNegotiation = asyncHandler(async (req, res) => {
    validateObjectId(req.params.negotiationId, 'negotiation id');

    if (req.user.role !== USER_ROLES.SALES_REP && req.user.role !== USER_ROLES.ADMIN) {
        throw new ApiError(403, 'Only sales reps can accept customer negotiation proposals');
    }

    const result = await acceptNegotiationById({
        negotiationId: req.params.negotiationId,
        actor: req.user,
        reason: req.body.reason
    });

    return res
    .status(200)
    .json(new ApiResponse(200, result, 'Negotiation accepted and quotation terms updated successfully'));
});

const rejectNegotiation = asyncHandler(async (req, res) => {
    validateObjectId(req.params.negotiationId, 'negotiation id');

    if (req.user.role !== USER_ROLES.SALES_REP && req.user.role !== USER_ROLES.ADMIN) {
        throw new ApiError(403, 'Only sales reps can reject customer negotiation proposals');
    }

    const result = await rejectNegotiationById({
        negotiationId: req.params.negotiationId,
        actor: req.user,
        reason: req.body.reason
    });

    return res
    .status(200)
    .json(new ApiResponse(200, result, 'Negotiation rejected successfully'));
});

export {
    getNegotiationsModuleStatus,
    createCustomerNegotiation,
    listQuotationNegotiations,
    proposeCustomerDiscount,
    acceptNegotiation,
    rejectNegotiation
};
