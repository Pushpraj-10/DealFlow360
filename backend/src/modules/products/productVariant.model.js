import mongoose, {Schema} from 'mongoose';

const productVariantSchema = new Schema(
    {
        productId: {
            type: Schema.Types.ObjectId,
            ref: 'Product',
            required: true,
            index: true
        },
        sku: {
            type: String,
            required: true,
            trim: true,
            unique: true,
            index: true
        },
        name: {
            type: String,
            trim: true,
            default: null
        },
        attributes: {
            type: Map,
            of: String,
            default: {}
        },
        extraPrice: {
            type: Number,
            required: true,
            min: 0,
            default: 0
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true
        }
    },
    {timestamps: true}
);

productVariantSchema.index({productId: 1, sku: 1}, {unique: true});

export const ProductVariant = mongoose.model('ProductVariant', productVariantSchema);
