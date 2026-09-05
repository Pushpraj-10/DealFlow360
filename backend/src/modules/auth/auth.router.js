import { Router } from 'express';
import { issueDevToken } from './auth.controller.js';

const router = Router();

router.post('/dev-token', issueDevToken);

export default router;
