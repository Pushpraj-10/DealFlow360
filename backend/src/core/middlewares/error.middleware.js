const errorHandler = (error, req, res, next) => {
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
        statusCode,
        data: error.data || null,
        message: error.message || 'Internal server error',
        success: false,
        errors: error.errors || []
    });
};

export {errorHandler};
