import jwt from 'jsonwebtoken';
import { ApiError } from '../core/utils/apiError.js';
import { ErrorCodes } from '../core/utils/errorCodes.js';
import { asyncHandler } from '../core/utils/asyncHandler.js';

const requireAuth = asyncHandler(async (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
        throw new ApiError(401, 'Missing or invalid Authorization header', [], '', ErrorCodes.UNAUTHORIZED);
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.user = { id: payload.sub, role: payload.role, email: payload.email };
    } catch {
        throw new ApiError(401, 'Invalid or expired token', [], '', ErrorCodes.UNAUTHORIZED);
    }

    next();
});

const requireRole = (...roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
        throw new ApiError(403, 'You do not have permission to perform this action', [], '', ErrorCodes.FORBIDDEN);
    }
    next();
};

export { requireAuth, requireRole };
