import {Router} from 'express';

import {USER_ROLES} from '../../core/constants.js';
import {authenticate, requireInternalUser, requireRoles} from '../../core/middlewares/auth.middleware.js';
import {
    acceptQuotationUpsellRecommendation,
    createUpsellRule,
    deleteUpsellRule,
    getQuotationUpsellRecommendations,
    getRecommendationsModuleStatus,
    listUpsellRules,
    updateUpsellRule
} from './recommendations.controller.js';

const router = Router();

router.use(authenticate, requireInternalUser);
router.route('/').get(getRecommendationsModuleStatus);

router
.route('/upsell-rules')
.get(requireRoles(USER_ROLES.SALES_REP, USER_ROLES.SALES_MANAGER, USER_ROLES.ADMIN), listUpsellRules)
.post(requireRoles(USER_ROLES.SALES_MANAGER, USER_ROLES.ADMIN), createUpsellRule);

router
.route('/upsell-rules/:ruleId')
.patch(requireRoles(USER_ROLES.SALES_MANAGER, USER_ROLES.ADMIN), updateUpsellRule)
.delete(requireRoles(USER_ROLES.SALES_MANAGER, USER_ROLES.ADMIN), deleteUpsellRule);

router
.route('/quotations/:quotationId/upsells')
.get(requireRoles(USER_ROLES.SALES_REP, USER_ROLES.SALES_MANAGER, USER_ROLES.ADMIN), getQuotationUpsellRecommendations)
.post(requireRoles(USER_ROLES.SALES_REP, USER_ROLES.ADMIN), acceptQuotationUpsellRecommendation);

export default router;
