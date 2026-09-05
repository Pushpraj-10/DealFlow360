import { asyncHandler } from '../../core/utils/asyncHandler.js';
import { ApiResponse } from '../../core/utils/apiResponse.js';
import * as invoicingService from './invoicing.service.js';

const listInvoices = asyncHandler(async (req, res) => {
    const invoices = await invoicingService.listInvoices(req.query);
    return res.status(200).json(new ApiResponse(200, invoices));
});

const getInvoice = asyncHandler(async (req, res) => {
    const detail = await invoicingService.getInvoiceDetail(req.params.id);
    return res.status(200).json(new ApiResponse(200, detail));
});

const generateInvoice = asyncHandler(async (req, res) => {
    const invoice = await invoicingService.generateInvoice(req.body, req.user.id);
    return res.status(201).json(new ApiResponse(201, invoice, 'Invoice generated'));
});

const recordPayment = asyncHandler(async (req, res) => {
    const result = await invoicingService.recordPayment(req.params.id, req.body, req.user.id);
    return res.status(201).json(new ApiResponse(201, result, 'Payment recorded'));
});

const listCreditNotes = asyncHandler(async (req, res) => {
    const creditNotes = await invoicingService.listCreditNotes(req.query);
    return res.status(200).json(new ApiResponse(200, creditNotes));
});

const issueCreditNote = asyncHandler(async (req, res) => {
    const creditNote = await invoicingService.issueCreditNote(req.body, req.user.id);
    return res.status(201).json(new ApiResponse(201, creditNote, 'Credit note issued'));
});

export { listInvoices, getInvoice, generateInvoice, recordPayment, listCreditNotes, issueCreditNote };
