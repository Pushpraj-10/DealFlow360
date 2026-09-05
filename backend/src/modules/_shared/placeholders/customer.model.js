import mongoose, { Schema } from 'mongoose';

/**
 * PLACEHOLDER MODEL.
 * Customer is owned by the Sales Backend / Admin scope of the project
 * (product catalog, price lists, quotation workflow). This is a minimal
 * schema with only the fields the Fulfillment/Subscriptions/Invoicing/
 * Deal-Health modules need to read or reference. Whoever builds the real
 * Customer module should extend this in place rather than creating a
 * second collection.
 */
const customerSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        tier: {
            type: String,
            enum: ['Bronze', 'Silver', 'Gold'],
            default: 'Bronze',
        },
        currency_code: {
            type: String,
            default: 'USD',
        },
        email: {
            type: String,
            trim: true,
            lowercase: true,
        },
        status: {
            type: String,
            enum: ['active', 'archived'],
            default: 'active',
        },
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export const Customer = mongoose.model('Customer', customerSchema);
