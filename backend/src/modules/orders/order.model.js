import mongoose, {Schema} from 'mongoose';

import {ORDER_STATUSES} from '../../core/constants.js';

const orderSchema = new Schema(
    {
        orderNumber: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        quotationId: {
            type: Schema.Types.ObjectId,
            ref: 'Quotation',
            required: true,
            index: true
        },
        quotationVersion: {
            type: Number,
            required: true,
            min: 1
        },
        customerId: {
            type: Schema.Types.ObjectId,
            ref: 'Customer',
            required: true,
            index: true
        },
        confirmedById: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
        fulfillmentId: {
            type: Schema.Types.ObjectId,
            ref: 'Fulfillment',
            default: null
        },
        status: {
            type: String,
            enum: Object.values(ORDER_STATUSES),
            default: ORDER_STATUSES.CONFIRMED,
            index: true
        },
        fulfillmentStatus: {
            type: String,
            default: null
        },
        billingStatus: {
            type: String,
            default: null
        },
        subtotal: {
            type: Number,
            required: true,
            min: 0,
            default: 0
        },
        totalDiscount: {
            type: Number,
            required: true,
            min: 0,
            default: 0
        },
        tax: {
            type: Number,
            required: true,
            min: 0,
            default: 0
        },
        grandTotal: {
            type: Number,
            required: true,
            min: 0,
            default: 0
        },
        currencyCode: {
            type: String,
            required: true,
            default: 'USD',
            trim: true
        },
        flow: {
            orderCreatedAt: {
                type: Date,
                default: Date.now
            },
            orderLinesCreatedAt: {
                type: Date,
                default: null
            },
            inventoryCheckedAt: {
                type: Date,
                default: null
            },
            fulfillmentCreatedAt: {
                type: Date,
                default: null
            },
            splitSuggestedAt: {
                type: Date,
                default: null
            },
            billingPreparedAt: {
                type: Date,
                default: null
            },
            statusSyncedAt: {
                type: Date,
                default: null
            },
            lastRetryAt: {
                type: Date,
                default: null
            },
            lastFailedStage: {
                type: String,
                default: null
            },
            lastError: {
                type: String,
                default: null
            }
        }
    },
    {timestamps: true}
);

orderSchema.index({quotationId: 1, quotationVersion: 1}, {unique: true});

export const Order = mongoose.model('Order', orderSchema);
