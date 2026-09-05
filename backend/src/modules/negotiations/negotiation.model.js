import mongoose, {Schema} from 'mongoose';

import {NEGOTIATION_MESSAGE_TYPES} from '../../core/constants.js';

const negotiationRequestSchema = new Schema(
    {
        quotationLineId: {
            type: Schema.Types.ObjectId,
            ref: 'QuotationLine',
            default: null
        },
        comment: {
            type: String,
            trim: true,
            default: null
        },
        requestedDiscountPercent: {
            type: Number,
            min: 0,
            max: 100,
            default: null
        },
        requestedDeliveryDate: {
            type: Date,
            default: null
        }
    },
    {_id: true}
);

const negotiationSchema = new Schema(
    {
        quotationId: {
            type: Schema.Types.ObjectId,
            ref: 'Quotation',
            required: true,
            index: true
        },
        quotationVersion: {
            type: Number,
            required: true,
            min: 1,
            index: true
        },
        customerId: {
            type: Schema.Types.ObjectId,
            ref: 'Customer',
            required: true,
            index: true
        },
        submittedById: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        status: {
            type: String,
            enum: ['DRAFT', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'],
            default: 'DRAFT',
            index: true
        },
        requests: {
            type: [negotiationRequestSchema],
            default: []
        }
    },
    {timestamps: true}
);

export const Negotiation = mongoose.model('Negotiation', negotiationSchema);

const negotiationMessageSchema = new Schema(
    {
        negotiationId: {
            type: Schema.Types.ObjectId,
            ref: 'Negotiation',
            required: true,
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
            min: 1,
            index: true
        },
        quotationLineId: {
            type: Schema.Types.ObjectId,
            ref: 'QuotationLine',
            default: null,
            index: true
        },
        messageType: {
            type: String,
            enum: Object.values(NEGOTIATION_MESSAGE_TYPES),
            required: true,
            index: true
        },
        message: {
            type: String,
            required: true,
            trim: true
        },
        proposedValue: {
            type: Schema.Types.Mixed,
            default: null
        },
        senderId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        senderRole: {
            type: String,
            required: true,
            trim: true
        }
    },
    {timestamps: true}
);

export const NegotiationMessage = mongoose.model('NegotiationMessage', negotiationMessageSchema);
