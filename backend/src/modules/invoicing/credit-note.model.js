import mongoose, { Schema } from 'mongoose';

const creditNoteSchema = new Schema(
    {
        customer_id: {
            type: Schema.Types.ObjectId,
            ref: 'Customer',
            required: true,
        },
        invoice_id: {
            type: Schema.Types.ObjectId,
            ref: 'Invoice',
        },
        subscription_change_id: {
            type: Schema.Types.ObjectId,
            ref: 'SubscriptionChange',
        },
        amount_cents: {
            type: Number,
            required: true,
            min: 1,
        },
        reason: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            enum: ['ISSUED', 'APPLIED', 'VOID'],
            default: 'ISSUED',
        },
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export const CreditNote = mongoose.model('CreditNote', creditNoteSchema);
