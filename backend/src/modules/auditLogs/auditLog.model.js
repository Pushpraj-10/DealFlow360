import mongoose, {Schema} from 'mongoose';

const auditLogSchema = new Schema(
    {
        eventType: {
            type: String,
            required: true,
            trim: true,
            index: true
        },
        action: {
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
        role: {
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
        reason: {
            type: String,
            trim: true,
            default: null
        },
        before: {
            type: Schema.Types.Mixed,
            default: null
        },
        after: {
            type: Schema.Types.Mixed,
            default: null
        },
        metadata: {
            type: Schema.Types.Mixed,
            default: {}
        }
    },
    {timestamps: true}
);

auditLogSchema.pre('save', function preventAuditMutation() {
    if (!this.isNew && this.isModified()) {
        throw new Error('AuditLog entries are immutable');
    }
});

auditLogSchema.pre(['updateOne', 'findOneAndUpdate', 'updateMany', 'replaceOne', 'deleteOne', 'deleteMany', 'findOneAndDelete'], function blockAuditWrites() {
    throw new Error('AuditLog entries are immutable');
});

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
