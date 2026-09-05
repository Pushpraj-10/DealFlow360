import {AUDIT_ACTIONS, QUOTATION_STATUSES} from '../../core/constants.js';
import {ApiError} from '../../core/utils/apiError.js';
import {createAuditLog} from '../auditLogs/auditLogs.service.js';

const allowedTransitions = Object.freeze({
    [QUOTATION_STATUSES.DRAFT]: [
        QUOTATION_STATUSES.PENDING_APPROVAL,
        QUOTATION_STATUSES.READY_FOR_CUSTOMER,
        QUOTATION_STATUSES.SENT_TO_CUSTOMER,
        QUOTATION_STATUSES.EXPIRED,
        QUOTATION_STATUSES.CANCELLED
    ],
    [QUOTATION_STATUSES.PENDING_APPROVAL]: [
        QUOTATION_STATUSES.RETURNED_FOR_REVISION,
        QUOTATION_STATUSES.APPROVED,
        QUOTATION_STATUSES.REJECTED,
        QUOTATION_STATUSES.REAPPROVAL_REQUIRED
    ],
    [QUOTATION_STATUSES.RETURNED_FOR_REVISION]: [
        QUOTATION_STATUSES.DRAFT,
        QUOTATION_STATUSES.PENDING_APPROVAL,
        QUOTATION_STATUSES.REAPPROVAL_REQUIRED,
        QUOTATION_STATUSES.READY_FOR_CUSTOMER,
        QUOTATION_STATUSES.CANCELLED
    ],
    [QUOTATION_STATUSES.READY_FOR_CUSTOMER]: [
        QUOTATION_STATUSES.SENT_TO_CUSTOMER,
        QUOTATION_STATUSES.UNDER_NEGOTIATION,
        QUOTATION_STATUSES.REAPPROVAL_REQUIRED,
        QUOTATION_STATUSES.CONFIRMED,
        QUOTATION_STATUSES.EXPIRED
    ],
    [QUOTATION_STATUSES.APPROVED]: [
        QUOTATION_STATUSES.SENT_TO_CUSTOMER,
        QUOTATION_STATUSES.UNDER_NEGOTIATION,
        QUOTATION_STATUSES.REAPPROVAL_REQUIRED,
        QUOTATION_STATUSES.CONFIRMED,
        QUOTATION_STATUSES.EXPIRED
    ],
    [QUOTATION_STATUSES.SENT_TO_CUSTOMER]: [
        QUOTATION_STATUSES.UNDER_NEGOTIATION,
        QUOTATION_STATUSES.CONFIRMED,
        QUOTATION_STATUSES.REAPPROVAL_REQUIRED,
        QUOTATION_STATUSES.EXPIRED
    ],
    [QUOTATION_STATUSES.UNDER_NEGOTIATION]: [
        QUOTATION_STATUSES.REAPPROVAL_REQUIRED,
        QUOTATION_STATUSES.CONFIRMED,
        QUOTATION_STATUSES.EXPIRED
    ],
    [QUOTATION_STATUSES.REAPPROVAL_REQUIRED]: [
        QUOTATION_STATUSES.DRAFT,
        QUOTATION_STATUSES.PENDING_APPROVAL,
        QUOTATION_STATUSES.READY_FOR_CUSTOMER,
        QUOTATION_STATUSES.CANCELLED
    ],
    [QUOTATION_STATUSES.CONFIRMED]: [],
    [QUOTATION_STATUSES.REJECTED]: [],
    [QUOTATION_STATUSES.CANCELLED]: [],
    [QUOTATION_STATUSES.EXPIRED]: []
});

const assertValidQuotationTransition = (fromStatus, toStatus) => {
    if (fromStatus === toStatus) {
        return true;
    }

    const allowedNextStates = allowedTransitions[fromStatus] || [];

    if (!allowedNextStates.includes(toStatus)) {
        throw new ApiError(400, `Invalid quotation status transition from ${fromStatus} to ${toStatus}`);
    }

    return true;
};

const transitionQuotationState = async (quotation, toStatus, {actor = null, reason = null, metadata = {}} = {}) => {
    const fromStatus = quotation.status;
    assertValidQuotationTransition(fromStatus, toStatus);

    if (fromStatus === toStatus) {
        return quotation;
    }

    quotation.status = toStatus;
    await quotation.save();

    await createAuditLog({
        actor,
        action: AUDIT_ACTIONS.QUOTATION_STATE_CHANGED,
        entityType: 'Quotation',
        entityId: quotation._id,
        quotationId: quotation._id,
        customerId: quotation.customerId,
        reason,
        before: {status: fromStatus},
        after: {status: toStatus},
        metadata
    });

    return quotation;
};

export {
    allowedTransitions,
    assertValidQuotationTransition,
    transitionQuotationState
};
