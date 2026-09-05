import { Router } from 'express';
import { authenticate, requireInternalUser } from '../../core/middlewares/auth.middleware.js';
import { listInventory, getAvailability, updateInventory } from './inventory.controller.js';

const router = Router();

router.use(authenticate, requireInternalUser);

router.get('/availability', getAvailability);
router.get('/', listInventory);
router.patch('/:id', updateInventory);

export default router;
