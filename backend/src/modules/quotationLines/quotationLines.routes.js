import {Router} from 'express';

import {authenticate, requireInternalUser} from '../../core/middlewares/auth.middleware.js';
import {getQuotationLinesModuleStatus} from './quotationLines.controller.js';

const router = Router();

router.use(authenticate, requireInternalUser);
router.route('/').get(getQuotationLinesModuleStatus);

export default router;
