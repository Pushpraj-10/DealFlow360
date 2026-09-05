import {ApiError} from '../../core/utils/apiError.js';
import {ApiResponse} from '../../core/utils/apiResponse.js';
import {asyncHandler} from '../../core/utils/asyncHandler.js';
import {SIGNUP_REQUEST_STATUSES, USER_ROLES, USER_STATUSES} from '../../core/constants.js';
import {User} from './user.model.js';
import {UserSignupRequest} from './userSignupRequest.model.js';
import {sendSignupApprovedEmail, sendSignupRejectedEmail} from '../_shared/mail/mail.service.js';

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

// Clamps and defaults page/limit query params shared by both paginated
// endpoints below, mirroring deal-health.service.js's resolvePagination.
const resolvePagination = (page, limit) => {
    const pageNum = Math.max(1, Math.trunc(Number(page)) || 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(Number(limit)) || DEFAULT_PAGE_SIZE));
    return {page: pageNum, limit: pageSize};
};

const buildSearchFilter = (search) => {
    if (!search || !search.trim()) {
        return {};
    }

    const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    return {$or: [{fullName: regex}, {email: regex}]};
};

const listUsers = asyncHandler(async (req, res) => {
    const {role, search, page, limit} = req.query;
    const filter = buildSearchFilter(search);

    if (role) {
        if (!Object.values(USER_ROLES).includes(role)) {
            throw new ApiError(400, 'Invalid role filter');
        }
        filter.role = role;
    }

    const {page: pageNum, limit: pageSize} = resolvePagination(page, limit);
    const [users, total] = await Promise.all([
        User.find(filter)
        .sort({createdAt: -1})
        .skip((pageNum - 1) * pageSize)
        .limit(pageSize),
        User.countDocuments(filter)
    ]);

    return res
    .status(200)
    .json(new ApiResponse(200, {
        users,
        pagination: {page: pageNum, limit: pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize))}
    }, 'Users fetched successfully'));
});

// Admin-only: shows every request regardless of status by default so the
// approve/reject history stays visible, with an optional ?status= filter for
// the pending queue view, plus ?search= and ?page=/?limit= pagination.
const listSignupRequests = asyncHandler(async (req, res) => {
    const {status, search, page, limit} = req.query;
    const filter = buildSearchFilter(search);

    if (status) {
        if (!Object.values(SIGNUP_REQUEST_STATUSES).includes(status)) {
            throw new ApiError(400, 'status must be one of: ' + Object.values(SIGNUP_REQUEST_STATUSES).join(', '));
        }
        filter.status = status;
    }

    const {page: pageNum, limit: pageSize} = resolvePagination(page, limit);
    const [requests, total] = await Promise.all([
        UserSignupRequest.find(filter)
        .populate('reviewedById', 'fullName email')
        .sort({createdAt: -1})
        .skip((pageNum - 1) * pageSize)
        .limit(pageSize),
        UserSignupRequest.countDocuments(filter)
    ]);

    return res
    .status(200)
    .json(new ApiResponse(200, {
        requests: requests.map((r) => r.toSafeObject()),
        pagination: {page: pageNum, limit: pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize))}
    }, 'Signup requests fetched successfully'));
});

const getPendingSignupRequestOrThrow = async (requestId) => {
    const request = await UserSignupRequest.findById(requestId).select('+passwordHash');

    if (!request) {
        throw new ApiError(404, 'Signup request not found');
    }

    if (request.status !== SIGNUP_REQUEST_STATUSES.PENDING) {
        throw new ApiError(400, `Signup request has already been ${request.status.toLowerCase()}`);
    }

    return request;
};

// Admin-only: approving creates the real account from what the requester
// already submitted (name, email, password, proposed role/team) - the admin
// is deciding whether to grant it, not re-entering the request.
const approveSignupRequest = asyncHandler(async (req, res) => {
    const request = await getPendingSignupRequestOrThrow(req.params.requestId);

    const existingUser = await User.findOne({email: request.email});

    if (existingUser) {
        throw new ApiError(409, 'An account already exists for this email');
    }

    const user = await User.create({
        fullName: request.fullName,
        email: request.email,
        passwordHash: request.passwordHash,
        role: request.proposedRole,
        team: request.proposedTeam,
        status: USER_STATUSES.ACTIVE
    });

    request.status = SIGNUP_REQUEST_STATUSES.APPROVED;
    request.reviewedById = req.user.id;
    request.reviewedAt = new Date();
    request.createdUserId = user._id;
    await request.save();

    // sendMail never throws - a notification failure should not undo an
    // approval that already succeeded.
    await sendSignupApprovedEmail({to: user.email, fullName: user.fullName, role: user.role});

    return res
    .status(201)
    .json(new ApiResponse(201, {user: user.toSafeObject(), request: request.toSafeObject()}, 'Signup request approved'));
});

const rejectSignupRequest = asyncHandler(async (req, res) => {
    const request = await getPendingSignupRequestOrThrow(req.params.requestId);
    const {reason} = req.body;

    request.status = SIGNUP_REQUEST_STATUSES.REJECTED;
    request.reviewedById = req.user.id;
    request.reviewedAt = new Date();
    request.reviewNote = reason || null;
    await request.save();

    await sendSignupRejectedEmail({to: request.email, fullName: request.fullName, reason: request.reviewNote});

    return res
    .status(200)
    .json(new ApiResponse(200, {request: request.toSafeObject()}, 'Signup request rejected'));
});

export {listUsers, listSignupRequests, approveSignupRequest, rejectSignupRequest};
