import mongoose, { Schema } from 'mongoose';

const fulfillmentSchema = new Schema(
    {
        quotation_id: {
            type: Schema.Types.ObjectId,
            ref: 'Quotation',
            required: true,
            unique: true,
        },
        status: {
            type: String,
            enum: [
                'NOT_READY',
                'SPLIT_PROPOSED',
                'RESERVED',
                'PARTIALLY_SHIPPED',
                'SHIPPED',
                'BACKORDER',
                'PARTIAL_BACKORDER',
            ],
            default: 'NOT_READY',
        },
        proposed_at: {
            type: Date,
        },
        accepted_at: {
            type: Date,
        },
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export const Fulfillment = mongoose.model('Fulfillment', fulfillmentSchema);
