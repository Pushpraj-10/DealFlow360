import mongoose, {Schema} from 'mongoose';

const quotationLineSchema = new Schema(
    {
        quotationId: {
            type: Schema.Types.ObjectId,
            ref: 'Quotation',
            required: true,
            index: true
        },
        productId: {
            type: Schema.Types.ObjectId,
            ref: 'Product',
            required: true,
            index: true
        },
        variantId: {
            type: Schema.Types.ObjectId,
            ref: 'ProductVariant',
            default: null
        },
        lineType: {
            type: String,
            enum: ['ONE_TIME', 'RECURRING'],
            default: 'ONE_TIME',
            index: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        unitPrice: {
            type: Number,
            required: true,
            min: 0
        },
        costPrice: {
            type: Number,
            required: true,
            min: 0
        },
        discountPercent: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },
        taxPercentage: {
            type: Number,
            required: true,
            min: 0,
            max: 100
        },
        tax: {
            type: Number,
            required: true,
            min: 0
        },
        lineSubtotal: {
            type: Number,
            required: true,
            min: 0
        },
        discountAmount: {
            type: Number,
            required: true,
            min: 0
        },
        revenueAfterDiscount: {
            type: Number,
            required: true,
            min: 0
        },
        totalCost: {
            type: Number,
            required: true,
            min: 0
        },
        lineTotal: {
            type: Number,
            required: true,
            min: 0
        },
        margin: {
            type: Number,
            required: true
        },
        marginAmount: {
            type: Number,
            required: true
        },
        grossMarginAmount: {
            type: Number,
            required: true
        },
        marginPercentage: {
            type: Number,
            required: true
        },
        allowedDiscountPercent: {
            type: Number,
            required: true,
            min: 0,
            max: 100
        },
        allowed_discount: {
            type: Number,
            required: true,
            min: 0,
            max: 100
        },
        actual_discount: {
            type: Number,
            required: true,
            min: 0,
            max: 100
        },
        excess_discount: {
            type: Number,
            required: true,
            min: 0
        },
        is_violation: {
            type: Boolean,
            required: true,
            default: false,
            index: true
        },
        violationAmount: {
            type: Number,
            required: true,
            min: 0
        },
        description: {
            type: String,
            trim: true,
            default: null
        }
    },
    {timestamps: true}
);

export const QuotationLine = mongoose.model('QuotationLine', quotationLineSchema);
