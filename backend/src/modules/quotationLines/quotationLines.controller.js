import {ApiResponse} from '../../core/utils/apiResponse.js';
import {asyncHandler} from '../../core/utils/asyncHandler.js';

const getQuotationLinesModuleStatus = asyncHandler(async (req, res) => {
    return res
    .status(200)
    .json(new ApiResponse(200, {module: 'quotationLines', ready: true}, 'Quotation lines module ready'));
});

export {getQuotationLinesModuleStatus};
