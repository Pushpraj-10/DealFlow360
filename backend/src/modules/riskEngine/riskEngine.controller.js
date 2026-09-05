import mongoose from 'mongoose';

import {ApiError} from '../../core/utils/apiError.js';
import {ApiResponse} from '../../core/utils/apiResponse.js';
import {asyncHandler} from '../../core/utils/asyncHandler.js';
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

    return res
    .status(200)
    .json(new ApiResponse(200, {risk}, 'Quotation risk calculated successfully'));
});

export {
    getRiskEngineModuleStatus,
    getQuotationRiskById
};
