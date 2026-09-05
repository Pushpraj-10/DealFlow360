import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { listInventory, getAvailability, updateInventory } from './inventory.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/availability', getAvailability);
router.get('/', listInventory);
router.patch('/:id', updateInventory);

export default router;
