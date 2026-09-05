import mongoose, { Schema } from 'mongoose';

/**
 * PLACEHOLDER MODEL.
 * Quotation/approval workflow is owned by the Sales Rep Workspace scope.
 * A confirmed Quotation is treated as "the order" in this scope (see
 * Fulfillment.quotation_id) - there is deliberately no separate Order model.
 * Minimal fields kept here so Fulfillment/Deal-Health can read what they
 * need. Whoever builds the real Quotation module should extend this in
 * place rather than creating a parallel collection.
 */
const quotationSchema = new Schema(
    {
        quote_no: {
            type: String,
            required: true,
            unique: true,
        },
        customer_id: {
            type: Schema.Types.ObjectId,
            ref: 'Customer',
            required: true,
        },
        owner_id: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        status: {
            type: String,
            default: 'draft',
        },
        requested_delivery_date: {
            type: Date,
        },
        last_activity_at: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export const Quotation = mongoose.model('Quotation', quotationSchema);
