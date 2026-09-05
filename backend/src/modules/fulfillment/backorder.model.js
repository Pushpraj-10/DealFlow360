import mongoose, { Schema } from 'mongoose';

const backorderSchema = new Schema(
    {
        fulfillment_id: {
            type: Schema.Types.ObjectId,
            ref: 'Fulfillment',
            required: true,
        },
        quote_line_id: {
            type: Schema.Types.ObjectId,
            ref: 'QuotationLine',
            required: true,
        },
        qty: {
            type: Number,
            required: true,
            min: 0,
        },
        status: {
            type: String,
            enum: ['OPEN', 'PARTIALLY_RESOLVED', 'RESOLVED'],
            default: 'OPEN',
        },
        resolved_at: {
            type: Date,
        },
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

backorderSchema.index({ fulfillment_id: 1, status: 1 });

export const Backorder = mongoose.model('Backorder', backorderSchema);
