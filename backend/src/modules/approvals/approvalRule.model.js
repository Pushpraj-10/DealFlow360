import mongoose, {Schema} from 'mongoose';

import {USER_ROLES} from '../../core/constants.js';

const approvalRuleSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            unique: true,
            index: true
        },
        minRiskScore: {
            type: Number,
            required: true,
            min: 0
        },
        maxRiskScore: {
            type: Number,
            required: true,
            min: 0
        },
        minExcessDiscountExposure: {
            type: Number,
            default: 0,
            min: 0
        },
        maxExcessDiscountExposure: {
            type: Number,
            default: Number.MAX_SAFE_INTEGER,
            min: 0
        },
        severity: {
            type: String,
            enum: ['NONE', 'LOW', 'MEDIUM', 'HIGH'],
            required: true,
            index: true
        },
        requiredApprovalRoles: {
            type: [{
                type: String,
                enum: [
                    USER_ROLES.SALES_MANAGER,
                    USER_ROLES.FINANCE,
                    USER_ROLES.ADMIN
                ]
            }],
            default: []
        },
        priority: {
            type: Number,
            default: 100,
            index: true
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true
        }
    },
    {timestamps: true}
);

approvalRuleSchema.index({isActive: 1, priority: 1});

export const ApprovalRule = mongoose.model('ApprovalRule', approvalRuleSchema);
