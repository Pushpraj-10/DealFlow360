import mongoose, {Schema} from 'mongoose';

import {APPROVAL_STEP_STATUSES, USER_ROLES} from '../../core/constants.js';

const ApprovalStepSchema = new Schema(
    {
        sequence: {
            type: Number,
            required: true,
            min: 1
        },
        requiredRole: {
            type: String,
            enum: [
                USER_ROLES.SALES_MANAGER,
                USER_ROLES.FINANCE,
                USER_ROLES.ADMIN
            ],
            required: true,
            index: true
        },
        role: {
            type: String,
            required: true,
            trim: true
        },
        status: {
            type: String,
            enum: Object.values(APPROVAL_STEP_STATUSES),
            default: APPROVAL_STEP_STATUSES.PENDING,
            index: true
        },
        reviewerId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
        actorId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
        decisionAt: {
            type: Date,
            default: null
        },
        actedAt: {
            type: Date,
            default: null
        },
        reason: {
            type: String,
            trim: true,
            default: null
        },
        note: {
            type: String,
            trim: true,
            default: null
        }
    },
    {_id: true}
);

const approvalSchema = new Schema(
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
        requestedById: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        status: {
            type: String,
            enum: ['PENDING', 'APPROVED', 'RETURNED', 'REJECTED', 'CANCELLED'],
            default: 'PENDING',
            index: true
        },
        riskLevel: {
            type: String,
            enum: ['NONE', 'LOW', 'MEDIUM', 'HIGH'],
            default: 'NONE',
            index: true
        },
        riskScore: {
            type: Number,
            required: true,
            min: 0,
            default: 0
        },
        totalExcessDiscountExposure: {
            type: Number,
            required: true,
            min: 0,
            default: 0
        },
        approvalRuleId: {
            type: Schema.Types.ObjectId,
            ref: 'ApprovalRule',
            default: null
        },
        steps: {
            type: [ApprovalStepSchema],
            default: []
        }
    },
    {timestamps: true}
);

export const ApprovalRequest = mongoose.model('ApprovalRequest', approvalSchema);
export const Approval = ApprovalRequest;
export {ApprovalStepSchema};
