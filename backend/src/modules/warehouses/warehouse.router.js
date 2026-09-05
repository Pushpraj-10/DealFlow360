import { Router } from 'express';
import { USER_ROLES } from '../../core/constants.js';
import { authenticate, requireInternalUser, requireRoles } from '../../core/middlewares/auth.middleware.js';
import { listWarehouses, createWarehouse, updateWarehouse, deleteWarehouse } from './warehouse.controller.js';

const router = Router();

router.use(authenticate, requireInternalUser);

router.get('/', listWarehouses);
router.post('/', createWarehouse);
router.patch('/:id', updateWarehouse);
router.delete('/:id', requireRoles(USER_ROLES.ADMIN), deleteWarehouse);

export default router;
