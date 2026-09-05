import {Router} from 'express';

import {authenticate} from '../../core/middlewares/auth.middleware.js';
import {getCurrentUser, login, logout, signupInternalUser} from './auth.controller.js';

const router = Router();

router.route('/internal/signup').post(signupInternalUser);
router.route('/login').post(login);
router.route('/me').get(authenticate, getCurrentUser);
router.route('/logout').post(authenticate, logout);

export default router;
