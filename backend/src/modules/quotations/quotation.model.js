import mongoose, {Schema} from 'mongoose';

import {APPROVAL_STATUSES, QUOTATION_STATUSES} from '../../core/constants.js';

const quotationSchema = new Schema(
    {
        quoteNumber: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            index: true
        },
        customerId: {
            type: Schema.Types.ObjectId,
            ref: 'Customer',
            required: true,
            index: true
        },
        salesRepId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        ownerId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        status: {
            type: String,
            enum: Object.values(QUOTATION_STATUSES),
            default: QUOTATION_STATUSES.DRAFT,
            index: true
        },
        currencyCode: {
            type: String,
            default: 'USD',
            uppercase: true,
            trim: true
        },
        subtotal: {
            type: Number,
            default: 0,
            min: 0
        },
        totalDiscount: {
            type: Number,
            default: 0,
            min: 0
        },
        totalRevenueAfterDiscount: {
            type: Number,
            default: 0,
            min: 0
        },
        totalCost: {
            type: Number,
            default: 0,
            min: 0
        },
        tax: {
            type: Number,
            default: 0,
            min: 0
        },
        grandTotal: {
            type: Number,
            default: 0,
            min: 0
        },
        margin: {
            type: Number,
            default: 0
        },
        totalMarginAmount: {
            type: Number,
            default: 0
        },
        grossMarginAmount: {
            type: Number,
            default: 0
        },
        marginPercentage: {
            type: Number,
            default: 0
        },
        riskScore: {
            type: Number,
            default: 0,
            min: 0
        },
        riskSeverity: {
            type: String,
            enum: ['NONE', 'LOW', 'MEDIUM', 'HIGH'],
            default: 'NONE',
            index: true
        },
        approvalStatus: {
            type: String,
            enum: Object.values(APPROVAL_STATUSES),
            default: APPROVAL_STATUSES.NOT_REQUIRED,
            index: true
        },
        currentVersion: {
            type: Number,
            default: 1,
            min: 1
        },
        // Added for the deal-health scope's delivery-slippage rule. Additive
        // field - does not affect any existing behavior.
        requestedDeliveryDate: {
            type: Date,
            default: null
        },
        confirmedById: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
        confirmedAt: {
            type: Date,
            default: null
        },
        confirmedVersion: {
            type: Number,
            default: null,
            min: 1
        }
    },
    {timestamps: true}
);

export const Quotation = mongoose.model('Quotation', quotationSchema);
