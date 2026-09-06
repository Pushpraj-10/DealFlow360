import mongoose, { Schema } from 'mongoose';

const subscriptionSchema = new Schema(
    {
        customer_id: {
            type: Schema.Types.ObjectId,
            ref: 'Customer',
            required: true,
        },
        originating_quote_line_id: {
            type: Schema.Types.ObjectId,
            ref: 'QuotationLine',
            required: true,
        },
        plan_id: {
            type: Schema.Types.ObjectId,
            ref: 'SubscriptionPlan',
            required: true,
        },
        status: {
            type: String,
            enum: ['DRAFT', 'ACTIVE', 'PAUSED', 'CANCELLED'],
            default: 'DRAFT',
        },
        start_date: {
            type: Date,
            required: true,
        },
        next_bill_date: {
            type: Date,
            required: true,
        },
        qty: {
            type: Number,
            required: true,
            min: 1,
            default: 1,
        },
        recurring_unit_price_cents: {
            type: Number,
            required: true,
            min: 0,
        },
        current_period_start: {
            type: Date,
            required: true,
        },
        current_period_end: {
            type: Date,
            required: true,
        },
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

subscriptionSchema.index({ customer_id: 1 });
subscriptionSchema.index({ status: 1 });
subscriptionSchema.index({ originating_quote_line_id: 1 }, { unique: true });

export const Subscription = mongoose.model('Subscription', subscriptionSchema);
