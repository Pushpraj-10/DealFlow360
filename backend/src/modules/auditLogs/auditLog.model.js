import mongoose, {Schema} from 'mongoose';

const auditLogSchema = new Schema(
    {
        eventType: {
            type: String,
            required: true,
            trim: true,
            index: true
        },
        actorId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null,
            index: true
        },
        actorRole: {
            type: String,
            trim: true,
            default: null
        },
        entityType: {
            type: String,
            required: true,
            trim: true,
            index: true
        },
        entityId: {
            type: Schema.Types.ObjectId,
            required: true,
            index: true
        },
        quotationId: {
            type: Schema.Types.ObjectId,
            ref: 'Quotation',
            default: null,
            index: true
        },
        customerId: {
            type: Schema.Types.ObjectId,
            ref: 'Customer',
            default: null,
            index: true
        },
        metadata: {
            type: Schema.Types.Mixed,
            default: {}
        }
    },
    {timestamps: true}
);

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
