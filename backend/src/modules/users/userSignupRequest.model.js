import mongoose, {Schema} from 'mongoose';

import {SIGNUP_REQUEST_STATUSES, USER_ROLES} from '../../core/constants.js';

const SIGNUP_REQUEST_ROLES = Object.values(USER_ROLES);

const userSignupRequestSchema = new Schema(
    {
        fullName: {
            type: String,
            required: true,
            trim: true
        },
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
            index: true
        },
        passwordHash: {
            type: String,
            required: true,
            select: false
        },
        // What the requester is asking for, not what they're granted -
        // final role/team are only set on the User created at approval time.
        proposedRole: {
            type: String,
            enum: SIGNUP_REQUEST_ROLES,
            required: true
        },
        proposedTeam: {
            type: String,
            default: null,
            trim: true
        },
        customerName: {
            type: String,
            default: null,
            trim: true
        },
        customerCompany: {
            type: String,
            default: null,
            trim: true
        },
        customerPhone: {
            type: String,
            default: null,
            trim: true
        },
        status: {
            type: String,
            enum: Object.values(SIGNUP_REQUEST_STATUSES),
            default: SIGNUP_REQUEST_STATUSES.PENDING,
            index: true
        },
        reviewedById: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
        reviewedAt: {
            type: Date,
            default: null
        },
        reviewNote: {
            type: String,
            default: null,
            trim: true
        },
        createdUserId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null
        }
    },
    {timestamps: true}
);

userSignupRequestSchema.methods.toSafeObject = function toSafeObject() {
    return {
        id: this._id,
        fullName: this.fullName,
        email: this.email,
        proposedRole: this.proposedRole,
        proposedTeam: this.proposedTeam,
        customerName: this.customerName,
        customerCompany: this.customerCompany,
        customerPhone: this.customerPhone,
        status: this.status,
        reviewedById: this.reviewedById,
        reviewedAt: this.reviewedAt,
        reviewNote: this.reviewNote,
        createdUserId: this.createdUserId,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
    };
};

export const UserSignupRequest = mongoose.model('UserSignupRequest', userSignupRequestSchema);
