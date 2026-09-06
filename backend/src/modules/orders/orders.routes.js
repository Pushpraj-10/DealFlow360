import {Router} from 'express';

import {authenticate, requireInternalUser} from '../../core/middlewares/auth.middleware.js';
import {
    getById,
    getByQuotation,
    list,
    retryFlow,
    syncStatus
} from './orders.controller.js';

const router = Router();

router.use(authenticate, requireInternalUser);

router.get('/', list);
router.get('/by-quotation/:quotationId', getByQuotation);
router.get('/:orderId', getById);
router.post('/:orderId/retry-flow', retryFlow);
router.post('/:orderId/sync-status', syncStatus);

export default router;
