import mongoose from 'mongoose';

import {USER_ROLES} from '../../core/constants.js';
import {ApiError} from '../../core/utils/apiError.js';
import {ApiResponse} from '../../core/utils/apiResponse.js';
import {asyncHandler} from '../../core/utils/asyncHandler.js';
import {ApprovalRule} from './approvalRule.model.js';
import {
    applyApprovalDecision,
    listActiveApprovalsForRole
} from './approvals.service.js';

const validateObjectId = (value, label) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new ApiError(400, `Invalid ${label}`);
    }
};

const parseRangeNumber = (value, label) => {
    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed < 0) {
        throw new ApiError(400, `${label} must be a non-negative number`);
    }

    return parsed;
};

const validateRuleRanges = (payload) => {
    if (payload.minRiskScore > payload.maxRiskScore) {
        throw new ApiError(400, 'minRiskScore cannot be greater than maxRiskScore');
    }

    if (payload.minExcessDiscountExposure > payload.maxExcessDiscountExposure) {
        throw new ApiError(400, 'minExcessDiscountExposure cannot be greater than maxExcessDiscountExposure');
    }
};

const normalizeRoles = (roles = []) => {
    if (!Array.isArray(roles)) {
        throw new ApiError(400, 'requiredApprovalRoles must be an array');
    }

    const allowedRoles = [USER_ROLES.SALES_MANAGER, USER_ROLES.FINANCE, USER_ROLES.ADMIN];
    const invalidRole = roles.find((role) => !allowedRoles.includes(role));

    if (invalidRole) {
        throw new ApiError(400, `Invalid approval role: ${invalidRole}`);
    }

    return roles;
};

const getApprovalsModuleStatus = asyncHandler(async (req, res) => {
    return res
    .status(200)
    .json(new ApiResponse(200, {module: 'approvals', ready: true}, 'Approvals module ready'));
});

const listApprovalRules = asyncHandler(async (req, res) => {
    const rules = await ApprovalRule.find().sort({priority: 1, name: 1});

    return res
    .status(200)
    .json(new ApiResponse(200, {rules}, 'Approval rules fetched successfully'));
});

const createApprovalRule = asyncHandler(async (req, res) => {
    const payload = {
        name: req.body.name,
        minRiskScore: parseRangeNumber(req.body.minRiskScore, 'minRiskScore'),
        maxRiskScore: parseRangeNumber(req.body.maxRiskScore, 'maxRiskScore'),
        minExcessDiscountExposure: parseRangeNumber(req.body.minExcessDiscountExposure ?? 0, 'minExcessDiscountExposure'),
        maxExcessDiscountExposure: parseRangeNumber(req.body.maxExcessDiscountExposure ?? Number.MAX_SAFE_INTEGER, 'maxExcessDiscountExposure'),
        severity: req.body.severity,
        requiredApprovalRoles: normalizeRoles(req.body.requiredApprovalRoles || []),
        priority: Number.isFinite(Number(req.body.priority)) ? Number(req.body.priority) : 100,
        isActive: typeof req.body.isActive === 'boolean' ? req.body.isActive : true
    };

    if (!payload.name?.trim()) {
        throw new ApiError(400, 'Approval rule name is required');
    }

    if (!['NONE', 'LOW', 'MEDIUM', 'HIGH'].includes(payload.severity)) {
        throw new ApiError(400, 'Invalid approval rule severity');
    }

    validateRuleRanges(payload);

    const rule = await ApprovalRule.create(payload);

    return res
    .status(201)
    .json(new ApiResponse(201, {rule}, 'Approval rule created successfully'));
});

