import mongoose, {Schema} from 'mongoose';

const recommendationRuleSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            index: true
        },
        sourceProductId: {
            type: Schema.Types.ObjectId,
            ref: 'Product',
            required: true,
            index: true
        },
        recommendedProductId: {
            type: Schema.Types.ObjectId,
            ref: 'Product',
            required: true,
            index: true
        },
        reason: {
            type: String,
            trim: true,
            default: null
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true
        }
    },
    {timestamps: true}
);

export const RecommendationRule = mongoose.model('RecommendationRule', recommendationRuleSchema);
