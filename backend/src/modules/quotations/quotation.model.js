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
    // optimisticConcurrency: without it, Mongoose's __v check only guards
    // array-subdocument mutations by default, not plain scalar field saves
    // like the status transitions in quotationState.service.js - so two
    // concurrent requests (e.g. a double-clicked customer "Confirm") could
    // both load the same quotation, both .save() successfully, and both
    // "win" a transition that should only ever happen once. This makes
    // every .save() include the loaded __v in its update filter, so the
    // loser's save throws a VersionError (translated to a clean 409 by the
    // error middleware) instead of silently applying a stale change.
    {timestamps: true, optimisticConcurrency: true}
);

export const Quotation = mongoose.model('Quotation', quotationSchema);
