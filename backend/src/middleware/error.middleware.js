import { ApiError } from '../core/utils/apiError.js';
import { ErrorCodes } from '../core/utils/errorCodes.js';

// eslint-disable-next-line no-unused-vars
const errorMiddleware = (err, req, res, next) => {
    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({
            success: false,
            statusCode: err.statusCode,
            message: err.message,
            code: err.code,
            errors: err.errors,
        });
    }

    if (err?.code === 11000) {
        return res.status(409).json({
            success: false,
            statusCode: 409,
            message: 'Duplicate value violates a unique constraint',
            code: ErrorCodes.VALIDATION_ERROR,
            errors: [err.keyValue],
        });
    }

    if (err?.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            statusCode: 400,
            message: err.message,
            code: ErrorCodes.VALIDATION_ERROR,
            errors: Object.values(err.errors || {}).map((e) => e.message),
        });
    }

    console.error(err);

    return res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Something went wrong',
        code: ErrorCodes.INTERNAL_ERROR,
        errors: [],
    });
};

export { errorMiddleware };
