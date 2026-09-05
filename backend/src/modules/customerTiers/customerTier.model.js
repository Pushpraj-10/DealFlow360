import mongoose, {Schema} from 'mongoose';

const customerTierSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            unique: true,
            index: true
        },
        defaultMaxDiscountPercent: {
            type: Number,
            required: true,
            min: 0,
            max: 100
        },
        description: {
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

export const CustomerTier = mongoose.model('CustomerTier', customerTierSchema);
