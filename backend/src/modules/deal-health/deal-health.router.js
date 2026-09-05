import { Router } from 'express';
import { authenticate } from '../../core/middlewares/auth.middleware.js';
import {
    listAlerts,
    nudgeAlert,
    escalateAlert,
    getDashboard,
    getSalesReport,
    exportSalesReport,
} from './deal-health.controller.js';

// Mounted at the API root in app.js since this feature spans three
// resource prefixes (/deal-health, /reports, /dashboard).
const router = Router();
router.use(authenticate);

router.get('/deal-health', listAlerts);
router.post('/deal-health/:alertId/nudge', nudgeAlert);
router.post('/deal-health/:alertId/escalate', escalateAlert);

router.get('/reports/sales/export', exportSalesReport);
router.get('/reports/sales', getSalesReport);

router.get('/dashboard', getDashboard);

export default router;
