import mongoose, {Schema} from 'mongoose';

import {CUSTOMER_STATUSES} from '../../core/constants.js';

const customerSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            index: true
        },
        tierId: {
            type: Schema.Types.ObjectId,
            ref: 'CustomerTier',
            required: true,
            index: true
        },
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
            index: true
        },
        company: {
            type: String,
            required: true,
            trim: true,
            index: true
        },
        phone: {
            type: String,
            trim: true,
            default: null
        },
        contactPerson: {
            type: String,
            trim: true,
            default: null
        },
        address: {
            street: {
                type: String,
                trim: true,
                default: null
            },
            city: {
                type: String,
                trim: true,
                default: null
            },
            state: {
                type: String,
                trim: true,
                default: null
            },
            postalCode: {
                type: String,
                trim: true,
                default: null
            },
            country: {
                type: String,
                trim: true,
                default: null
            }
        },
        status: {
            type: String,
            enum: Object.values(CUSTOMER_STATUSES),
            default: CUSTOMER_STATUSES.ACTIVE,
            index: true
        }
    },
    {timestamps: true}
);

customerSchema.index({company: 1, email: 1}, {unique: true});

export const Customer = mongoose.model('Customer', customerSchema);
