import {Router} from 'express';

import {
    authenticate,
    requireInternalUser,
    requireRoles,
    requireQuotationPortalAccess
} from '../../core/middlewares/auth.middleware.js';
import {USER_ROLES} from '../../core/constants.js';
import {
    acceptNegotiation,
    createCustomerNegotiation,
    getNegotiationsModuleStatus,
    listQuotationNegotiations,
    proposeCustomerDiscount,
    rejectNegotiation
} from './negotiations.controller.js';

const router = Router();

router.use(authenticate);
router.route('/').get(getNegotiationsModuleStatus);
router
.route('/quotations/:quotationId')
.get(
    requireInternalUser,
    listQuotationNegotiations
)
.post(
    requireRoles(USER_ROLES.CUSTOMER),
    requireQuotationPortalAccess,
    createCustomerNegotiation
);

router
.route('/quotations/:quotationId/discount-proposals')
.post(
    requireRoles(USER_ROLES.CUSTOMER),
    requireQuotationPortalAccess,
    proposeCustomerDiscount
);

router
.route('/:negotiationId/accept')
.post(
    requireRoles(USER_ROLES.SALES_REP, USER_ROLES.ADMIN),
    acceptNegotiation
);

router
.route('/:negotiationId/reject')
.post(
    requireRoles(USER_ROLES.SALES_REP, USER_ROLES.ADMIN),
    rejectNegotiation
);

export default router;
