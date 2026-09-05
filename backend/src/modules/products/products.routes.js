import {Router} from 'express';

import {USER_ROLES} from '../../core/constants.js';
import {authenticate, requireInternalUser, requireRoles} from '../../core/middlewares/auth.middleware.js';
import {
    createProduct,
    deleteProduct,
    getProduct,
    listProducts,
    updateProduct
} from './products.controller.js';
import {
    createProductVariant,
    deleteProductVariant,
    listProductVariants,
    updateProductVariant
} from './productVariants.controller.js';

const router = Router();

router.use(authenticate, requireInternalUser);

router
.route('/')
.get(listProducts)
.post(requireRoles(USER_ROLES.ADMIN), createProduct);

router
.route('/:productId/variants')
.get(listProductVariants)
.post(requireRoles(USER_ROLES.ADMIN), createProductVariant);

router
.route('/:productId/variants/:variantId')
.patch(requireRoles(USER_ROLES.ADMIN), updateProductVariant)
.delete(requireRoles(USER_ROLES.ADMIN), deleteProductVariant);

router
.route('/:productId')
.get(getProduct)
.patch(requireRoles(USER_ROLES.ADMIN), updateProduct)
.delete(requireRoles(USER_ROLES.ADMIN), deleteProduct);

export default router;
