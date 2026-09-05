import { Router } from 'express';
import { authenticate, requireInternalUser } from '../../core/middlewares/auth.middleware.js';
import { listWarehouses, createWarehouse, updateWarehouse } from './warehouse.controller.js';

const router = Router();

router.use(authenticate, requireInternalUser);

router.get('/', listWarehouses);
router.post('/', createWarehouse);
router.patch('/:id', updateWarehouse);

export default router;
