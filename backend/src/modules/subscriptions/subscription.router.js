import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import {
    listPlans,
    createPlan,
    listSubscriptions,
    getSubscription,
    createSubscription,
    modifySubscription,
    cancelSubscription,
    dryRunProration,
} from './subscription.controller.js';

// Mounted at the API root in app.js since this feature spans three
// resource prefixes (/subscription-plans, /subscriptions, /billing).
const router = Router();
router.use(requireAuth);

router.get('/subscription-plans', listPlans);
router.post('/subscription-plans', createPlan);

router.get('/subscriptions', listSubscriptions);
router.post('/subscriptions', createSubscription);
router.get('/subscriptions/:id', getSubscription);
router.post('/subscriptions/:id/modify', modifySubscription);
router.post('/subscriptions/:id/cancel', cancelSubscription);

router.get('/billing/prorate', dryRunProration);

export default router;
