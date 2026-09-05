import {ApiError} from '../../core/utils/apiError.js';
import {ApiResponse} from '../../core/utils/apiResponse.js';
import {asyncHandler} from '../../core/utils/asyncHandler.js';
import {INTERNAL_ROLES, SIGNUP_REQUEST_STATUSES, USER_STATUSES} from '../../core/constants.js';
import {hashPassword, signSessionToken, verifyPassword} from './auth.service.js';
import {User} from '../users/user.model.js';
import {UserSignupRequest} from '../users/userSignupRequest.model.js';

const COOKIE_OPTIONS = {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production'
};

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const sendAuthResponse = (res, statusCode, user, message) => {
    const accessToken = signSessionToken(user);

    return res
    .status(statusCode)
    .cookie('accessToken', accessToken, COOKIE_OPTIONS)
    .json(new ApiResponse(statusCode, {user: user.toSafeObject(), accessToken}, message));
};

const login = asyncHandler(async (req, res) => {
    const {email, password} = req.body;

    if (!email?.trim() || !password) {
        throw new ApiError(400, 'Email and password are required');
    }

    const user = await User.findOne({email: email.toLowerCase()}).select('+passwordHash');

    if (!user || !verifyPassword(password, user.passwordHash)) {
        throw new ApiError(401, 'Invalid email or password');
    }

    if (user.status !== USER_STATUSES.ACTIVE) {
        throw new ApiError(403, 'Account is disabled');
    }

    user.lastLoginAt = new Date();
    await user.save();

    return sendAuthResponse(res, 200, user, 'Logged in successfully');
});

// Public: anyone can ask for an internal account and propose a role/team.
// This never creates a User or issues a session - an admin has to approve
// the request first (see users.controller.js).
const requestSignup = asyncHandler(async (req, res) => {
    const {fullName, email, password, proposedRole, team} = req.body;

    if (!fullName?.trim() || !email?.trim() || !password) {
        throw new ApiError(400, 'Full name, email, and password are required');
    }

    if (!isValidEmail(email)) {
        throw new ApiError(400, 'A valid email is required');
    }

    if (password.length < 8) {
        throw new ApiError(400, 'Password must be at least 8 characters');
    }

    if (!INTERNAL_ROLES.includes(proposedRole)) {
        throw new ApiError(400, 'proposedRole must be one of: ' + INTERNAL_ROLES.join(', '));
    }

    const normalizedEmail = email.toLowerCase();

    const existingUser = await User.findOne({email: normalizedEmail});

    if (existingUser) {
        throw new ApiError(409, 'An account already exists for this email');
    }

    const existingRequest = await UserSignupRequest.findOne({
        email: normalizedEmail,
        status: SIGNUP_REQUEST_STATUSES.PENDING
    });

    if (existingRequest) {
        throw new ApiError(409, 'A signup request for this email is already awaiting review');
    }

    const request = await UserSignupRequest.create({
        fullName,
        email: normalizedEmail,
        passwordHash: hashPassword(password),
        proposedRole,
        proposedTeam: team?.trim() || null
    });

    return res
    .status(201)
    .json(new ApiResponse(201, {request: request.toSafeObject()}, 'Signup request submitted. An admin will review it.'));
});

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
    .status(200)
    .json(new ApiResponse(200, {user: req.user}, 'Current user fetched successfully'));
});

const logout = asyncHandler(async (req, res) => {
    return res
    .status(200)
    .clearCookie('accessToken', COOKIE_OPTIONS)
    .json(new ApiResponse(200, null, 'Logged out successfully'));
});

export {
    login,
    requestSignup,
    getCurrentUser,
    logout
};
