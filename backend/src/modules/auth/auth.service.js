import jwt from 'jsonwebtoken';
import { ApiError } from '../../core/utils/apiError.js';
import { ErrorCodes } from '../../core/utils/errorCodes.js';
import * as authRepository from './auth.repository.js';

const signToken = (user) =>
    jwt.sign(
        { sub: user._id.toString(), role: user.role, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

/**
 * Dev-only token issuance: find-or-create a User by email and sign a JWT.
 * There is no password check here; a full login/signup flow belongs to the
 * auth module owned by another teammate. This exists purely so this scope's
 * endpoints can be protected and audit logs can attribute a real actor.
 */
const issueDevToken = async ({ email, name, role }) => {
    if (!email) {
        throw new ApiError(400, 'email is required', [], '', ErrorCodes.VALIDATION_ERROR);
    }

    let user = await authRepository.findByEmail(email.toLowerCase().trim());

    if (!user) {
        user = await authRepository.create({
            email,
            name: name || email.split('@')[0],
            role: role || 'sales_rep',
        });
    } else if (role && role !== user.role) {
        user.role = role;
        await user.save();
    }

    if (user.status !== 'active') {
        throw new ApiError(403, 'User account is disabled', [], '', ErrorCodes.FORBIDDEN);
    }

    return { token: signToken(user), user };
};

export { issueDevToken };
