import {ApiResponse} from '../../core/utils/apiResponse.js';
import {asyncHandler} from '../../core/utils/asyncHandler.js';

const getRecommendationsModuleStatus = asyncHandler(async (req, res) => {
    return res
    .status(200)
    .json(new ApiResponse(200, {module: 'recommendations', ready: true}, 'Recommendations module ready'));
});

export {getRecommendationsModuleStatus};
