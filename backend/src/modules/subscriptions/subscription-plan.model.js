import mongoose, { Schema } from 'mongoose';

const subscriptionPlanSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        cycle: {
            type: String,
            enum: ['weekly', 'monthly', 'quarterly', 'yearly'],
            required: true,
        },
        proration_policy: {
            type: String,
            enum: ['daily_calendar'],
            default: 'daily_calendar',
        },
        cancellation_policy: {
            type: String,
            enum: ['none', 'credit_remaining', 'full_refund'],
            default: 'credit_remaining',
        },
        active: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export const SubscriptionPlan = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
