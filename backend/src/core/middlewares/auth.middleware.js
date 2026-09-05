import mongoose from 'mongoose';

import {ApiError} from '../utils/apiError.js';
import {asyncHandler} from '../utils/asyncHandler.js';
import {INTERNAL_ROLES, USER_ROLES, USER_STATUSES} from '../constants.js';
import {verifySessionToken} from '../../modules/auth/auth.service.js';
import {User} from '../../modules/users/user.model.js';
import {Quotation} from '../../modules/quotations/quotation.model.js';

const parseCookies = (cookieHeader = '') => {
    return cookieHeader.split(';').reduce((cookies, cookie) => {
        const [rawName, ...rawValue] = cookie.trim().split('=');

        if (!rawName) {
            return cookies;
        }

        cookies[rawName] = decodeURIComponent(rawValue.join('='));
        return cookies;
    }, {});
};

const getTokenFromRequest = (req) => {
    const authorization = req.headers.authorization || '';

    if (authorization.startsWith('Bearer ')) {
        return authorization.slice(7).trim();
    }

    const cookies = parseCookies(req.headers.cookie);
    return cookies.accessToken || null;
};

const authenticate = asyncHandler(async (req, res, next) => {
    const token = getTokenFromRequest(req);

    if (!token) {
        throw new ApiError(401, 'Authentication required');
    }

    const payload = verifySessionToken(token);

    if (!payload?.sub) {
        throw new ApiError(401, 'Invalid or expired session');
    }

    const user = await User.findById(payload.sub);

    if (!user || user.status !== USER_STATUSES.ACTIVE) {
        throw new ApiError(401, 'Invalid or expired session');
    }

    req.user = user.toSafeObject();
    next();
});

const requireRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new ApiError(401, 'Authentication required'));
        }

        if (!roles.includes(req.user.role)) {
            return next(new ApiError(403, 'Insufficient permissions'));
        }

        next();
    };
};

const requireInternalUser = requireRoles(...INTERNAL_ROLES);

const requireCustomerUser = requireRoles(USER_ROLES.CUSTOMER);

const requireQuotationPortalAccess = asyncHandler(async (req, res, next) => {
    if (!req.user) {
        throw new ApiError(401, 'Authentication required');
    }

    if (req.user.role !== USER_ROLES.CUSTOMER) {
        return next();
    }

    const quotationId = req.params.quotationId || req.params.id;

    if (!mongoose.Types.ObjectId.isValid(quotationId)) {
        throw new ApiError(404, 'Quotation not found');
    }

    const quotation = await Quotation.findById(quotationId).select('customerId');

    if (!quotation || quotation.customerId.toString() !== req.user.customerId?.toString()) {
        throw new ApiError(404, 'Quotation not found');
    }

    req.quotation = quotation;
    next();
});

export {
    authenticate,
    requireRoles,
    requireInternalUser,
    requireCustomerUser,
    requireQuotationPortalAccess
};
