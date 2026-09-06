import mongoose, {Schema} from 'mongoose';

import {ORDER_LINE_STATUSES} from '../../core/constants.js';

const orderLineSchema = new Schema(
    {
        orderId: {
            type: Schema.Types.ObjectId,
            ref: 'Order',
            required: true,
            index: true
        },
        quotationId: {
            type: Schema.Types.ObjectId,
            ref: 'Quotation',
            required: true,
            index: true
        },
        quotationLineId: {
            type: Schema.Types.ObjectId,
            ref: 'QuotationLine',
            required: true,
            index: true
        },
        productId: {
            type: Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        variantId: {
            type: Schema.Types.ObjectId,
            ref: 'ProductVariant',
            default: null
        },
        lineType: {
            type: String,
            enum: ['ONE_TIME', 'RECURRING'],
            required: true
        },
        sku: {
            type: String,
            default: null,
            trim: true
        },
        requestedQty: {
            type: Number,
            required: true,
            min: 0
        },
        allocatedQty: {
            type: Number,
            required: true,
            min: 0,
            default: 0
        },
        backorderQty: {
            type: Number,
            required: true,
            min: 0,
            default: 0
        },
        shippedQty: {
            type: Number,
            required: true,
            min: 0,
            default: 0
        },
        invoicedQty: {
            type: Number,
            required: true,
            min: 0,
            default: 0
        },
        unitPrice: {
            type: Number,
            required: true,
            min: 0
        },
        discountPercent: {
            type: Number,
            required: true,
            min: 0,
            max: 100
        },
        taxPercentage: {
            type: Number,
            required: true,
            min: 0,
            max: 100
        },
        lineTotal: {
            type: Number,
            required: true,
            min: 0
        },
        fulfillmentAllocationIds: [{
            type: Schema.Types.ObjectId,
            ref: 'FulfillmentAllocation'
        }],
        backorderIds: [{
            type: Schema.Types.ObjectId,
            ref: 'Backorder'
        }],
        invoiceLineIds: [{
            type: Schema.Types.ObjectId,
            ref: 'InvoiceLine'
        }],
        subscriptionId: {
            type: Schema.Types.ObjectId,
            ref: 'Subscription',
            default: null
        },
        status: {
            type: String,
            enum: Object.values(ORDER_LINE_STATUSES),
            default: ORDER_LINE_STATUSES.PENDING,
            index: true
        }
    },
    {timestamps: true}
);

orderLineSchema.index({orderId: 1, quotationLineId: 1}, {unique: true});

export const OrderLine = mongoose.model('OrderLine', orderLineSchema);
