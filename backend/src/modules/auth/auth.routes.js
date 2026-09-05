import {Router} from 'express';

import {authenticate} from '../../core/middlewares/auth.middleware.js';
import {getCurrentUser, login, logout, requestSignup} from './auth.controller.js';

const router = Router();

router.route('/login').post(login);
router.route('/signup-request').post(requestSignup);
router.route('/me').get(authenticate, getCurrentUser);
router.route('/logout').post(authenticate, logout);

export default router;
