import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { ApiError } from '../../core/utils/apiError.js';
import { ErrorCodes } from '../../core/utils/errorCodes.js';
import { logAction } from '../_shared/audit-log/audit-log.service.js';
import * as dealHealthRepository from './deal-health.repository.js';
import { QUOTATION_STATUSES, APPROVAL_STATUSES } from '../../core/constants.js';

// PRD section 8.10 - configurable v1 thresholds.
const STALLED_DAYS = 7;
const ANOMALY_DELTA_PP = 10;
const ANOMALY_MIN_SAMPLE = 3;
const ANOMALY_LOOKBACK = 10;
const DELIVERY_LEAD_DAYS = 5;
const BACKORDER_EXTRA_LEAD_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const daysSince = (date) => (Date.now() - new Date(date).getTime()) / MS_PER_DAY;

const computeEffectiveDiscountPct = (lines) => {
    let weightedSum = 0;
    let weightTotal = 0;
    for (const line of lines) {
        // Dollar-denominated weight is fine here - this only computes a
        // weighted average percentage, so units cancel out.
        const preDiscountValue = line.quantity * line.unitPrice;
        weightedSum += preDiscountValue * line.discountPercent;
        weightTotal += preDiscountValue;
    }
    return weightTotal > 0 ? weightedSum / weightTotal : 0;
};

const evaluateQuotation = async (quotation) => {
    const triggered = [];

    // dhan's Quotation has no last_activity_at field; its default `updatedAt`
    // timestamp is used as the "last meaningful activity" signal instead.
    if (
        ![QUOTATION_STATUSES.CONFIRMED, QUOTATION_STATUSES.CANCELLED, QUOTATION_STATUSES.REJECTED].includes(
            quotation.status
        ) &&
        daysSince(quotation.updatedAt) >= STALLED_DAYS
    ) {
        triggered.push({
            type: 'STALLED',
            severity: 'MEDIUM',
            details: { idle_days: Math.floor(daysSince(quotation.updatedAt)) },
        });
    }

    const lines = await dealHealthRepository.findLinesByQuotationId(quotation._id);
    if (lines.length > 0) {
        const currentDiscountPct = computeEffectiveDiscountPct(lines);
        const history = await dealHealthRepository.findHistoricalQuotationsByOwner(
            quotation.salesRepId,
            quotation._id,
            ANOMALY_LOOKBACK
        );

        if (history.length >= ANOMALY_MIN_SAMPLE) {
            const historyDiscounts = [];
            for (const historicalQuote of history) {
                const historicalLines = await dealHealthRepository.findLinesByQuotationId(historicalQuote._id);
                if (historicalLines.length > 0) {
                    historyDiscounts.push(computeEffectiveDiscountPct(historicalLines));
                }
            }

            // Do not flag until a minimum sample size is actually available,
            // per PRD section 13's explicit edge case.
            if (historyDiscounts.length >= ANOMALY_MIN_SAMPLE) {
                const repAvgDiscountPct =
                    historyDiscounts.reduce((sum, d) => sum + d, 0) / historyDiscounts.length;

                if (currentDiscountPct >= repAvgDiscountPct + ANOMALY_DELTA_PP) {
                    triggered.push({
                        type: 'DISCOUNT_ANOMALY',
                        severity:
                            currentDiscountPct >= repAvgDiscountPct + ANOMALY_DELTA_PP * 2 ? 'HIGH' : 'MEDIUM',
                        details: {
                            current_discount_pct: Number(currentDiscountPct.toFixed(2)),
                            rep_avg_discount_pct: Number(repAvgDiscountPct.toFixed(2)),
                        },
                    });
                }
            }
        }
    }

    if (quotation.requestedDeliveryDate) {
        const fulfillment = await dealHealthRepository.findFulfillmentByQuotationId(quotation._id);
        const backordered = fulfillment && ['BACKORDER', 'PARTIAL_BACKORDER'].includes(fulfillment.status);
        const leadDays = DELIVERY_LEAD_DAYS + (backordered ? BACKORDER_EXTRA_LEAD_DAYS : 0);
        const feasibleDate = new Date(Date.now() + leadDays * MS_PER_DAY);

        if (new Date(quotation.requestedDeliveryDate) < feasibleDate) {
            triggered.push({
                type: 'DELIVERY_SLIPPAGE',
                severity: backordered ? 'HIGH' : 'MEDIUM',
                details: {
                    requested_delivery_date: quotation.requestedDeliveryDate,
                    estimated_feasible_date: feasibleDate,
                },
            });
        }
    }

    return triggered;
};

