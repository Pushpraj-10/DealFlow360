import {ApiError} from '../../core/utils/apiError.js';
import {ApiResponse} from '../../core/utils/apiResponse.js';
import {asyncHandler} from '../../core/utils/asyncHandler.js';
import {INTERNAL_ROLES, USER_STATUSES} from '../../core/constants.js';
import {hashPassword} from '../auth/auth.service.js';
import {User} from './user.model.js';

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const listUsers = asyncHandler(async (req, res) => {
    const users = await User.find().sort({createdAt: -1});

    return res
    .status(200)
    .json(new ApiResponse(200, {users}, 'Users fetched successfully'));
});

// Admin-only: internal user accounts are provisioned by an admin, not
// self-registered, so this never issues a session token for the new user.
const createUser = asyncHandler(async (req, res) => {
    const {fullName, email, password, role} = req.body;

    if (!fullName?.trim() || !email?.trim() || !password) {
        throw new ApiError(400, 'Full name, email, and password are required');
    }

    if (!isValidEmail(email)) {
        throw new ApiError(400, 'A valid email is required');
    }

    if (password.length < 8) {
        throw new ApiError(400, 'Password must be at least 8 characters');
    }

    if (!INTERNAL_ROLES.includes(role)) {
        throw new ApiError(400, 'role must be one of: ' + INTERNAL_ROLES.join(', '));
    }

    const existingUser = await User.findOne({email: email.toLowerCase()});

    if (existingUser) {
        throw new ApiError(409, 'An account already exists for this email');
    }

    const user = await User.create({
        fullName,
        email,
        passwordHash: hashPassword(password),
        role,
        status: USER_STATUSES.ACTIVE
    });

    return res
    .status(201)
    .json(new ApiResponse(201, {user: user.toSafeObject()}, 'Internal user created successfully'));
});

export {listUsers, createUser};
