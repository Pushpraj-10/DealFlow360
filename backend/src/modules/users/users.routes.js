import {Router} from 'express';

import {authenticate, requireRoles} from '../../core/middlewares/auth.middleware.js';
import {USER_ROLES} from '../../core/constants.js';
import {createUser, listUsers} from './users.controller.js';

const router = Router();

router
.route('/')
.get(authenticate, requireRoles(USER_ROLES.ADMIN), listUsers)
.post(authenticate, requireRoles(USER_ROLES.ADMIN), createUser);

export default router;
