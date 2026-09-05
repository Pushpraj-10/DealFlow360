import {Router} from 'express';

import {USER_ROLES} from '../../core/constants.js';
import {authenticate, requireRoles} from '../../core/middlewares/auth.middleware.js';
import {
    createCustomerTier,
    deleteCustomerTier,
    getCustomerTier,
    listCustomerTiers,
    updateCustomerTier
} from './customerTiers.controller.js';

const router = Router();

router.use(authenticate);

router
.route('/')
.get(requireRoles(USER_ROLES.ADMIN, USER_ROLES.SALES_MANAGER), listCustomerTiers)
.post(requireRoles(USER_ROLES.ADMIN, USER_ROLES.SALES_MANAGER), createCustomerTier);

router
.route('/:tierId')
.get(requireRoles(USER_ROLES.ADMIN, USER_ROLES.SALES_MANAGER), getCustomerTier)
.patch(requireRoles(USER_ROLES.ADMIN, USER_ROLES.SALES_MANAGER), updateCustomerTier)
.delete(requireRoles(USER_ROLES.ADMIN, USER_ROLES.SALES_MANAGER), deleteCustomerTier);

export default router;
