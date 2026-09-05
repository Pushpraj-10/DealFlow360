import {Router} from 'express';

import {authenticate, requireInternalUser} from '../../core/middlewares/auth.middleware.js';
import {getRiskEngineModuleStatus} from './riskEngine.controller.js';

const router = Router();

router.use(authenticate, requireInternalUser);
router.route('/').get(getRiskEngineModuleStatus);

export default router;
