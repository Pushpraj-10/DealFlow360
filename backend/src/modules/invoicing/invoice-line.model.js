import mongoose, { Schema } from 'mongoose';

const invoiceLineSchema = new Schema(
    {
        invoice_id: {
            type: Schema.Types.ObjectId,
            ref: 'Invoice',
            required: true,
        },
        source_type: {
            type: String,
            enum: ['shipment', 'service', 'subscription', 'credit'],
            required: true,
        },
        // FulfillmentAllocation id (shipment) / QuotationLine id (service) /
        // Subscription id (subscription) / CreditNote id (credit), depending
        // on source_type.
        source_id: {
            type: Schema.Types.ObjectId,
            required: true,
        },
        description: {
            type: String,
            default: '',
        },
        qty: {
            type: Number,
            required: true,
            min: 0,
            default: 1,
        },
        unit_price_cents: {
            type: Number,
            required: true,
        },
        tax_cents: {
            type: Number,
            default: 0,
        },
        // Can be negative for source_type: 'credit' lines.
        amount_cents: {
            type: Number,
            required: true,
        },
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

invoiceLineSchema.index({ source_type: 1, source_id: 1 });

export const InvoiceLine = mongoose.model('InvoiceLine', invoiceLineSchema);