const DEFAULT_PAGE_SIZE = 20;
// Bounds a single page fetch, but also doubles as the export cap: the
// frontend re-requests page=1 with limit=<rows already loaded via infinite
// scroll> so export matches exactly what's on screen, so this needs to be
// generous enough to cover a long scroll session rather than just one page.
const MAX_PAGE_SIZE = 500;

// Clamps and defaults page/limit query params shared by both paginated
// endpoints (alerts list, sales report) so an invalid or absurdly large
// value from the client can't blow up a query.
const resolvePagination = (page, limit) => {
    const pageNum = Math.max(1, Math.trunc(Number(page)) || 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(Number(limit)) || DEFAULT_PAGE_SIZE));
    return { page: pageNum, limit: pageSize };
};

/**
 * Compute-on-read: scans open quotations, creates any newly-triggered
 * alerts (idempotently - skips a type already OPEN for a quote), then
 * returns a page of the current alert list filtered per the caller's query.
 */
const scanAndListAlerts = async ({ type, severity, status, page, limit } = {}) => {
    const quotations = await dealHealthRepository.findOpenQuotations();

    for (const quotation of quotations) {
        const triggeredTypes = await evaluateQuotation(quotation);

        for (const t of triggeredTypes) {
            const existing = await dealHealthRepository.findExistingOpenAlert(quotation._id, t.type);
            if (existing) continue;

            const alert = await dealHealthRepository.createAlert({
                quotation_id: quotation._id,
                type: t.type,
                severity: t.severity,
                details: t.details,
            });

            await logAction({
                action: 'DEAL_ALERT_CREATED',
                entityType: 'DealAlert',
                entityId: alert._id,
                metadata: t.details,
            });
        }
    }

    const filter = {};
    if (type) filter.type = type;
    if (severity) filter.severity = severity;
    filter.status = status || { $in: ['OPEN', 'ACKNOWLEDGED'] };

    const { page: pageNum, limit: pageSize } = resolvePagination(page, limit);
    const [alerts, total] = await Promise.all([
        dealHealthRepository.findAlerts(filter, { skip: (pageNum - 1) * pageSize, limit: pageSize }),
        dealHealthRepository.countAlerts(filter),
    ]);

    return {
        alerts,
        pagination: { page: pageNum, limit: pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
};

const getAlertOrThrow = async (id) => {
    const alert = await dealHealthRepository.findAlertById(id);
    if (!alert) {
        throw new ApiError(404, 'Deal alert not found', [], '', ErrorCodes.NOT_FOUND);
    }
    return alert;
};

const nudgeAlert = async (alertId, { message }, actorId) => {
    const alert = await getAlertOrThrow(alertId);
    const quotation = await dealHealthRepository.findQuotationById(alert.quotation_id);

    const notification = await dealHealthRepository.createNotification({
        user_id: quotation.salesRepId,
        type: 'DEAL_ALERT_NUDGE',
        entity_ref: { entity_type: 'DealAlert', entity_id: alert._id },
    });

    await logAction({
        actorId,
        action: 'DEAL_ALERT_NUDGED',
        entityType: 'DealAlert',
        entityId: alertId,
        reason: message || '',
    });

    return { alert, notification };
};

const escalateAlert = async (alertId, { reason }, actorId) => {
    const alert = await getAlertOrThrow(alertId);
    const updated = await dealHealthRepository.updateAlert(alertId, {
        severity: 'HIGH',
        status: 'ACKNOWLEDGED',
    });

    const managers = await dealHealthRepository.findManagers();
    const notifications = await Promise.all(
        managers.map((manager) =>
            dealHealthRepository.createNotification({
                user_id: manager._id,
                type: 'DEAL_ALERT_ESCALATION',
                entity_ref: { entity_type: 'DealAlert', entity_id: alert._id },
            })
        )
    );

    await logAction({
        actorId,
        action: 'DEAL_ALERT_ESCALATED',
        entityType: 'DealAlert',
        entityId: alertId,
        reason: reason || '',
    });

    return { alert: updated, notified: notifications.length };
};

const getDashboard = async () => {
    const [quotationsByStatus, invoicesByStatus, activeSubscriptions, totalsRows, openAlerts] = await Promise.all([
        dealHealthRepository.countQuotationsByStatus(),
        dealHealthRepository.countInvoicesByStatus(),
        dealHealthRepository.countActiveSubscriptions(),
        dealHealthRepository.sumInvoiceTotals(),
        dealHealthRepository.findAlerts({ status: { $in: ['OPEN', 'ACKNOWLEDGED'] } }),
    ]);

    const totals = totalsRows[0] || { total_cents: 0, paid_cents: 0 };

    return {
        quotationsByStatus,
        invoicesByStatus,
        activeSubscriptions,
        invoiceTotals: { total_cents: totals.total_cents, paid_cents: totals.paid_cents },
        openAlertsCount: openAlerts.length,
        openAlertsByType: openAlerts.reduce((acc, a) => {
            acc[a.type] = (acc[a.type] || 0) + 1;
            return acc;
        }, {}),
    };
};

const resolvePeriodRange = (period, from, to) => {
    if (from || to) {
        return { from: from ? new Date(from) : new Date(0), to: to ? new Date(to) : new Date() };
    }
    const now = new Date();
    if (period === 'today') {
        const start = new Date(now);
        start.setUTCHours(0, 0, 0, 0);
        return { from: start, to: now };
    }
    if (period === 'week') {
        return { from: new Date(now.getTime() - 7 * MS_PER_DAY), to: now };
    }
    return { from: new Date(0), to: now };
};

const buildSalesReportRows = async ({ period, team, repId, status, approvalStatus, product, category, from, to }) => {
    const { from: fromDate, to: toDate } = resolvePeriodRange(period, from, to);

    const filter = { createdAt: { $gte: fromDate, $lte: toDate } };
    if (status) filter.status = status;
    if (approvalStatus) filter.approvalStatus = approvalStatus;

    if (repId) {
        filter.salesRepId = repId;
    } else if (team) {
        const teamUsers = await dealHealthRepository.findUsersByTeam(team);
        filter.salesRepId = { $in: teamUsers.map((u) => u._id) };
    }

    const quotations = await dealHealthRepository.findQuotations(filter);

    let categoryProductIds = null;
    if (category) {
        const categoryProducts = await dealHealthRepository.findProductsByCategory(category);
        categoryProductIds = new Set(categoryProducts.map((p) => p._id.toString()));
    }

    const rows = [];
    for (const quotation of quotations) {
        let lines = await dealHealthRepository.findLinesByQuotationId(quotation._id);
        if (product) {
            lines = lines.filter((l) => l.productId?.toString() === product);
        }
        if (categoryProductIds) {
            lines = lines.filter((l) => categoryProductIds.has(l.productId?.toString()));
        }
        if ((product || category) && lines.length === 0) continue;

        // Convert dhan's plain-dollar unitPrice to cents at this read boundary.
        const grossCents = lines.reduce((sum, l) => sum + l.quantity * Math.round(l.unitPrice * 100), 0);
        const netCents = lines.reduce(
            (sum, l) =>
                sum + Math.round(l.quantity * Math.round(l.unitPrice * 100) * (1 - l.discountPercent / 100)),
            0
        );
        const effectiveDiscountPct = computeEffectiveDiscountPct(lines);

        rows.push({
            quotation_id: quotation._id,
            quote_no: quotation.quoteNumber,
            owner_id: quotation.salesRepId,
            status: quotation.status,
            created_at: quotation.createdAt,
            line_count: lines.length,
            gross_cents: grossCents,
            net_cents: netCents,
            effective_discount_pct: Number(effectiveDiscountPct.toFixed(2)),
        });
    }

    return rows;
};

const getSalesReportFilters = async () => {
    const [reps, teams] = await Promise.all([
        dealHealthRepository.findSalesReps(),
        dealHealthRepository.findDistinctTeams(),
    ]);

    return {
        reps: reps.map((rep) => ({ id: rep._id, fullName: rep.fullName, email: rep.email, team: rep.team })),
        teams,
        approvalStatuses: Object.values(APPROVAL_STATUSES),
    };
};

const summarizeRows = (rows) => ({
    totalQuotations: rows.length,
    totalNetCents: rows.reduce((sum, r) => sum + r.net_cents, 0),
    avgDiscountPct:
        rows.length > 0
            ? Number((rows.reduce((sum, r) => sum + r.effective_discount_pct, 0) / rows.length).toFixed(2))
            : 0,
});

// The dashboard summary (quotations/net/avg discount) stays computed over the
// FULL filtered set, independent of which page is being viewed - only the
// row table itself is sliced to the requested page.
const getSalesReport = async (filters) => {
    const rows = await buildSalesReportRows(filters);
    const { page: pageNum, limit: pageSize } = resolvePagination(filters.page, filters.limit);
    const total = rows.length;
    const start = (pageNum - 1) * pageSize;

    return {
        rows: rows.slice(start, start + pageSize),
        summary: summarizeRows(rows),
        pagination: { page: pageNum, limit: pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
};

// PRD section A7 asks for PDF/XLS export. Export is scoped to exactly the
// same page/limit the caller is currently viewing (not the whole filtered
// set) so a download always matches what's actually on screen rather than
// silently re-fetching and exporting everything.
const buildSalesReportWorkbook = async (filters) => {
    const allRows = await buildSalesReportRows(filters);
    const { page: pageNum, limit: pageSize } = resolvePagination(filters.page, filters.limit);
    const start = (pageNum - 1) * pageSize;
    const rows = allRows.slice(start, start + pageSize);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'DealFlow360';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Sales Report');
    sheet.columns = [
        { header: 'Quote No', key: 'quote_no', width: 18 },
        { header: 'Status', key: 'status', width: 16 },
        { header: 'Created At', key: 'created_at', width: 22 },
        { header: 'Lines', key: 'line_count', width: 8 },
        { header: 'Gross', key: 'gross', width: 14, style: { numFmt: '$#,##0.00' } },
        { header: 'Net', key: 'net', width: 14, style: { numFmt: '$#,##0.00' } },
        { header: 'Discount %', key: 'effective_discount_pct', width: 12 },
    ];
    sheet.getRow(1).font = { bold: true };

    for (const row of rows) {
        sheet.addRow({
            quote_no: row.quote_no,
            status: row.status,
            created_at: new Date(row.created_at).toLocaleString(),
            line_count: row.line_count,
            gross: row.gross_cents / 100,
            net: row.net_cents / 100,
            effective_discount_pct: row.effective_discount_pct,
        });
    }

    const summaryRow = sheet.addRow({});
    summaryRow.getCell('quote_no').value = 'Totals';
    summaryRow.getCell('quote_no').font = { bold: true };
    summaryRow.getCell('net').value = rows.reduce((sum, r) => sum + r.net_cents, 0) / 100;
    summaryRow.getCell('net').font = { bold: true };

    return workbook.xlsx.writeBuffer();
};

const PDF_REPORT_COLUMNS = [
    { key: 'quote_no', label: 'Quote No', width: 160, align: 'left' },
    { key: 'status', label: 'Status', width: 130, align: 'left' },
    { key: 'created_at', label: 'Created At', width: 120, align: 'left' },
    { key: 'line_count', label: 'Lines', width: 50, align: 'right' },
    { key: 'gross', label: 'Gross', width: 90, align: 'right' },
    { key: 'net', label: 'Net', width: 90, align: 'right' },
    { key: 'effective_discount_pct', label: 'Discount %', width: 90, align: 'right' },
];

const buildSalesReportPdf = async (filters) => {
    const allRows = await buildSalesReportRows(filters);
    const { page: pageNum, limit: pageSize } = resolvePagination(filters.page, filters.limit);
    const start = (pageNum - 1) * pageSize;
    const rows = allRows.slice(start, start + pageSize);

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40 });
        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const tableLeft = doc.page.margins.left;
        const rowHeight = 20;
        const tableWidth = PDF_REPORT_COLUMNS.reduce((sum, col) => sum + col.width, 0);

        const drawHeaderRow = (y) => {
            doc.font('Helvetica-Bold').fontSize(9).fillColor('#000');
            let x = tableLeft;
            for (const col of PDF_REPORT_COLUMNS) {
                doc.text(col.label, x, y, { width: col.width, align: col.align });
                x += col.width;
            }
            doc.moveTo(tableLeft, y + 14).lineTo(tableLeft + tableWidth, y + 14).strokeColor('#ccc').stroke();
        };

        doc.font('Helvetica-Bold').fontSize(16).fillColor('#000').text('DealFlow360 Sales Report', tableLeft, 40);
        doc.font('Helvetica').fontSize(9).fillColor('#555').text(`Generated ${new Date().toLocaleString()}`, tableLeft, 62);

        const totalNetCents = rows.reduce((sum, r) => sum + r.net_cents, 0);
        const avgDiscountPct = rows.length
            ? (rows.reduce((sum, r) => sum + r.effective_discount_pct, 0) / rows.length).toFixed(2)
            : '0.00';
        doc
            .fontSize(9)
            .fillColor('#333')
            .text(
                `${rows.length} quotation${rows.length === 1 ? '' : 's'} - Total net $${(totalNetCents / 100).toFixed(2)} - Avg discount ${avgDiscountPct}%`,
                tableLeft,
                78
            );

        const bottomLimit = doc.page.height - doc.page.margins.bottom;
        let y = 110;
        drawHeaderRow(y);
        y += rowHeight;

        for (const row of rows) {
            if (y + rowHeight > bottomLimit) {
                doc.addPage();
                y = doc.page.margins.top;
                drawHeaderRow(y);
                y += rowHeight;
            }

            const values = {
                quote_no: row.quote_no,
                status: row.status.replace(/_/g, ' '),
                created_at: new Date(row.created_at).toLocaleDateString(),
                line_count: String(row.line_count),
                gross: `$${(row.gross_cents / 100).toFixed(2)}`,
                net: `$${(row.net_cents / 100).toFixed(2)}`,
                effective_discount_pct: `${row.effective_discount_pct}%`,
            };

            doc.font('Helvetica').fontSize(8.5).fillColor('#111');
            let x = tableLeft;
            for (const col of PDF_REPORT_COLUMNS) {
                doc.text(values[col.key], x, y, {
                    width: col.width,
                    height: rowHeight - 6,
                    align: col.align,
                    ellipsis: true,
                });
                x += col.width;
            }
            y += rowHeight;
        }

        doc.end();
    });
};

export {
    scanAndListAlerts,
    getAlertOrThrow,
    nudgeAlert,
    escalateAlert,
    getDashboard,
    getSalesReportFilters,
    getSalesReport,
    buildSalesReportWorkbook,
    buildSalesReportPdf,
};
