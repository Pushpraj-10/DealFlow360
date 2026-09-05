import mongoose, {Schema} from 'mongoose';

const categorySchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            unique: true,
            index: true
        },
        description: {
            type: String,
            trim: true,
            default: null
        },
        maxAllowedDiscountPercent: {
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

export const Category = mongoose.model('Category', categorySchema);
