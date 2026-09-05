import {Router} from 'express';

import {authenticate, requireInternalUser} from '../../core/middlewares/auth.middleware.js';
import {
    getAuditLogsModuleStatus,
    listQuotationAuditLogs
} from './auditLogs.controller.js';

const router = Router();

router.use(authenticate, requireInternalUser);
router.route('/').get(getAuditLogsModuleStatus);

router
.route('/quotations/:quotationId')
.get(listQuotationAuditLogs);

export default router;
