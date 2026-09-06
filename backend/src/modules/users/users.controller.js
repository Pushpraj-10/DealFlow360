import {ApiError} from '../../core/utils/apiError.js';
import {ApiResponse} from '../../core/utils/apiResponse.js';
import {asyncHandler} from '../../core/utils/asyncHandler.js';
import mongoose from 'mongoose';

import {CUSTOMER_STATUSES, SIGNUP_REQUEST_STATUSES, USER_ROLES, USER_STATUSES} from '../../core/constants.js';
import {User} from './user.model.js';
import {UserSignupRequest} from './userSignupRequest.model.js';
import {sendSignupApprovedEmail, sendSignupRejectedEmail} from '../_shared/mail/mail.service.js';
import {CustomerTier} from '../customerTiers/customerTier.model.js';
import {Customer} from '../customers/customer.model.js';

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

const DIRECTORY_STATUS_VALUES = ['ACTIVE', 'DISABLED', 'APPROVED', 'REJECTED'];

// Admin-only: one row per person, merging their account (if any) with their
// most recent reviewed (non-pending) signup request (if any) - matched by
// email, since a rejected request never gets a User and a seeded account
// never gets a request. Filter/search/pagination all apply after the merge
// since the two sources have to be combined before either makes sense.
const listUserDirectory = asyncHandler(async (req, res) => {
    const {search, role, status, page, limit} = req.query;

    if (role && !Object.values(USER_ROLES).includes(role)) {
        throw new ApiError(400, 'Invalid role filter');
    }

    if (status && !DIRECTORY_STATUS_VALUES.includes(status)) {
        throw new ApiError(400, 'status must be one of: ' + DIRECTORY_STATUS_VALUES.join(', '));
    }

    const [users, requests] = await Promise.all([
        User.find(role ? {role} : {}),
        UserSignupRequest.find({
            status: {$in: [SIGNUP_REQUEST_STATUSES.APPROVED, SIGNUP_REQUEST_STATUSES.REJECTED]},
            ...(role ? {proposedRole: role} : {})
        })
        .populate('reviewedById', 'fullName email')
        .sort({createdAt: -1})
    ]);

    const rowsByEmail = new Map();

    for (const user of users) {
        rowsByEmail.set(user.email, {
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            accountStatus: user.status,
            lastRequestStatus: null,
            lastRequestAt: null,
            reviewedBy: null,
            reviewNote: null,
            sortDate: user.createdAt
        });
    }

    // requests is already sorted most-recent-first, so the first request
    // seen per email is that person's latest reviewed request.
    const seenRequestEmails = new Set();

    for (const request of requests) {
        if (seenRequestEmails.has(request.email)) {
            continue;
        }
        seenRequestEmails.add(request.email);

        const requestDate = request.reviewedAt || request.createdAt;
        const existing = rowsByEmail.get(request.email);

        if (existing) {
            existing.lastRequestStatus = request.status;
            existing.lastRequestAt = requestDate;
            existing.reviewedBy = request.reviewedById;
            existing.reviewNote = request.reviewNote;
            if (requestDate > existing.sortDate) {
                existing.sortDate = requestDate;
            }
        } else {
            rowsByEmail.set(request.email, {
                fullName: request.fullName,
                email: request.email,
                role: request.proposedRole,
                accountStatus: null,
                lastRequestStatus: request.status,
                lastRequestAt: requestDate,
                reviewedBy: request.reviewedById,
                reviewNote: request.reviewNote,
                sortDate: requestDate
            });
        }
    }

    let rows = [...rowsByEmail.values()];

    if (search && search.trim()) {
        const term = search.trim().toLowerCase();
        rows = rows.filter((row) => row.fullName.toLowerCase().includes(term) || row.email.toLowerCase().includes(term));
    }

    if (status) {
        rows = rows.filter((row) => row.accountStatus === status || row.lastRequestStatus === status);
    }

    rows.sort((a, b) => new Date(b.sortDate) - new Date(a.sortDate));

    const {page: pageNum, limit: pageSize} = resolvePagination(page, limit);
    const total = rows.length;
    const paged = rows
    .slice((pageNum - 1) * pageSize, pageNum * pageSize)
    .map(({sortDate, ...row}) => row);

    return res
    .status(200)
    .json(new ApiResponse(200, {
        rows: paged,
        pagination: {page: pageNum, limit: pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize))}
    }, 'User directory fetched successfully'));
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

const validateCustomerTierForApproval = async (tierId) => {
    if (!mongoose.Types.ObjectId.isValid(tierId)) {
        throw new ApiError(400, 'A valid customer tier is required before approving customer access');
    }

    const tier = await CustomerTier.findOne({_id: tierId, isActive: true});

    if (!tier) {
        throw new ApiError(400, 'Active customer tier not found');
    }

    return tier;
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

    let customer = null;

    if (request.proposedRole === USER_ROLES.CUSTOMER) {
        const tierId = req.body.customerTierId || req.body.tierId;
        await validateCustomerTierForApproval(tierId);

        if (!request.customerName || !request.customerCompany) {
            throw new ApiError(400, 'Customer access request is missing customer details');
        }

        const existingCustomer = await Customer.findOne({
            company: request.customerCompany,
            email: request.email
        });

        if (existingCustomer) {
            throw new ApiError(409, 'Customer already exists for this company and email');
        }

        customer = await Customer.create({
            name: request.customerName,
            email: request.email,
            company: request.customerCompany,
            phone: request.customerPhone || null,
            contactPerson: request.fullName,
            tierId,
            status: CUSTOMER_STATUSES.ACTIVE
        });
    }

    const user = await User.create({
        fullName: request.fullName,
        email: request.email,
        passwordHash: request.passwordHash,
        role: request.proposedRole,
        team: request.proposedRole === USER_ROLES.CUSTOMER ? null : request.proposedTeam,
        customerId: customer?._id || null,
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
    .json(new ApiResponse(201, {user: user.toSafeObject(), customer, request: request.toSafeObject()}, 'Signup request approved'));
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

export {listUsers, listSignupRequests, listUserDirectory, approveSignupRequest, rejectSignupRequest};
