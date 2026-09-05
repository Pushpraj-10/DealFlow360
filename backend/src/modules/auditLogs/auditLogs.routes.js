import {Router} from 'express';

import {authenticate, requireInternalUser} from '../../core/middlewares/auth.middleware.js';
import {getAuditLogsModuleStatus} from './auditLogs.controller.js';

const router = Router();

router.use(authenticate, requireInternalUser);
router.route('/').get(getAuditLogsModuleStatus);

export default router;
