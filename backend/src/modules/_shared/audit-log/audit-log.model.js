import mongoose, { Schema } from 'mongoose';

const auditLogSchema = new Schema(
    {
        actor_id: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        actor_type: {
            type: String,
            enum: ['USER', 'SYSTEM'],
            default: 'USER',
        },
        action: {
            type: String,
            required: true,
        },
        entity_type: {
            type: String,
            required: true,
        },
        entity_id: {
            type: Schema.Types.ObjectId,
            required: true,
        },
        reason: {
            type: String,
            default: '',
        },
        metadata: {
            type: Schema.Types.Mixed,
            default: {},
        },
    },
    { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

auditLogSchema.index({ entity_type: 1, entity_id: 1 });
auditLogSchema.index({ actor_id: 1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
