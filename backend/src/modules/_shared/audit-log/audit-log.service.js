import { AuditLog } from './audit-log.model.js';

/**
 * Shared append-only audit trail, used by every module in this scope
 * (and safe for teammates' modules to reuse) per PRD section 15/16.
 *
 * @param {object} params
 * @param {string|null} [params.actorId] - User _id performing the action, or null for system actions.
 * @param {string} params.action - e.g. 'FULFILLMENT_ACCEPTED'
 * @param {string} params.entityType - e.g. 'Fulfillment'
 * @param {string} params.entityId
 * @param {string} [params.reason]
 * @param {object} [params.metadata]
 * @param {import('mongoose').ClientSession} [params.session] - pass to include the log write in an active transaction.
 */
const logAction = async ({ actorId = null, action, entityType, entityId, reason = '', metadata = {}, session }) => {
    const [entry] = await AuditLog.create(
        [
            {
                actor_id: actorId,
                actor_type: actorId ? 'USER' : 'SYSTEM',
                action,
                entity_type: entityType,
                entity_id: entityId,
                reason,
                metadata,
            },
        ],
        { session }
    );

    return entry;
};

export { logAction };
