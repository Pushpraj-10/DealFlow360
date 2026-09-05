import {Router} from 'express';

import {
    authenticate,
    requireInternalUser,
    requireRoles,
    requireQuotationPortalAccess
} from '../../core/middlewares/auth.middleware.js';
import {USER_ROLES} from '../../core/constants.js';
import {getQuotationRiskById} from '../riskEngine/riskEngine.controller.js';
import {
    addProductToQuotation,
    createDraftQuotation,
    getCustomerPortalQuotation,
    listQuotations,
    submitQuotation,
    updateQuotationLine
} from './quotations.controller.js';

const router = Router();

router
.route('/')
.get(authenticate, requireInternalUser, listQuotations)
.post(authenticate, requireRoles(USER_ROLES.SALES_REP), createDraftQuotation);

router
.route('/:quotationId/lines')
.post(authenticate, requireRoles(USER_ROLES.SALES_REP, USER_ROLES.ADMIN), addProductToQuotation);

router
.route('/:quotationId/lines/:lineId')
.patch(authenticate, requireRoles(USER_ROLES.SALES_REP, USER_ROLES.ADMIN), updateQuotationLine);

router
.route('/:quotationId/risk')
.get(authenticate, requireInternalUser, getQuotationRiskById);

router
.route('/:quotationId/submit')
.post(authenticate, requireRoles(USER_ROLES.SALES_REP, USER_ROLES.ADMIN), submitQuotation);

router
.route('/portal/:quotationId')
.get(authenticate, requireQuotationPortalAccess, getCustomerPortalQuotation);

export default router;
