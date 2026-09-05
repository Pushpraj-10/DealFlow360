import mongoose, {Schema} from 'mongoose';

import {PRODUCT_BILLING_TYPES, PRODUCT_STATUSES} from '../../core/constants.js';

const productSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            index: true
        },
        categoryId: {
            type: Schema.Types.ObjectId,
            ref: 'Category',
            required: true,
            index: true
        },
        productType: {
            type: String,
            required: true,
            trim: true,
            index: true
        },
        billingType: {
            type: String,
            enum: Object.values(PRODUCT_BILLING_TYPES),
            required: true,
            index: true
        },
        basePrice: {
            type: Number,
            required: true,
            min: 0
        },
        costPrice: {
            type: Number,
            required: true,
            min: 0
        },
        taxPercentage: {
            type: Number,
            required: true,
            min: 0,
            max: 100
        },
        unit: {
            type: String,
            required: true,
            trim: true,
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true
        },
        // Added for the fulfillment/inventory scope: whether this product is
        // a physical good that flows through warehouse allocation, or a
        // service/subscription that bypasses it entirely. Additive field -
        // does not affect any existing behavior.
        isStockManaged: {
            type: Boolean,
            default: true,
            index: true
        },
        status: {
            type: String,
            enum: Object.values(PRODUCT_STATUSES),
            default: PRODUCT_STATUSES.ACTIVE,
            index: true
        },
        description: {
            type: String,
            trim: true,
            default: null
        },
        recurringPlanReference: {
            type: String,
            trim: true,
            default: null
        },
    },
    {timestamps: true}
);

productSchema.index({name: 1, categoryId: 1}, {unique: true});

export const Product = mongoose.model('Product', productSchema);
