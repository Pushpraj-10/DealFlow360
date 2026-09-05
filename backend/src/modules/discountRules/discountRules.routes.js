import {Router} from 'express';

import {USER_ROLES} from '../../core/constants.js';
import {authenticate, requireInternalUser, requireRoles} from '../../core/middlewares/auth.middleware.js';
import {
    getAllowedDiscountForLine,
    getDiscountRulesModuleStatus
} from './discountRules.controller.js';

const router = Router();

router.use(authenticate, requireInternalUser);

router.route('/allowed-discount').get(getAllowedDiscountForLine);
router
.route('/')
.get(requireRoles(USER_ROLES.ADMIN, USER_ROLES.SALES_MANAGER), getDiscountRulesModuleStatus);

export default router;
