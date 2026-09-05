import { Router } from 'express';
import { USER_ROLES } from '../../core/constants.js';
import { authenticate, requireInternalUser, requireRoles } from '../../core/middlewares/auth.middleware.js';
import {
    listPlans,
    createPlan,
    getPlan,
    updatePlan,
    deletePlan,
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
router.use(authenticate, requireInternalUser);

router.get('/subscription-plans', listPlans);
router.post('/subscription-plans', createPlan);
router.get('/subscription-plans/:id', getPlan);
router.patch('/subscription-plans/:id', requireRoles(USER_ROLES.ADMIN), updatePlan);
router.delete('/subscription-plans/:id', requireRoles(USER_ROLES.ADMIN), deletePlan);

router.get('/subscriptions', listSubscriptions);
router.post('/subscriptions', createSubscription);
router.get('/subscriptions/:id', getSubscription);
router.post('/subscriptions/:id/modify', modifySubscription);
router.post('/subscriptions/:id/cancel', cancelSubscription);

router.get('/billing/prorate', dryRunProration);

export default router;
