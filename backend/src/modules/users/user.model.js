import mongoose, {Schema} from 'mongoose';

import {USER_ROLES, USER_STATUSES} from '../../core/constants.js';

const userSchema = new Schema(
    {
        fullName: {
            type: String,
            required: true,
            trim: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true
        },
        passwordHash: {
            type: String,
            required: true,
            select: false
        },
        role: {
            type: String,
            enum: Object.values(USER_ROLES),
            required: true,
            index: true
        },
        status: {
            type: String,
            enum: Object.values(USER_STATUSES),
            default: USER_STATUSES.ACTIVE,
            index: true
        },
        customerId: {
            type: Schema.Types.ObjectId,
            ref: 'Customer',
            default: null,
            index: true
        },
        lastLoginAt: {
            type: Date,
            default: null
        },
        // Free-form team identifier, used by the reports/deal-health scope's
        // team filter. Additive field - does not affect any existing behavior.
        team: {
            type: String,
            default: null
        }
    },
    {timestamps: true}
);

userSchema.methods.toSafeObject = function toSafeObject() {
    return {
        id: this._id,
        fullName: this.fullName,
        email: this.email,
        role: this.role,
        status: this.status,
        customerId: this.customerId,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
    };
};

export const User = mongoose.model('User', userSchema);
