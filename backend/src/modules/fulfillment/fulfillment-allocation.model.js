import mongoose, { Schema } from 'mongoose';

const fulfillmentAllocationSchema = new Schema(
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
        warehouse_id: {
            type: Schema.Types.ObjectId,
            ref: 'Warehouse',
            required: true,
        },
        allocated_qty: {
            type: Number,
            required: true,
            min: 0,
        },
        shipped_qty: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
        },
        // Dimensionless comparison score (allocated_qty * warehouse.shipping_cost_weight),
        // not a currency amount.
        est_cost: {
            type: Number,
            required: true,
            default: 0,
        },
        status: {
            type: String,
            enum: ['PROPOSED', 'RESERVED', 'PARTIALLY_SHIPPED', 'SHIPPED'],
            default: 'PROPOSED',
        },
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

fulfillmentAllocationSchema.index({ fulfillment_id: 1 });
fulfillmentAllocationSchema.index({ quote_line_id: 1 });

export const FulfillmentAllocation = mongoose.model(
    'FulfillmentAllocation',
    fulfillmentAllocationSchema
);
