import {Router} from 'express';

import {USER_ROLES} from '../../core/constants.js';
import {authenticate, requireRoles} from '../../core/middlewares/auth.middleware.js';
import {
    createCustomer,
    deleteCustomer,
    getCustomer,
    listCustomers,
    updateCustomer
} from './customers.controller.js';

const router = Router();

router.use(authenticate);

router
.route('/')
.get(requireRoles(USER_ROLES.SALES_REP, USER_ROLES.SALES_MANAGER, USER_ROLES.ADMIN), listCustomers)
.post(requireRoles(USER_ROLES.ADMIN), createCustomer);

router
.route('/:customerId')
.get(requireRoles(USER_ROLES.SALES_REP, USER_ROLES.SALES_MANAGER, USER_ROLES.ADMIN), getCustomer)
.patch(requireRoles(USER_ROLES.ADMIN), updateCustomer)
.delete(requireRoles(USER_ROLES.ADMIN), deleteCustomer);

export default router;
