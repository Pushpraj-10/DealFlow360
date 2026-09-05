import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
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
router.use(requireAuth);

router.get('/invoices', listInvoices);
router.post('/invoices', generateInvoice);
router.get('/invoices/:id', getInvoice);
router.post('/invoices/:id/payments', recordPayment);

router.get('/credit-notes', listCreditNotes);
router.post('/credit-notes', issueCreditNote);

export default router;
