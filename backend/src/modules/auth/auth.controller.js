import {ApiError} from '../../core/utils/apiError.js';
import {ApiResponse} from '../../core/utils/apiResponse.js';
import {asyncHandler} from '../../core/utils/asyncHandler.js';
import {USER_STATUSES} from '../../core/constants.js';
import {signSessionToken, verifyPassword} from './auth.service.js';
import {User} from '../users/user.model.js';

const COOKIE_OPTIONS = {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production'
};

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
    getCurrentUser,
    logout
};
