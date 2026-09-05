import {APPROVAL_STATUSES, APPROVAL_STEP_STATUSES, QUOTATION_STATUSES} from '../../core/constants.js';
import {ApiError} from '../../core/utils/apiError.js';
import {Quotation} from '../quotations/quotation.model.js';
import {ApprovalRequest} from './approval.model.js';
import {ApprovalRule} from './approvalRule.model.js';

const evaluateApprovalRule = async ({riskScore, totalExcessDiscountExposure}) => {
    const rule = await ApprovalRule.findOne({
        isActive: true,
        minRiskScore: {$lte: riskScore},
        maxRiskScore: {$gte: riskScore},
        minExcessDiscountExposure: {$lte: totalExcessDiscountExposure},
        maxExcessDiscountExposure: {$gte: totalExcessDiscountExposure}
    }).sort({priority: 1, updatedAt: -1});

    if (!rule) {
        throw new ApiError(400, 'No active approval rule matches the quotation risk result');
    }

    return {
        rule,
        approvalRequired: rule.requiredApprovalRoles.length > 0,
        requiredApprovalRoles: rule.requiredApprovalRoles,
        severity: rule.severity
    };
};

const buildApprovalStepsFromRoles = (roles) => {
    return roles.map((role, index) => ({
        sequence: index + 1,
        requiredRole: role,
        role,
        status: index === 0 ? APPROVAL_STEP_STATUSES.ACTIVE : APPROVAL_STEP_STATUSES.PENDING
    }));
};

const getActiveStep = (approvalRequest) => {
    return approvalRequest.steps.find((step) => step.status === APPROVAL_STEP_STATUSES.ACTIVE) || null;
};

const listActiveApprovalsForRole = async (role) => {
    return ApprovalRequest.find({
        status: APPROVAL_STATUSES.PENDING,
        steps: {
            $elemMatch: {
                requiredRole: role,
                status: APPROVAL_STEP_STATUSES.ACTIVE
            }
        }
    })
    .populate({
        path: 'quotationId',
        populate: [
            {path: 'customerId', select: 'name company tierId'},
            {path: 'salesRepId', select: 'fullName email role'}
        ]
    })
    .populate('requestedById', 'fullName email role')
    .sort({createdAt: 1});
};

const applyApprovalDecision = async ({approvalRequestId, reviewer, decision, reason}) => {
    const approvalRequest = await ApprovalRequest.findById(approvalRequestId);

    if (!approvalRequest) {
        throw new ApiError(404, 'Approval request not found');
    }

    if (approvalRequest.status !== APPROVAL_STATUSES.PENDING) {
        throw new ApiError(400, 'Approval request is not pending');
    }

    const quotation = await Quotation.findById(approvalRequest.quotationId);

    if (!quotation) {
        throw new ApiError(404, 'Quotation not found');
    }

    if (quotation.currentVersion !== approvalRequest.quotationVersion) {
        throw new ApiError(409, 'Approval request does not belong to the current quotation version');
    }

    const activeStep = getActiveStep(approvalRequest);

    if (!activeStep) {
        throw new ApiError(400, 'Approval request has no active step');
    }

    if (activeStep.requiredRole !== reviewer.role) {
        throw new ApiError(403, 'This approval step is not active for your role');
    }

    if (['REJECTED', 'RETURNED'].includes(decision) && !reason?.trim()) {
        throw new ApiError(400, 'Reason is required for reject and return decisions');
    }

    activeStep.status = decision;
    activeStep.reviewerId = reviewer.id;
    activeStep.actorId = reviewer.id;
    activeStep.decisionAt = new Date();
    activeStep.actedAt = activeStep.decisionAt;
    activeStep.reason = reason?.trim() || null;
    activeStep.note = activeStep.reason;

    if (decision === APPROVAL_STEP_STATUSES.REJECTED) {
        approvalRequest.status = APPROVAL_STATUSES.REJECTED;
        quotation.status = QUOTATION_STATUSES.REJECTED;
        quotation.approvalStatus = APPROVAL_STATUSES.REJECTED;
    } else if (decision === APPROVAL_STEP_STATUSES.RETURNED) {
        approvalRequest.status = APPROVAL_STATUSES.RETURNED;
        quotation.status = QUOTATION_STATUSES.DRAFT;
        quotation.approvalStatus = APPROVAL_STATUSES.RETURNED;
        quotation.currentVersion += 1;
    } else if (decision === APPROVAL_STEP_STATUSES.APPROVED) {
        const nextStep = approvalRequest.steps
        .sort((left, right) => left.sequence - right.sequence)
        .find((step) => step.status === APPROVAL_STEP_STATUSES.PENDING);

        if (nextStep) {
            nextStep.status = APPROVAL_STEP_STATUSES.ACTIVE;
        } else {
            approvalRequest.status = APPROVAL_STATUSES.APPROVED;
            quotation.status = QUOTATION_STATUSES.APPROVED;
            quotation.approvalStatus = APPROVAL_STATUSES.APPROVED;
        }
    } else {
        throw new ApiError(400, 'Invalid approval decision');
    }

    await approvalRequest.save();
    await quotation.save();

    return {
        approvalRequest,
        quotation
    };
};

const approvalsService = Object.freeze({
    moduleName: 'approvals',
    evaluateApprovalRule,
    buildApprovalStepsFromRoles,
    getActiveStep,
    listActiveApprovalsForRole,
    applyApprovalDecision
});

export {
    approvalsService,
    evaluateApprovalRule,
    buildApprovalStepsFromRoles,
    getActiveStep,
    listActiveApprovalsForRole,
    applyApprovalDecision
};
