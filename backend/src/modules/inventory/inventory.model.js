import mongoose, { Schema } from 'mongoose';

const inventorySchema = new Schema(
    {
        warehouse_id: {
            type: Schema.Types.ObjectId,
            ref: 'Warehouse',
            required: true,
        },
        sku: {
            type: String,
            required: true,
            uppercase: true,
            trim: true,
        },
        on_hand: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
        },
        // Invariant reserved <= on_hand is enforced inside the reservation
        // transaction (fulfillment.service.js), not via schema validation,
        // since updates happen through atomic $inc inside a session.
        reserved: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
        },
        restock_at: {
            type: Date,
        },
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

inventorySchema.virtual('available').get(function available() {
    return this.on_hand - this.reserved;
});

inventorySchema.set('toJSON', { virtuals: true });
inventorySchema.set('toObject', { virtuals: true });

inventorySchema.index({ warehouse_id: 1, sku: 1 }, { unique: true });

export const Inventory = mongoose.model('Inventory', inventorySchema);
