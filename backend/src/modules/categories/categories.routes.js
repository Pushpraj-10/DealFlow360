import {Router} from 'express';

import {USER_ROLES} from '../../core/constants.js';
import {authenticate, requireInternalUser, requireRoles} from '../../core/middlewares/auth.middleware.js';
import {
    createCategory,
    deleteCategory,
    getCategory,
    listCategories,
    updateCategory
} from './categories.controller.js';

const router = Router();

router.use(authenticate, requireInternalUser);

router
.route('/')
.get(listCategories)
.post(requireRoles(USER_ROLES.ADMIN, USER_ROLES.SALES_MANAGER), createCategory);

router
.route('/:categoryId')
.get(getCategory)
.patch(requireRoles(USER_ROLES.ADMIN, USER_ROLES.SALES_MANAGER), updateCategory)
.delete(requireRoles(USER_ROLES.ADMIN, USER_ROLES.SALES_MANAGER), deleteCategory);

export default router;
