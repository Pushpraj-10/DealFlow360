import {ApiResponse} from '../../core/utils/apiResponse.js';
import {asyncHandler} from '../../core/utils/asyncHandler.js';

const healthCheck = asyncHandler(async (req, res) => {
    return res
    .status(200)
    .json(new ApiResponse(200, 'OK', "Health check successful"));
})

export { healthCheck };