import {AuditLog} from './auditLog.model.js';

const getActorId = (actor) => actor?.id || actor?._id || null;

const createAuditLog = async ({
    actor = null,
    action,
    entityType,
    entityId,
    quotationId = null,
    customerId = null,
    reason = null,
    before = null,
    after = null,
    metadata = {}
}) => {
    return AuditLog.create({
        eventType: action,
        action,
        actorId: getActorId(actor),
        actorRole: actor?.role || null,
        role: actor?.role || null,
        entityType,
        entityId,
        quotationId,
        customerId,
        reason,
        before,
        after,
        metadata
    });
};

const auditLogsService = Object.freeze({
    moduleName: 'auditLogs',
    createAuditLog
});

export {
    auditLogsService,
    createAuditLog
};
