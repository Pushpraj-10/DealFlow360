import mongoose, { Schema } from 'mongoose';

const dealAlertSchema = new Schema(
    {
        quotation_id: {
            type: Schema.Types.ObjectId,
            ref: 'Quotation',
            required: true,
        },
        type: {
            type: String,
            enum: ['STALLED', 'DISCOUNT_ANOMALY', 'DELIVERY_SLIPPAGE'],
            required: true,
        },
        severity: {
            type: String,
            enum: ['LOW', 'MEDIUM', 'HIGH'],
            required: true,
        },
        status: {
            type: String,
            enum: ['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED'],
            default: 'OPEN',
        },
        details: {
            type: Schema.Types.Mixed,
            default: {},
        },
        resolved_at: {
            type: Date,
        },
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

dealAlertSchema.index({ status: 1, type: 1 });
dealAlertSchema.index({ quotation_id: 1 });

export const DealAlert = mongoose.model('DealAlert', dealAlertSchema);
