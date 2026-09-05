import './core/config/env.js';
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

import healthcheckRoutes from './modules/healthcheck/healthcheck.routes.js';
import {errorHandler} from './core/middlewares/error.middleware.js';
import {registerModuleRoutes} from './modules/index.js';

app.use('/api/v1/healthcheck', healthcheckRoutes);
registerModuleRoutes(app);

app.use(errorHandler);

export {app}
