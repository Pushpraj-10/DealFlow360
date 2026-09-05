import mongoose, {Schema} from 'mongoose';

const priceListItemSchema = new Schema(
    {
        productId: {
            type: Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        variantId: {
            type: Schema.Types.ObjectId,
            ref: 'ProductVariant',
            default: null
        },
        unitPrice: {
            type: Number,
            required: true,
            min: 0
        },
        basePriceOverride: {
            type: Number,
            required: true,
            min: 0
        },
        validFrom: {
            type: Date,
            default: null
        },
        validTo: {
            type: Date,
            default: null
        }
    },
    {_id: true}
);

const priceListSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            unique: true,
            index: true
        },
        customerTierId: {
            type: Schema.Types.ObjectId,
            ref: 'CustomerTier',
            required: true,
            index: true
        },
        currencyCode: {
            type: String,
            required: true,
            uppercase: true,
            trim: true,
            default: 'USD'
        },
        items: {
            type: [priceListItemSchema],
            default: []
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true
        }
    },
    {timestamps: true}
);

priceListSchema.index({customerTierId: 1, currencyCode: 1, isActive: 1});

export const PriceList = mongoose.model('PriceList', priceListSchema);
