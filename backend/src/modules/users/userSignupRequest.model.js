import mongoose, {Schema} from 'mongoose';

import {INTERNAL_ROLES, SIGNUP_REQUEST_STATUSES} from '../../core/constants.js';

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
            enum: INTERNAL_ROLES,
            required: true
        },
        proposedTeam: {
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
