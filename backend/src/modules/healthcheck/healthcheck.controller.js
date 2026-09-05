import mongoose from 'mongoose';
import { ApiResponse } from '../../core/utils/apiResponse.js';
import { asyncHandler } from '../../core/utils/asyncHandler.js';

const getHealth = asyncHandler(async (req, res) => {
    const dbState = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

    return res
        .status(200)
        .json(new ApiResponse(200, { status: 'ok', db: dbState }, 'Service is healthy'));
});

export { getHealth };
