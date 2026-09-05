import { Router } from 'express';
import { authenticate } from '../../core/middlewares/auth.middleware.js';
import {
    listInvoices,
    getInvoice,
    generateInvoice,
    recordPayment,
    listCreditNotes,
    issueCreditNote,
} from './invoicing.controller.js';

// Mounted at the API root in app.js since this feature spans two resource
// prefixes (/invoices, /credit-notes).
const router = Router();
router.use(authenticate);

router.get('/invoices', listInvoices);
router.post('/invoices', generateInvoice);
router.get('/invoices/:id', getInvoice);
router.post('/invoices/:id/payments', recordPayment);

router.get('/credit-notes', listCreditNotes);
router.post('/credit-notes', issueCreditNote);

export default router;
