import {APPROVAL_STATUSES, APPROVAL_STEP_STATUSES, AUDIT_ACTIONS, QUOTATION_STATUSES, USER_ROLES} from '../../core/constants.js';
import {ApiError} from '../../core/utils/apiError.js';
import {createAuditLog} from '../auditLogs/auditLogs.service.js';
import {Quotation} from '../quotations/quotation.model.js';
import {transitionQuotationState} from '../quotations/quotationState.service.js';
import {QuotationVersion} from '../quotations/quotationVersion.model.js';
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

const orderApprovalRolesForRisk = (roles, severity) => {
    if (
        severity !== 'HIGH' ||
        !roles.includes(USER_ROLES.SALES_MANAGER) ||
        !roles.includes(USER_ROLES.FINANCE)
    ) {
        return roles;
    }

    return [
        USER_ROLES.SALES_MANAGER,
        USER_ROLES.FINANCE,
        ...roles.filter((role) => ![USER_ROLES.SALES_MANAGER, USER_ROLES.FINANCE].includes(role))
    ];
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
    .sort({createdAt: -1, updatedAt: -1});
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
        quotation.approvalStatus = APPROVAL_STATUSES.REJECTED;
        await transitionQuotationState(quotation, QUOTATION_STATUSES.REJECTED, {
            actor: reviewer,
            reason,
            metadata: {approvalRequestId}
        });
    } else if (decision === APPROVAL_STEP_STATUSES.RETURNED) {
        approvalRequest.status = APPROVAL_STATUSES.RETURNED;
        quotation.approvalStatus = APPROVAL_STATUSES.RETURNED;
        await transitionQuotationState(quotation, QUOTATION_STATUSES.RETURNED_FOR_REVISION, {
            actor: reviewer,
            reason,
            metadata: {approvalRequestId}
        });
    } else if (decision === APPROVAL_STEP_STATUSES.APPROVED) {
        const nextStep = approvalRequest.steps
        .sort((left, right) => left.sequence - right.sequence)
        .find((step) => step.status === APPROVAL_STEP_STATUSES.PENDING);

        if (nextStep) {
            nextStep.status = APPROVAL_STEP_STATUSES.ACTIVE;
        } else {
            approvalRequest.status = APPROVAL_STATUSES.APPROVED;
            quotation.approvalStatus = APPROVAL_STATUSES.APPROVED;
            await transitionQuotationState(quotation, QUOTATION_STATUSES.APPROVED, {
                actor: reviewer,
                reason,
                metadata: {approvalRequestId}
            });
        }
    } else {
        throw new ApiError(400, 'Invalid approval decision');
    }

    await approvalRequest.save();

    await QuotationVersion.findOneAndUpdate(
        {
            quotationId: quotation._id,
            versionNumber: quotation.currentVersion
        },
        {
            $set: {
                status: quotation.status,
                approvalStatus: quotation.approvalStatus,
                riskScore: quotation.riskScore,
                riskSeverity: quotation.riskSeverity
            }
        }
    );

    const actionMap = {
        [APPROVAL_STEP_STATUSES.APPROVED]: AUDIT_ACTIONS.APPROVAL_APPROVED,
        [APPROVAL_STEP_STATUSES.REJECTED]: AUDIT_ACTIONS.APPROVAL_REJECTED,
        [APPROVAL_STEP_STATUSES.RETURNED]: AUDIT_ACTIONS.APPROVAL_RETURNED
    };

    await createAuditLog({
        actor: reviewer,
        action: actionMap[decision],
        entityType: 'ApprovalRequest',
        entityId: approvalRequest._id,
        quotationId: approvalRequest.quotationId,
        reason,
        before: {
            activeStep: {
                sequence: activeStep.sequence,
                requiredRole: activeStep.requiredRole,
                status: APPROVAL_STEP_STATUSES.ACTIVE
            }
        },
        after: {
            requestStatus: approvalRequest.status,
            quotationStatus: quotation.status,
            step: {
                sequence: activeStep.sequence,
                requiredRole: activeStep.requiredRole,
                status: activeStep.status
            }
        }
    });

    return {
        approvalRequest,
        quotation
    };
};

const approvalsService = Object.freeze({
    moduleName: 'approvals',
    evaluateApprovalRule,
    buildApprovalStepsFromRoles,
    orderApprovalRolesForRisk,
    getActiveStep,
    listActiveApprovalsForRole,
    applyApprovalDecision
});

export {
    approvalsService,
    evaluateApprovalRule,
    buildApprovalStepsFromRoles,
    orderApprovalRolesForRisk,
    getActiveStep,
    listActiveApprovalsForRole,
    applyApprovalDecision
};
