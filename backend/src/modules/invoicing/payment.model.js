import mongoose, { Schema } from 'mongoose';

const paymentSchema = new Schema(
    {
        invoice_id: {
            type: Schema.Types.ObjectId,
            ref: 'Invoice',
            required: true,
        },
        amount_cents: {
            type: Number,
            required: true,
            min: 1,
        },
        paid_at: {
            type: Date,
            default: Date.now,
        },
        method: {
            type: String,
            enum: ['cash', 'bank_transfer', 'card', 'other'],
            default: 'other',
        },
        reference: {
            type: String,
            default: '',
        },
        recorded_by: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

paymentSchema.index({ invoice_id: 1 });

export const Payment = mongoose.model('Payment', paymentSchema);
