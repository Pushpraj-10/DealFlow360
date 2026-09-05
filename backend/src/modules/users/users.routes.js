import {Router} from 'express';

import {authenticate, requireRoles} from '../../core/middlewares/auth.middleware.js';
import {USER_ROLES} from '../../core/constants.js';
import {
    approveSignupRequest,
    listSignupRequests,
    listUsers,
    rejectSignupRequest
} from './users.controller.js';

const router = Router();

router.use(authenticate, requireRoles(USER_ROLES.ADMIN));

router.route('/').get(listUsers);
router.route('/signup-requests').get(listSignupRequests);
router.route('/signup-requests/:requestId/approve').post(approveSignupRequest);
router.route('/signup-requests/:requestId/reject').post(rejectSignupRequest);

export default router;
