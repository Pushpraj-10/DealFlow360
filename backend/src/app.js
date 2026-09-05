import dotenv from 'dotenv';

// Loaded here (rather than only in index.js) because `cors()` below reads
// process.env.CORS_ORIGIN eagerly at module-evaluation time - ESM hoists
// this file's import before index.js's own top-level dotenv.config() call
// would otherwise run, which left CORS_ORIGIN undefined.
dotenv.config({ path: './.env', quiet: true });

import express from 'express';
import cors from 'cors';

const app = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}));

app.use(express.json({limit: '16kb'}));
app.use(express.urlencoded({limit: '16kb', extended: true}));
app.use(express.static('public'));

import './core/db/registerModels.js';

import healthcheckRoutes from './modules/healthcheck/healthcheck.routes.js';
import authRouter from './modules/auth/auth.router.js';
import warehouseRouter from './modules/warehouses/warehouse.router.js';
import inventoryRouter from './modules/inventory/inventory.router.js';
import { fulfillmentRouter, backorderRouter } from './modules/fulfillment/fulfillment.router.js';
import subscriptionRouter from './modules/subscriptions/subscription.router.js';
import invoicingRouter from './modules/invoicing/invoicing.router.js';
import dealHealthRouter from './modules/deal-health/deal-health.router.js';
import { errorMiddleware } from './middleware/error.middleware.js';

app.use('/api/v1/healthcheck', healthcheckRoutes);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/warehouses', warehouseRouter);
app.use('/api/v1/inventory', inventoryRouter);
app.use('/api/v1/fulfillments', fulfillmentRouter);
app.use('/api/v1/backorders', backorderRouter);
app.use('/api/v1', subscriptionRouter);
app.use('/api/v1', invoicingRouter);
app.use('/api/v1', dealHealthRouter);

app.use((req, res) => {
    res.status(404).json({ success: false, statusCode: 404, message: 'Route not found' });
});

app.use(errorMiddleware);

export {app}
