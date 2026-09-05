import mongoose, { Schema } from 'mongoose';

const invoiceSchema = new Schema(
    {
        invoice_no: {
            type: String,
            required: true,
            unique: true,
        },
        customer_id: {
            type: Schema.Types.ObjectId,
            ref: 'Customer',
            required: true,
        },
        quotation_id: {
            type: Schema.Types.ObjectId,
            ref: 'Quotation',
        },
        subscription_id: {
            type: Schema.Types.ObjectId,
            ref: 'Subscription',
        },
        // e.g. '2026-09'. Combined with subscription_id in a unique partial
        // index below to guarantee idempotent recurring invoice generation.
        billing_period: {
            type: String,
        },
        status: {
            type: String,
            enum: ['DRAFT', 'UNPAID', 'PARTIALLY_PAID', 'PAID', 'CREDITED', 'VOIDED'],
            default: 'DRAFT',
        },
        issue_date: {
            type: Date,
            default: Date.now,
        },
        due_date: {
            type: Date,
            required: true,
        },
        currency: {
            type: String,
            default: 'USD',
        },
        subtotal_cents: { type: Number, required: true, min: 0, default: 0 },
        tax_cents: { type: Number, required: true, min: 0, default: 0 },
        total_cents: { type: Number, required: true, min: 0, default: 0 },
        paid_amount_cents: { type: Number, required: true, min: 0, default: 0 },
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

invoiceSchema.index(
    { subscription_id: 1, billing_period: 1 },
    {
        unique: true,
        partialFilterExpression: {
            subscription_id: { $exists: true },
            billing_period: { $exists: true },
        },
    }
);

export const Invoice = mongoose.model('Invoice', invoiceSchema);
