import mongoose, { Schema } from 'mongoose';

const warehouseSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        // Dimensionless comparison weight used by the split algorithm to prefer
        // cheaper-to-ship warehouses. Not a currency amount.
        shipping_cost_weight: {
            type: Number,
            required: true,
            default: 1,
            min: 0,
        },
        active: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export const Warehouse = mongoose.model('Warehouse', warehouseSchema);