const updateApprovalRule = asyncHandler(async (req, res) => {
    validateObjectId(req.params.ruleId, 'approval rule id');

    const existingRule = await ApprovalRule.findById(req.params.ruleId);

    if (!existingRule) {
        throw new ApiError(404, 'Approval rule not found');
    }

    const payload = {
        name: Object.hasOwn(req.body, 'name') ? req.body.name : existingRule.name,
        minRiskScore: Object.hasOwn(req.body, 'minRiskScore') ? parseRangeNumber(req.body.minRiskScore, 'minRiskScore') : existingRule.minRiskScore,
        maxRiskScore: Object.hasOwn(req.body, 'maxRiskScore') ? parseRangeNumber(req.body.maxRiskScore, 'maxRiskScore') : existingRule.maxRiskScore,
        minExcessDiscountExposure: Object.hasOwn(req.body, 'minExcessDiscountExposure') ? parseRangeNumber(req.body.minExcessDiscountExposure, 'minExcessDiscountExposure') : existingRule.minExcessDiscountExposure,
        maxExcessDiscountExposure: Object.hasOwn(req.body, 'maxExcessDiscountExposure') ? parseRangeNumber(req.body.maxExcessDiscountExposure, 'maxExcessDiscountExposure') : existingRule.maxExcessDiscountExposure,
        severity: Object.hasOwn(req.body, 'severity') ? req.body.severity : existingRule.severity,
        requiredApprovalRoles: Object.hasOwn(req.body, 'requiredApprovalRoles') ? normalizeRoles(req.body.requiredApprovalRoles) : existingRule.requiredApprovalRoles,
        priority: Object.hasOwn(req.body, 'priority') ? Number(req.body.priority) : existingRule.priority,
        isActive: Object.hasOwn(req.body, 'isActive') ? req.body.isActive : existingRule.isActive
    };

    if (!payload.name?.trim()) {
        throw new ApiError(400, 'Approval rule name cannot be blank');
    }

    if (!['NONE', 'LOW', 'MEDIUM', 'HIGH'].includes(payload.severity)) {
        throw new ApiError(400, 'Invalid approval rule severity');
    }

    if (!Number.isFinite(payload.priority)) {
        throw new ApiError(400, 'priority must be a number');
    }

    if (typeof payload.isActive !== 'boolean') {
        throw new ApiError(400, 'isActive must be true or false');
    }

    validateRuleRanges(payload);

    const rule = await ApprovalRule.findByIdAndUpdate(
        req.params.ruleId,
        {$set: payload},
        {new: true, runValidators: true}
    );

    return res
    .status(200)
    .json(new ApiResponse(200, {rule}, 'Approval rule updated successfully'));
});

const deleteApprovalRule = asyncHandler(async (req, res) => {
    validateObjectId(req.params.ruleId, 'approval rule id');

    const rule = await ApprovalRule.findByIdAndUpdate(
        req.params.ruleId,
        {$set: {isActive: false}},
        {new: true}
    );

    if (!rule) {
        throw new ApiError(404, 'Approval rule not found');
    }

    return res
    .status(200)
    .json(new ApiResponse(200, {rule}, 'Approval rule deactivated successfully'));
});

const listMyPendingApprovalRequests = asyncHandler(async (req, res) => {
    if (![USER_ROLES.SALES_MANAGER, USER_ROLES.FINANCE, USER_ROLES.ADMIN].includes(req.user.role)) {
        throw new ApiError(403, 'Only approvers can view pending approval requests');
    }

    const approvalRequests = await listActiveApprovalsForRole(req.user.role);

    return res
    .status(200)
    .json(new ApiResponse(200, {approvalRequests}, 'Pending approval requests fetched successfully'));
});

const decideApprovalRequest = (decision) => asyncHandler(async (req, res) => {
    validateObjectId(req.params.approvalRequestId, 'approval request id');

    if (![USER_ROLES.SALES_MANAGER, USER_ROLES.FINANCE, USER_ROLES.ADMIN].includes(req.user.role)) {
        throw new ApiError(403, 'Only approvers can decide approval requests');
    }

    const result = await applyApprovalDecision({
        approvalRequestId: req.params.approvalRequestId,
        reviewer: req.user,
        decision,
        reason: req.body.reason
    });

    return res
    .status(200)
    .json(new ApiResponse(200, result, 'Approval decision recorded successfully'));
});

export {
    getApprovalsModuleStatus,
    listApprovalRules,
    createApprovalRule,
    updateApprovalRule,
    deleteApprovalRule,
    listMyPendingApprovalRequests,
    decideApprovalRequest
};
