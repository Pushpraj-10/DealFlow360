import { AuditLog } from '../../auditLogs/auditLog.model.js';

/**
 * Thin wrapper around dhan's shared AuditLog model (modules/auditLogs) so the
 * fulfillment/subscriptions/invoicing/deal-health services can log actions
 * with the same call shape they were built against.
 *
 * @param {object} params
 * @param {string|null} [params.actorId] - User _id performing the action, or null for system actions.
 * @param {string} params.action - e.g. 'FULFILLMENT_ACCEPTED' (stored as eventType)
 * @param {string} params.entityType - e.g. 'Fulfillment'
 * @param {string} params.entityId
 * @param {string} [params.reason]
 * @param {object} [params.metadata]
 * @param {string} [params.quotationId]
 * @param {string} [params.customerId]
 * @param {import('mongoose').ClientSession} [params.session] - pass to include the log write in an active transaction.
 */
const logAction = async ({
    actorId = null,
    action,
    entityType,
    entityId,
    reason = '',
    metadata = {},
    quotationId = null,
    customerId = null,
    session,
}) => {
    const [entry] = await AuditLog.create(
        [
            {
                eventType: action,
                action,
                actorId,
                entityType,
                entityId,
                quotationId,
                customerId,
                reason: reason || null,
                metadata,
            },
        ],
        { session }
    );

    return entry;
};

export { logAction };
