import mongoose, { Schema } from 'mongoose';

/**
 * PLACEHOLDER MODEL. See quotation.model.js for context.
 */
const quotationLineSchema = new Schema(
    {
        quotation_id: {
            type: Schema.Types.ObjectId,
            ref: 'Quotation',
            required: true,
        },
        product_id: {
            type: Schema.Types.ObjectId,
            ref: 'Product',
            required: true,
        },
        qty: {
            type: Number,
            required: true,
            min: 1,
        },
        unit_price_cents: {
            type: Number,
            required: true,
            min: 0,
        },
        discount_pct: {
            type: Number,
            default: 0,
            min: 0,
            max: 100,
        },
        tax_pct: {
            type: Number,
            default: 0,
            min: 0,
        },
        billing_type: {
            type: String,
            enum: ['one_time_stock', 'one_time_service', 'recurring'],
            required: true,
        },
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export const QuotationLine = mongoose.model('QuotationLine', quotationLineSchema);
