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
    confirmQuotation,
    createDraftQuotation,
    getConfirmedQuotationOrderSnapshot,
    getQuotationDetail,
    getQuotationPipeline,
    getQuotationVersion,
    getCustomerPortalQuotation,
    listQuotationVersions,
    listQuotations,
    sendQuotationToCustomer,
    submitQuotation,
    updateQuotationLine
} from './quotations.controller.js';

const router = Router();

router
.route('/')
.get(authenticate, requireInternalUser, listQuotations)
.post(authenticate, requireRoles(USER_ROLES.SALES_REP), createDraftQuotation);

router
.route('/pipeline')
.get(authenticate, requireInternalUser, getQuotationPipeline);

router
.route('/:quotationId')
.get(authenticate, requireInternalUser, getQuotationDetail);

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
.route('/:quotationId/versions')
.get(authenticate, requireInternalUser, listQuotationVersions);

router
.route('/:quotationId/versions/:versionNumber')
.get(authenticate, requireInternalUser, getQuotationVersion);

router
.route('/:quotationId/order-snapshot')
.get(authenticate, requireInternalUser, getConfirmedQuotationOrderSnapshot);

router
.route('/:quotationId/submit')
.post(authenticate, requireRoles(USER_ROLES.SALES_REP, USER_ROLES.ADMIN), submitQuotation);

router
.route('/:quotationId/send')
.post(authenticate, requireRoles(USER_ROLES.SALES_REP, USER_ROLES.ADMIN), sendQuotationToCustomer);

router
.route('/:quotationId/confirm')
.post(
    authenticate,
    requireRoles(USER_ROLES.CUSTOMER),
    requireQuotationPortalAccess,
    confirmQuotation
);

router
.route('/portal/:quotationId')
.get(authenticate, requireRoles(USER_ROLES.CUSTOMER), requireQuotationPortalAccess, getCustomerPortalQuotation);

export default router;
