import mongoose, {Schema} from 'mongoose';

const upsellRuleSchema = new Schema(
    {
        sourceProductId: {
            type: Schema.Types.ObjectId,
            ref: 'Product',
            required: true,
            index: true
        },
        suggestedProductIds: {
            type: [{
                type: Schema.Types.ObjectId,
                ref: 'Product'
            }],
            validate: {
                validator: (value) => Array.isArray(value) && value.length > 0,
                message: 'At least one suggested product is required'
            }
        },
        coPurchaseScore: {
            type: Number,
            required: true,
            min: 0,
            default: 0
        },
        promotionBoost: {
            type: Number,
            required: true,
            min: 0,
            default: 0
        },
        minimumRequiredMarginPercent: {
            type: Number,
            required: true,
            min: 0,
            max: 100,
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

upsellRuleSchema.index({sourceProductId: 1, isActive: 1});

export const UpsellRule = mongoose.model('UpsellRule', upsellRuleSchema);
