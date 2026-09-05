import {ApiError} from '../../core/utils/apiError.js';
import {ApiResponse} from '../../core/utils/apiResponse.js';
import {asyncHandler} from '../../core/utils/asyncHandler.js';
import {SIGNUP_REQUEST_STATUSES, USER_STATUSES} from '../../core/constants.js';
import {User} from './user.model.js';
import {UserSignupRequest} from './userSignupRequest.model.js';

const listUsers = asyncHandler(async (req, res) => {
    const users = await User.find().sort({createdAt: -1});

    return res
    .status(200)
    .json(new ApiResponse(200, {users}, 'Users fetched successfully'));
});

// Admin-only: shows every request regardless of status by default so the
// approve/reject history stays visible, with an optional ?status= filter for
// the pending queue view.
const listSignupRequests = asyncHandler(async (req, res) => {
    const {status} = req.query;
    const filter = {};

    if (status) {
        if (!Object.values(SIGNUP_REQUEST_STATUSES).includes(status)) {
            throw new ApiError(400, 'status must be one of: ' + Object.values(SIGNUP_REQUEST_STATUSES).join(', '));
        }
        filter.status = status;
    }

    const requests = await UserSignupRequest.find(filter)
    .populate('reviewedById', 'fullName email')
    .sort({createdAt: -1});

    return res
    .status(200)
    .json(new ApiResponse(200, {requests: requests.map((r) => r.toSafeObject())}, 'Signup requests fetched successfully'));
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

    return res
    .status(200)
    .json(new ApiResponse(200, {request: request.toSafeObject()}, 'Signup request rejected'));
});

export {listUsers, listSignupRequests, approveSignupRequest, rejectSignupRequest};
