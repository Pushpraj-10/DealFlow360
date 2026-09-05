import mongoose from 'mongoose';

import {ApiError} from '../../core/utils/apiError.js';
import {ApiResponse} from '../../core/utils/apiResponse.js';
import {asyncHandler} from '../../core/utils/asyncHandler.js';
import {AuditLog} from './auditLog.model.js';

const validateObjectId = (value, label) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new ApiError(400, `Invalid ${label}`);
    }
};

const getAuditLogsModuleStatus = asyncHandler(async (req, res) => {
    return res
    .status(200)
    .json(new ApiResponse(200, {module: 'auditLogs', ready: true}, 'Audit logs module ready'));
});

const listQuotationAuditLogs = asyncHandler(async (req, res) => {
    validateObjectId(req.params.quotationId, 'quotation id');

    const auditLogs = await AuditLog.find({quotationId: req.params.quotationId})
    .populate('actorId', 'fullName email role')
    .sort({createdAt: -1})
    .limit(100);

    return res
    .status(200)
    .json(new ApiResponse(200, {auditLogs}, 'Quotation audit logs fetched successfully'));
});

export {
    getAuditLogsModuleStatus,
    listQuotationAuditLogs
};
