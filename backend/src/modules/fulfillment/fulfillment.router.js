import { Router } from 'express';
import { authenticate, requireInternalUser } from '../../core/middlewares/auth.middleware.js';
import {
    listFulfillments,
    getFulfillment,
    createFulfillment,
    suggestSplit,
    acceptSplit,
    overrideSplit,
    recordShipment,
    listBackorders,
    consolidateBackorder,
} from './fulfillment.controller.js';

const fulfillmentRouter = Router();
fulfillmentRouter.use(authenticate, requireInternalUser);

fulfillmentRouter.get('/', listFulfillments);
fulfillmentRouter.post('/', createFulfillment);
fulfillmentRouter.get('/:id', getFulfillment);
fulfillmentRouter.post('/:id/suggest', suggestSplit);
fulfillmentRouter.post('/:id/accept', acceptSplit);
fulfillmentRouter.post('/:id/override', overrideSplit);
fulfillmentRouter.post('/:id/ship', recordShipment);

const backorderRouter = Router();
backorderRouter.use(authenticate, requireInternalUser);

backorderRouter.get('/', listBackorders);
backorderRouter.post('/:id/consolidate', consolidateBackorder);

export { fulfillmentRouter, backorderRouter };
