import {ApiResponse} from '../../core/utils/apiResponse.js';
import {asyncHandler} from '../../core/utils/asyncHandler.js';

const getNegotiationsModuleStatus = asyncHandler(async (req, res) => {
    return res
    .status(200)
    .json(new ApiResponse(200, {module: 'negotiations', ready: true}, 'Negotiations module ready'));
});

export {getNegotiationsModuleStatus};
