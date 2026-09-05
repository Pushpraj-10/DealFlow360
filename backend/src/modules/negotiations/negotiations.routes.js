import {Router} from 'express';

import {authenticate} from '../../core/middlewares/auth.middleware.js';
import {getNegotiationsModuleStatus} from './negotiations.controller.js';

const router = Router();

router.use(authenticate);
router.route('/').get(getNegotiationsModuleStatus);

export default router;
