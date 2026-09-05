import { asyncHandler } from '../../core/utils/asyncHandler.js';
import { ApiResponse } from '../../core/utils/apiResponse.js';
import * as dealHealthService from './deal-health.service.js';

const listAlerts = asyncHandler(async (req, res) => {
    const alerts = await dealHealthService.scanAndListAlerts(req.query);
    return res.status(200).json(new ApiResponse(200, alerts));
});

const nudgeAlert = asyncHandler(async (req, res) => {
    const result = await dealHealthService.nudgeAlert(req.params.alertId, req.body, req.user.id);
    return res.status(200).json(new ApiResponse(200, result, 'Rep nudged'));
});

const escalateAlert = asyncHandler(async (req, res) => {
    const result = await dealHealthService.escalateAlert(req.params.alertId, req.body, req.user.id);
    return res.status(200).json(new ApiResponse(200, result, 'Alert escalated'));
});

const getDashboard = asyncHandler(async (req, res) => {
    const dashboard = await dealHealthService.getDashboard();
    return res.status(200).json(new ApiResponse(200, dashboard));
});

const getSalesReport = asyncHandler(async (req, res) => {
    const report = await dealHealthService.getSalesReport(req.query);
    return res.status(200).json(new ApiResponse(200, report));
});

const exportSalesReport = asyncHandler(async (req, res) => {
    const csv = await dealHealthService.exportSalesReportCsv(req.query);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="sales-report.csv"');
    return res.status(200).send(csv);
});

export { listAlerts, nudgeAlert, escalateAlert, getDashboard, getSalesReport, exportSalesReport };
