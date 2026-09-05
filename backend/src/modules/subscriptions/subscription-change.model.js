import mongoose, { Schema } from 'mongoose';

const subscriptionChangeSchema = new Schema(
    {
        subscription_id: {
            type: Schema.Types.ObjectId,
            ref: 'Subscription',
            required: true,
        },
        effective_at: {
            type: Date,
            default: Date.now,
        },
        old_qty: { type: Number },
        new_qty: { type: Number },
        old_plan_id: {
            type: Schema.Types.ObjectId,
            ref: 'SubscriptionPlan',
        },
        new_plan_id: {
            type: Schema.Types.ObjectId,
            ref: 'SubscriptionPlan',
        },
        old_unit_price_cents: { type: Number },
        new_unit_price_cents: { type: Number },
        prorated_delta_cents: {
            type: Number,
            required: true,
        },
        credit_note_id: {
            type: Schema.Types.ObjectId,
            ref: 'CreditNote',
            default: null,
        },
        reason: {
            type: String,
            default: '',
        },
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

subscriptionChangeSchema.index({ subscription_id: 1 });

export const SubscriptionChange = mongoose.model('SubscriptionChange', subscriptionChangeSchema);
