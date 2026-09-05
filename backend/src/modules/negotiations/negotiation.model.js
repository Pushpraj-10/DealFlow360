import mongoose, {Schema} from 'mongoose';

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
