import {Router} from 'express';

import {USER_ROLES} from '../../core/constants.js';
import {authenticate, requireInternalUser, requireRoles} from '../../core/middlewares/auth.middleware.js';
import {
    createApprovalRule,
    decideApprovalRequest,
    deleteApprovalRule,
    getApprovalsModuleStatus,
    listMyPendingApprovalRequests,
    listApprovalRules,
    updateApprovalRule
} from './approvals.controller.js';

const router = Router();

router.use(authenticate, requireInternalUser);
router.route('/').get(getApprovalsModuleStatus);

router
.route('/pending')
.get(
    requireRoles(USER_ROLES.SALES_MANAGER, USER_ROLES.FINANCE, USER_ROLES.ADMIN),
    listMyPendingApprovalRequests
);

router
.route('/requests/:approvalRequestId/approve')
.post(
    requireRoles(USER_ROLES.SALES_MANAGER, USER_ROLES.FINANCE, USER_ROLES.ADMIN),
    decideApprovalRequest('APPROVED')
);

router
.route('/requests/:approvalRequestId/reject')
.post(
    requireRoles(USER_ROLES.SALES_MANAGER, USER_ROLES.FINANCE, USER_ROLES.ADMIN),
    decideApprovalRequest('REJECTED')
);

router
.route('/requests/:approvalRequestId/return')
.post(
    requireRoles(USER_ROLES.SALES_MANAGER, USER_ROLES.FINANCE, USER_ROLES.ADMIN),
    decideApprovalRequest('RETURNED')
);

router
.route('/rules')
.get(requireRoles(USER_ROLES.ADMIN, USER_ROLES.SALES_MANAGER), listApprovalRules)
.post(requireRoles(USER_ROLES.ADMIN, USER_ROLES.SALES_MANAGER), createApprovalRule);

router
.route('/rules/:ruleId')
.patch(requireRoles(USER_ROLES.ADMIN, USER_ROLES.SALES_MANAGER), updateApprovalRule)
.delete(requireRoles(USER_ROLES.ADMIN, USER_ROLES.SALES_MANAGER), deleteApprovalRule);

export default router;
