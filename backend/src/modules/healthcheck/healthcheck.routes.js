import { Router } from 'express';
import { getHealth } from './healthcheck.controller.js';

const router = Router();

router.get('/', getHealth);

export default router;
