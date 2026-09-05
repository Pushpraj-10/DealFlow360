import {Router} from 'express';

import {authenticate, requireInternalUser} from '../../core/middlewares/auth.middleware.js';
import {getRecommendationsModuleStatus} from './recommendations.controller.js';

const router = Router();

router.use(authenticate, requireInternalUser);
router.route('/').get(getRecommendationsModuleStatus);

export default router;
