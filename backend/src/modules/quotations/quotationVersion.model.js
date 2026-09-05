import mongoose, {Schema} from 'mongoose';

const quotationVersionSchema = new Schema(
    {
        quotationId: {
            type: Schema.Types.ObjectId,
            ref: 'Quotation',
            required: true,
            index: true
        },
        versionNumber: {
            type: Number,
            required: true,
            min: 1,
            index: true
        },
        status: {
            type: String,
            required: true,
            trim: true
        },
        approvalStatus: {
            type: String,
            required: true,
            trim: true
        },
        riskScore: {
            type: Number,
            default: 0
        },
        riskSeverity: {
            type: String,
            default: 'NONE'
        },
        totals: {
            type: Schema.Types.Mixed,
            required: true
        },
        lines: {
            type: [Schema.Types.Mixed],
            default: []
        },
        snapshotReason: {
            type: String,
            trim: true,
            default: null
        },
        createdById: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null
        }
    },
    {timestamps: true}
);

quotationVersionSchema.index({quotationId: 1, versionNumber: 1}, {unique: true});

export const QuotationVersion = mongoose.model('QuotationVersion', quotationVersionSchema);
