import {Router} from 'express';

import {USER_ROLES} from '../../core/constants.js';
import {authenticate, requireInternalUser, requireRoles} from '../../core/middlewares/auth.middleware.js';
import {
    addPriceListItem,
    createPriceList,
    deletePriceList,
    deletePriceListItem,
    getPriceList,
    listPriceLists,
    resolveProductPriceForCustomer,
    updatePriceList,
    updatePriceListItem
} from './priceLists.controller.js';

const router = Router();

router.use(authenticate, requireInternalUser);

router
.route('/resolve-price')
.get(resolveProductPriceForCustomer);

router
.route('/')
.get(listPriceLists)
.post(requireRoles(USER_ROLES.ADMIN, USER_ROLES.SALES_MANAGER), createPriceList);

router
.route('/:priceListId')
.get(getPriceList)
.patch(requireRoles(USER_ROLES.ADMIN, USER_ROLES.SALES_MANAGER), updatePriceList)
.delete(requireRoles(USER_ROLES.ADMIN, USER_ROLES.SALES_MANAGER), deletePriceList);

router
.route('/:priceListId/items')
.post(requireRoles(USER_ROLES.ADMIN, USER_ROLES.SALES_MANAGER), addPriceListItem);

router
.route('/:priceListId/items/:itemId')
.patch(requireRoles(USER_ROLES.ADMIN, USER_ROLES.SALES_MANAGER), updatePriceListItem)
.delete(requireRoles(USER_ROLES.ADMIN, USER_ROLES.SALES_MANAGER), deletePriceListItem);

export default router;
