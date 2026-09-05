import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { listWarehouses, createWarehouse, updateWarehouse } from './warehouse.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', listWarehouses);
router.post('/', createWarehouse);
router.patch('/:id', updateWarehouse);

export default router;
