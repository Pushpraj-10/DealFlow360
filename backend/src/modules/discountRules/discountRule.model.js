import mongoose, {Schema} from 'mongoose';

const discountRuleSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            index: true
        },
        customerTierId: {
            type: Schema.Types.ObjectId,
            ref: 'CustomerTier',
            default: null,
            index: true
        },
        categoryId: {
            type: Schema.Types.ObjectId,
            ref: 'Category',
            default: null,
            index: true
        },
        maxDiscountPercent: {
            type: Number,
            required: true,
            min: 0,
            max: 100
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true
        }
    },
    {timestamps: true}
);

export const DiscountRule = mongoose.model('DiscountRule', discountRuleSchema);
