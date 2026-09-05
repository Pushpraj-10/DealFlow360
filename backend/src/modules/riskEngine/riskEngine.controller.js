import mongoose from 'mongoose';

import {AUDIT_ACTIONS} from '../../core/constants.js';
import {ApiError} from '../../core/utils/apiError.js';
import {ApiResponse} from '../../core/utils/apiResponse.js';
import {asyncHandler} from '../../core/utils/asyncHandler.js';
import {createAuditLog} from '../auditLogs/auditLogs.service.js';
import {Quotation} from '../quotations/quotation.model.js';
import {calculateQuotationRisk} from './riskEngine.service.js';

const validateObjectId = (value, label) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new ApiError(400, `Invalid ${label}`);
    }
};

const getRiskEngineModuleStatus = asyncHandler(async (req, res) => {
    return res
    .status(200)
    .json(new ApiResponse(200, {module: 'riskEngine', ready: true}, 'Risk engine module ready'));
});

const getQuotationRiskById = asyncHandler(async (req, res) => {
    validateObjectId(req.params.quotationId, 'quotation id');

    const quotationExists = await Quotation.exists({_id: req.params.quotationId});

    if (!quotationExists) {
        throw new ApiError(404, 'Quotation not found');
    }

    const risk = await calculateQuotationRisk(req.params.quotationId);
    const quotation = await Quotation.findById(req.params.quotationId).select('customerId');

    await createAuditLog({
        actor: req.user,
        action: AUDIT_ACTIONS.RISK_CALCULATED,
        entityType: 'Quotation',
        entityId: req.params.quotationId,
        quotationId: req.params.quotationId,
        customerId: quotation.customerId,
        after: risk
    });

    return res
    .status(200)
    .json(new ApiResponse(200, {risk}, 'Quotation risk calculated successfully'));
});

export {
    getRiskEngineModuleStatus,
    getQuotationRiskById
};
