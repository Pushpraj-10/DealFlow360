import { ApiError } from '../../core/utils/apiError.js';
import { ErrorCodes } from '../../core/utils/errorCodes.js';
import { logAction } from '../_shared/audit-log/audit-log.service.js';
import * as dealHealthRepository from './deal-health.repository.js';
import { QUOTATION_STATUSES } from '../../core/constants.js';

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

/**
 * Compute-on-read: scans open quotations, creates any newly-triggered
 * alerts (idempotently - skips a type already OPEN for a quote), then
 * returns the current alert list filtered per the caller's query.
 */
const scanAndListAlerts = async ({ type, severity, status } = {}) => {
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

    return dealHealthRepository.findAlerts(filter);
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

const buildSalesReportRows = async ({ period, team, status, product, from, to }) => {
    const { from: fromDate, to: toDate } = resolvePeriodRange(period, from, to);

    const filter = { createdAt: { $gte: fromDate, $lte: toDate } };
    if (status) filter.status = status;

    if (team) {
        const teamUsers = await dealHealthRepository.findUsersByTeam(team);
        filter.salesRepId = { $in: teamUsers.map((u) => u._id) };
    }

    const quotations = await dealHealthRepository.findQuotations(filter);

    const rows = [];
    for (const quotation of quotations) {
        let lines = await dealHealthRepository.findLinesByQuotationId(quotation._id);
        if (product) {
            lines = lines.filter((l) => l.productId?.toString() === product);
        }
        if (product && lines.length === 0) continue;

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

const getSalesReport = async (filters) => {
    const rows = await buildSalesReportRows(filters);
    return {
        rows,
        summary: {
            totalQuotations: rows.length,
            totalNetCents: rows.reduce((sum, r) => sum + r.net_cents, 0),
            avgDiscountPct:
                rows.length > 0
                    ? Number((rows.reduce((sum, r) => sum + r.effective_discount_pct, 0) / rows.length).toFixed(2))
                    : 0,
        },
    };
};

const toCsv = (rows) => {
    if (rows.length === 0) return 'quote_no,status,created_at,line_count,gross_cents,net_cents,effective_discount_pct\n';
    const header = Object.keys(rows[0]).join(',');
    const body = rows
        .map((row) => Object.values(row).map((v) => `"${v ?? ''}"`).join(','))
        .join('\n');
    return `${header}\n${body}`;
};

const exportSalesReportCsv = async (filters) => {
    const rows = await buildSalesReportRows(filters);
    return toCsv(rows);
};

export {
    scanAndListAlerts,
    getAlertOrThrow,
    nudgeAlert,
    escalateAlert,
    getDashboard,
    getSalesReport,
    exportSalesReportCsv,
};
