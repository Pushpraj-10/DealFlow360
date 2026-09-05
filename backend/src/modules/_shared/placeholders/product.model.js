import mongoose, { Schema } from 'mongoose';

/**
 * PLACEHOLDER MODEL.
 * Product/PriceList catalog is owned by the Sales Backend / Admin scope.
 * Minimal fields kept here so Fulfillment (is_stock_managed) and Invoicing
 * (source_type selection, pricing snapshot) can read what they need.
 * Whoever builds the real Product module should extend this in place.
 */
const productSchema = new Schema(
    {
        sku: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
            trim: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        category: {
            type: String,
            trim: true,
        },
        base_price_cents: {
            type: Number,
            required: true,
            min: 0,
        },
        unit_cost_cents: {
            type: Number,
            default: 0,
            min: 0,
        },
        unit: {
            type: String,
            default: 'unit',
        },
        tax_pct: {
            type: Number,
            default: 0,
            min: 0,
        },
        is_subscription: {
            type: Boolean,
            default: false,
        },
        // Drives fulfillment (only stock-managed lines get warehouse allocation)
        // and invoicing (source_type branching) decisions.
        is_stock_managed: {
            type: Boolean,
            default: true,
        },
        status: {
            type: String,
            enum: ['active', 'archived'],
            default: 'active',
        },
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export const Product = mongoose.model('Product', productSchema);
