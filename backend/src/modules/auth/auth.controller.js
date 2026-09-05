import { asyncHandler } from '../../core/utils/asyncHandler.js';
import { ApiResponse } from '../../core/utils/apiResponse.js';
import * as authService from './auth.service.js';

const issueDevToken = asyncHandler(async (req, res) => {
    const { email, name, role } = req.body;

    const { token, user } = await authService.issueDevToken({ email, name, role });

    return res
        .status(200)
        .json(new ApiResponse(200, { token, user }, 'Dev token issued'));
});

export { issueDevToken };
