import { ErrorCodes } from '../utils/errorCodes.js';

const errorHandler = (error, req, res, next) => {
    if (error?.code === 11000) {
        return res.status(409).json({
            statusCode: 409,
            data: null,
            message: 'Duplicate value violates a unique constraint',
            success: false,
            code: ErrorCodes.VALIDATION_ERROR,
            errors: [error.keyValue],
        });
    }

    if (error?.name === 'ValidationError') {
        return res.status(400).json({
            statusCode: 400,
            data: null,
            message: error.message,
            success: false,
            code: ErrorCodes.VALIDATION_ERROR,
            errors: Object.values(error.errors || {}).map((e) => e.message),
        });
    }

    const statusCode = error.statusCode || 500;

    if (statusCode >= 500) {
        console.error(error);
    }

    return res.status(statusCode).json({
        statusCode,
        data: error.data || null,
        message: error.message || 'Internal server error',
        success: false,
        code: error.code,
        errors: error.errors || []
    });
};

export {errorHandler};
