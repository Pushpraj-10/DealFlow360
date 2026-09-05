'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, ApiClientError } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Clock3,
  DollarSign,
  FileText,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Activity,
  Truck,
  Receipt,
  CreditCard,
} from 'lucide-react';
import {
  formatStatus,
  getActivityTime,
  getCustomerName,
  getStatusClass,
  isAttentionStatus,
  isOpenDeal,
  money,
  normalizeQuotationCard,
  timeAgo,
  type NegotiationWorkItem,
  type PipelineStage,
  type QuotationListItem,
} from '@/lib/salesRep';
import type { ApprovalRequest } from '@/lib/manager';
import {
  approvalAmount,
  approvalCustomer,
  approvalQuoteNumber,
  approvalRiskClass,
  approvalUpdated,
  requestedByName,
} from '@/lib/manager';
import {
  customerLabel,
  formatDate,
  formatStatus as formatOpsStatus,
  fulfillmentCustomer,
  isOpenFulfillment,
  moneyCents as opsMoney,
  operationsStatusClass,
  planName,
  timeAgo as opsTimeAgo,
  type Backorder,
  type Fulfillment,
  type Invoice,
  type Subscription,
} from '@/lib/operations';

type DashboardData = {
  quotationsByStatus: { _id: string; count: number }[];
  invoicesByStatus: { _id: string; count: number }[];
  activeSubscriptions: number;
  invoiceTotals: { total_cents: number; paid_cents: number };
  openAlertsCount: number;
  openAlertsByType: Record<string, number>;
};

function moneyCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function SkeletonMetric() {
  return (
    <div className="df-metric">
      <div className="skeleton" style={{ width: 80, height: 11, marginBottom: 10, borderRadius: 3 }} />
      <div className="skeleton" style={{ width: 100, height: 28, borderRadius: 4 }} />
    </div>
  );
}

function SalesRepOverview() {
  const { user } = useAuth();
  const [quotations, setQuotations] = useState<QuotationListItem[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [negotiations, setNegotiations] = useState<NegotiationWorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [quoteData, pipelineData] = await Promise.all([
          api.get<{ quotations: QuotationListItem[] }>('/quotations'),
          api.get<{ stages: PipelineStage[] }>('/quotations/pipeline'),
        ]);
        const normalizedQuotes = quoteData.quotations.map(normalizeQuotationCard);

        const negotiationResults = await Promise.allSettled(
          normalizedQuotes
            .filter((quote) => ['UNDER_NEGOTIATION', 'SENT_TO_CUSTOMER', 'READY_FOR_CUSTOMER', 'APPROVED'].includes(quote.status))
            .map(async (quote) => {
              const data = await api.get<{ negotiations: NegotiationWorkItem['negotiation'][] }>(`/negotiations/quotations/${quote.id}`);
              return data.negotiations.map((negotiation) => ({ quotation: quote, negotiation }));
            })
        );
        const negotiationItems = negotiationResults.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));

        if (!mounted) return;
        setQuotations(normalizedQuotes);
        setStages(
          pipelineData.stages
            .map((stage) => ({ ...stage, cards: stage.cards.map(normalizeQuotationCard) }))
            .filter((stage) => stage.cards.length > 0)
        );
        setNegotiations(negotiationItems);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof ApiClientError ? err.message : 'Failed to load your sales workspace');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const activeQuotes = quotations.filter((quote) => isOpenDeal(quote.status));
  const awaitingApproval = quotations.filter(
    (quote) => quote.status === 'PENDING_APPROVAL' || quote.approvalStatus === 'PENDING'
  );
  const waitingNegotiations = negotiations.filter((item) => item.negotiation.status === 'SUBMITTED');
  const attentionItems = [
    ...waitingNegotiations.map((item) => ({
      id: item.negotiation._id,
      customer: getCustomerName(item.quotation.customer),
      detail: item.negotiation.messages?.[0]?.message || item.negotiation.requests?.[0]?.comment || 'Customer requested commercial review',
      meta: `${item.quotation.quoteNumber} - ${timeAgo(item.negotiation.updatedAt || item.negotiation.createdAt)}`,
      href: '/sales/negotiations',
      tone: 'blue',
    })),
    ...quotations
      .filter((quote) => isAttentionStatus(quote.status) || quote.riskSeverity === 'HIGH')
      .map((quote) => ({
        id: quote.id,
        customer: getCustomerName(quote.customer),
        detail:
          quote.status === 'PENDING_APPROVAL'
            ? 'Awaiting approval'
            : quote.status === 'REAPPROVAL_REQUIRED'
              ? 'Reapproval required after changed terms'
              : quote.status === 'RETURNED_FOR_REVISION'
                ? 'Returned for revision'
                : quote.riskSeverity === 'HIGH'
                  ? 'High risk discount review'
                  : formatStatus(quote.status),
        meta: `${quote.quoteNumber} - ${timeAgo(getActivityTime(quote))}`,
        href: '/sales/quotations',
        tone: quote.riskSeverity === 'HIGH' ? 'amber' : 'neutral',
      })),
  ].slice(0, 6);

  const activePipelineValue = activeQuotes.reduce((sum, quote) => sum + Number(quote.total || 0), 0);
  const firstName = user?.fullName?.split(' ')[0] || 'there';

  return (
    <div className="sales-page">
      <section className="sales-hero-panel">
        <div>
          <p className="sales-eyebrow">Today</p>
          <h1>Good afternoon, {firstName}</h1>
          <p>Here is what needs your attention today.</p>
        </div>
        <Link href="/sales/quotations" className="btn btn-primary">
          New quotation
          <ArrowRight size={14} />
        </Link>
      </section>

      {error && (
        <div className="df-alert df-alert-error">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      <section className="sales-work-grid">
        <div className="sales-primary-metric">
          <span className="sales-metric-label">Active pipeline value</span>
          <strong>{loading ? '...' : money(activePipelineValue)}</strong>
          <span>{activeQuotes.length} active deal{activeQuotes.length === 1 ? '' : 's'}</span>
        </div>
        <div className="sales-secondary-metrics">
          <div>
            <Clock3 size={16} />
            <span>Quotes awaiting approval</span>
            <strong>{loading ? '...' : awaitingApproval.length}</strong>
          </div>
          <div>
            <MessageSquare size={16} />
            <span>Customer negotiations waiting</span>
            <strong>{loading ? '...' : waitingNegotiations.length}</strong>
          </div>
          <div>
            <FileText size={16} />
            <span>Active deals</span>
            <strong>{loading ? '...' : activeQuotes.length}</strong>
          </div>
        </div>
      </section>

      <section className="sales-section">
        <div className="sales-section-header">
          <div>
            <p className="sales-eyebrow">My Pipeline</p>
            <h2>Deal stages</h2>
          </div>
          <Link href="/sales/pipeline">Open pipeline</Link>
        </div>
        {loading ? (
          <div className="sales-stage-strip">
            {[1, 2, 3].map((item) => (
              <div className="sales-stage-summary skeleton" key={item} />
            ))}
          </div>
        ) : stages.length === 0 ? (
          <div className="sales-empty-line">No active quotation stages yet.</div>
        ) : (
          <div className="sales-stage-strip">
            {stages.slice(0, 5).map((stage) => (
              <div key={stage.status} className="sales-stage-summary">
                <span>{formatStatus(stage.status)}</span>
                <strong>{stage.count}</strong>
                <small>{money(stage.cards.reduce((sum, card) => sum + Number(card.total || 0), 0))}</small>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="sales-section">
        <div className="sales-section-header">
          <div>
            <p className="sales-eyebrow">Needs Attention</p>
            <h2>Work queue</h2>
          </div>
        </div>
        {loading ? (
          <div className="sales-attention-list">
            {[1, 2, 3].map((item) => (
              <div key={item} className="sales-attention-item">
                <div className="skeleton" style={{ width: 120, height: 14 }} />
                <div className="skeleton" style={{ width: 260, height: 12 }} />
              </div>
            ))}
          </div>
        ) : attentionItems.length === 0 ? (
          <div className="sales-empty-line">Nothing is waiting on you right now.</div>
        ) : (
          <div className="sales-attention-list">
            {attentionItems.map((item) => (
              <Link href={item.href} key={`${item.id}-${item.detail}`} className="sales-attention-item">
                <span className={`sales-attention-dot ${item.tone}`} />
                <span>
                  <strong>{item.customer}</strong>
                  <small>{item.detail}</small>
                </span>
                <em>{item.meta}</em>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SalesManagerOverview() {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [quotations, setQuotations] = useState<QuotationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [approvalsData, quotationsData] = await Promise.all([
          api.get<{ approvalRequests: ApprovalRequest[] }>('/approvals/pending'),
          api.get<{ quotations: QuotationListItem[] }>('/quotations'),
        ]);

        if (!mounted) return;
        setApprovals(approvalsData.approvalRequests);
        setQuotations(quotationsData.quotations.map(normalizeQuotationCard));
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof ApiClientError ? err.message : 'Failed to load manager workspace');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const pendingCount = approvals.filter((a) => a.status === 'PENDING').length;
  const highRiskDeals = quotations.filter((q) => q.riskSeverity === 'HIGH').length;
  const returnedQuotes = quotations.filter((q) => q.status === 'RETURNED_FOR_REVISION').length;

  return (
    <div className="sales-page">
      <section className="sales-hero-panel">
        <div>
          <p className="sales-eyebrow">Manager Workspace</p>
          <h1>Approvals requiring attention</h1>
          <p>What decisions require you right now.</p>
        </div>
      </section>

      {error && (
        <div className="df-alert df-alert-error">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {/* Key Metrics */}
      <section className="sales-work-grid">
        <div className="sales-primary-metric">
          <span className="sales-metric-label">Approvals Requiring Attention</span>
          <strong>{loading ? '...' : pendingCount}</strong>
          <span>{pendingCount === 1 ? 'approval waiting' : 'approvals waiting'}</span>
        </div>
        <div className="sales-secondary-metrics">
          <div>
            <AlertTriangle size={16} />
            <span>High-risk deals</span>
            <strong>{loading ? '...' : highRiskDeals}</strong>
          </div>
          <div>
            <RotateCcw size={16} />
            <span>Returned quotations</span>
            <strong>{loading ? '...' : returnedQuotes}</strong>
          </div>
          <div>
            <Clock3 size={16} />
            <span>Average approval time</span>
            <strong>Not tracked</strong>
          </div>
        </div>
      </section>

      {/* Approval Queue */}
      <section className="sales-section">
        <div className="sales-section-header">
          <div>
            <p className="sales-eyebrow">Decisions</p>
            <h2>Approval Queue</h2>
          </div>
          <Link href="/sales/approvals">View all</Link>
        </div>

        {loading ? (
          <div className="df-table-wrap">
            <table className="df-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Quote</th>
                  <th className="num">Amount</th>
                  <th>Risk</th>
                  <th>Requested By</th>
                  <th>Waiting</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3].map((i) => (
                  <tr key={i}>
                    <td><div className="skeleton" style={{ width: 120, height: 14 }} /></td>
                    <td><div className="skeleton" style={{ width: 80, height: 14 }} /></td>
                    <td><div className="skeleton" style={{ width: 60, height: 14 }} /></td>
                    <td><div className="skeleton" style={{ width: 50, height: 14 }} /></td>
                    <td><div className="skeleton" style={{ width: 90, height: 14 }} /></td>
                    <td><div className="skeleton" style={{ width: 70, height: 14 }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : approvals.length === 0 ? (
          <div className="sales-empty-line">No approvals pending. You are all caught up.</div>
        ) : (
          <div className="df-table-wrap">
            <table className="df-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Quote</th>
                  <th className="num">Amount</th>
                  <th>Risk</th>
                  <th>Requested By</th>
                  <th>Waiting</th>
                </tr>
              </thead>
              <tbody>
                {approvals.slice(0, 8).map((approval) => (
                  <tr key={approval._id} className={approval.riskLevel === 'HIGH' ? 'high-risk-row' : ''}>
                    <td>{approvalCustomer(approval)}</td>
                    <td>
                      <Link href={`/sales/approvals/${approval._id}`} className="manager-quote-link">
                        {approvalQuoteNumber(approval)}
                      </Link>
                    </td>
                    <td className="num">{approvalAmount(approval)}</td>
                    <td>
                      <span className={`risk-badge ${approvalRiskClass(approval.riskLevel)}`}>
                        {approval.riskLevel}
                      </span>
                    </td>
                    <td>{requestedByName(approval)}</td>
                    <td>{approvalUpdated(approval)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function FinanceOperationsOverview() {
  const [fulfillments, setFulfillments] = useState<Fulfillment[]>([]);
  const [backorders, setBackorders] = useState<Backorder[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedAt] = useState(() => Date.now());

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [fulfillmentData, backorderData, subscriptionData, invoiceData, approvalData] = await Promise.all([
          api.get<Fulfillment[]>('/fulfillments'),
          api.get<Backorder[]>('/backorders'),
          api.get<Subscription[]>('/subscriptions'),
          api.get<Invoice[]>('/invoices'),
          api.get<{ approvalRequests: ApprovalRequest[] }>('/approvals/pending'),
        ]);

        if (!mounted) return;
        setFulfillments(fulfillmentData);
        setBackorders(backorderData);
        setSubscriptions(subscriptionData);
        setInvoices(invoiceData);
        setApprovals(approvalData.approvalRequests);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof ApiClientError ? err.message : 'Failed to load operations workspace');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const openFulfillments = fulfillments.filter((item) => isOpenFulfillment(item.status));
  const reviewSplits = fulfillments.filter((item) => {
    const status = item.status?.toUpperCase() || '';
    return status.includes('SPLIT') || status === 'PENDING' || status === 'PENDING_REVIEW';
  });
  const activeBackorders = backorders.filter((item) => !['RESOLVED', 'CANCELLED', 'FULFILLED'].includes(item.status?.toUpperCase()));
  const unpaidInvoices = invoices.filter((item) => ['UNPAID', 'PARTIALLY_PAID'].includes(item.status?.toUpperCase()));
  const upcomingBilling = subscriptions
    .filter((item) => {
      if (item.status !== 'ACTIVE' || !item.next_bill_date) return false;
      const nextBill = new Date(item.next_bill_date).getTime();
      const twoWeeks = loadedAt + 14 * 24 * 60 * 60 * 1000;
      return !Number.isNaN(nextBill) && nextBill <= twoWeeks;
    })
    .sort((a, b) => new Date(a.next_bill_date).getTime() - new Date(b.next_bill_date).getTime());

  const attentionItems = [
    ...reviewSplits.map((item) => ({
      id: `split-${item._id}`,
      label: fulfillmentCustomer(item),
      detail: 'Warehouse split requires review',
      meta: `${formatOpsStatus(item.status)} - ${opsTimeAgo(item.updated_at || item.created_at)}`,
      href: '/operations/fulfillment',
      tone: 'blue',
    })),
    ...activeBackorders.map((item) => ({
      id: `backorder-${item._id}`,
      label: `Backorder ...${item._id.slice(-8)}`,
      detail: `${item.qty} unit${item.qty === 1 ? '' : 's'} backordered`,
      meta: `${formatOpsStatus(item.status)} - ${opsTimeAgo(item.updated_at || item.created_at)}`,
      href: '/operations/fulfillment',
      tone: 'amber',
    })),
    ...unpaidInvoices.map((item) => ({
      id: `invoice-${item._id}`,
      label: item.invoice_no,
      detail: `${opsMoney(Math.max(0, item.total_cents - item.paid_amount_cents))} outstanding`,
      meta: `Due ${formatDate(item.due_date)}`,
      href: '/finance/invoices',
      tone: item.status === 'UNPAID' ? 'red' : 'amber',
    })),
  ].slice(0, 7);

  const recentFulfillment = [...fulfillments]
    .sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime())
    .slice(0, 5);

  return (
    <div className="ops-page">
      <section className="ops-hero-panel">
        <div>
          <p className="ops-eyebrow">Finance / Operations</p>
          <h1>Operations today</h1>
          <p>What operational work requires action.</p>
        </div>
        <Link href="/operations/fulfillment" className="btn btn-primary">
          Open fulfillment
          <ArrowRight size={14} />
        </Link>
      </section>

      {error && (
        <div className="df-alert df-alert-error">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      <section className="ops-work-grid">
        <div className="ops-primary-metric">
          <span>Orders awaiting fulfillment</span>
          <strong>{loading ? '...' : openFulfillments.length}</strong>
          <small>{reviewSplits.length} warehouse split{reviewSplits.length === 1 ? '' : 's'} require review</small>
        </div>
        <div className="ops-secondary-metrics">
          <div>
            <Truck size={16} />
            <span>Backorders</span>
            <strong>{loading ? '...' : activeBackorders.length}</strong>
          </div>
          <div>
            <Receipt size={16} />
            <span>Unpaid invoices</span>
            <strong>{loading ? '...' : unpaidInvoices.length}</strong>
          </div>
          <div>
            <RefreshCw size={16} />
            <span>Upcoming billing</span>
            <strong>{loading ? '...' : upcomingBilling.length}</strong>
          </div>
          <div>
            <CreditCard size={16} />
            <span>Approvals</span>
            <strong>{loading ? '...' : approvals.length}</strong>
          </div>
        </div>
      </section>

      <div className="ops-dashboard-grid">
        <section className="ops-panel">
          <div className="ops-panel-header">
            <div>
              <p className="ops-eyebrow">Requires Attention</p>
              <h2>Operational queue</h2>
            </div>
          </div>
          {loading ? (
            <div className="ops-list">
              {[1, 2, 3].map((item) => (
                <div className="ops-list-item" key={item}>
                  <div className="skeleton" style={{ width: 150, height: 14 }} />
                  <div className="skeleton" style={{ width: 220, height: 12 }} />
                </div>
              ))}
            </div>
          ) : attentionItems.length === 0 ? (
            <div className="ops-empty-line">No operational exceptions need attention.</div>
          ) : (
            <div className="ops-list">
              {attentionItems.map((item) => (
                <Link href={item.href} key={item.id} className="ops-list-item">
                  <span className={`ops-dot ${item.tone}`} />
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.detail}</small>
                  </span>
                  <em>{item.meta}</em>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="ops-panel">
          <div className="ops-panel-header">
            <div>
              <p className="ops-eyebrow">Recent Fulfillment</p>
              <h2>Latest order movement</h2>
            </div>
            <Link href="/operations/fulfillment">View all</Link>
          </div>
          {loading ? (
            <div className="ops-compact-table">
              {[1, 2, 3].map((item) => (
                <div key={item} className="ops-compact-row">
                  <div className="skeleton" style={{ width: 110, height: 13 }} />
                  <div className="skeleton" style={{ width: 84, height: 13 }} />
                </div>
              ))}
            </div>
          ) : recentFulfillment.length === 0 ? (
            <div className="ops-empty-line">No fulfillment records yet.</div>
          ) : (
            <div className="ops-compact-table">
              {recentFulfillment.map((item) => (
                <Link href="/operations/fulfillment" key={item._id} className="ops-compact-row">
                  <span>
                    <strong>...{item._id.slice(-8)}</strong>
                    <small>{fulfillmentCustomer(item)}</small>
                  </span>
                  <em className={`status-badge ${operationsStatusClass(item.status)}`}>{formatOpsStatus(item.status)}</em>
                  <small>{opsTimeAgo(item.updated_at || item.created_at)}</small>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="ops-panel ops-panel-wide">
          <div className="ops-panel-header">
            <div>
              <p className="ops-eyebrow">Upcoming Billing</p>
              <h2>Next subscription charges</h2>
            </div>
            <Link href="/finance/subscriptions">Open subscriptions</Link>
          </div>
          {loading ? (
            <div className="ops-billing-strip">
              {[1, 2, 3].map((item) => (
                <div className="ops-billing-item skeleton" key={item} />
              ))}
            </div>
          ) : upcomingBilling.length === 0 ? (
            <div className="ops-empty-line">No active subscriptions bill in the next 14 days.</div>
          ) : (
            <div className="ops-billing-strip">
              {upcomingBilling.slice(0, 5).map((item) => (
                <Link href="/finance/subscriptions" key={item._id} className="ops-billing-item">
                  <strong>{customerLabel(item.customer_id)}</strong>
                  <span>{planName(item)}</span>
                  <em>{opsMoney(item.recurring_unit_price_cents * item.qty)}</em>
                  <small>{formatDate(item.next_bill_date)}</small>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function DashboardPageFallback() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<DashboardData>('/dashboard')
      .then(setData)
      .catch((err) =>
        setError(err instanceof ApiClientError ? err.message : 'Failed to load dashboard')
      );
  }, []);

  const collected = data ? data.invoiceTotals.paid_cents : 0;
  const total = data ? data.invoiceTotals.total_cents : 0;
  const collectionRate = total > 0 ? Math.round((collected / total) * 100) : 0;

  return (
    <div className="df-page">
      <div className="df-page-header">
        <div>
          <h1 className="df-page-title">Overview</h1>
          <p className="df-page-subtitle">Sales operations at a glance</p>
        </div>
      </div>

      {error && (
        <div className="df-alert df-alert-error">
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{error}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {!data ? (
          <>
            <SkeletonMetric />
            <SkeletonMetric />
            <SkeletonMetric />
            <SkeletonMetric />
          </>
        ) : (
          <>
            <div className="df-metric">
              <div className="df-metric-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <RefreshCw size={10} />
                Active Subscriptions
              </div>
              <div className="df-metric-value text-num">{data.activeSubscriptions}</div>
              <div className="df-metric-sub">recurring plans active</div>
            </div>

            <div className="df-metric" style={{ borderColor: data.openAlertsCount > 0 ? 'var(--amber-muted)' : 'var(--border)' }}>
              <div className="df-metric-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Activity size={10} />
                Open Deal Alerts
              </div>
              <div
                className="df-metric-value text-num"
                style={{ color: data.openAlertsCount > 0 ? 'var(--amber)' : 'var(--text-primary)' }}
              >
                {data.openAlertsCount}
              </div>
              <div className="df-metric-sub">
                {data.openAlertsCount > 0 ? 'require attention' : 'no active risks'}
              </div>
            </div>

            <div className="df-metric">
              <div className="df-metric-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <DollarSign size={10} />
                Total Invoiced
              </div>
              <div className="df-metric-value text-num">{moneyCents(data.invoiceTotals.total_cents)}</div>
              <div className="df-metric-sub">across all invoices</div>
            </div>

            <div className="df-metric">
              <div className="df-metric-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <DollarSign size={10} />
                Collected
              </div>
              <div
                className="df-metric-value text-num"
                style={{ color: collectionRate >= 80 ? 'var(--green)' : 'var(--text-primary)' }}
              >
                {moneyCents(collected)}
              </div>
              <div className="df-metric-sub">{collectionRate}% collection rate</div>
            </div>
          </>
        )}
      </div>

      {data && data.openAlertsCount > 0 && (
        <div
          style={{
            background: 'var(--amber-light)',
            border: '1px solid var(--amber-muted)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 18px',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          <AlertTriangle size={16} color="var(--amber)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--amber)', marginBottom: 3 }}>
              {data.openAlertsCount} deal alert{data.openAlertsCount !== 1 ? 's' : ''} require attention
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {Object.entries(data.openAlertsByType).map(([type, count]) => (
                <span key={type}>
                  <strong style={{ color: 'var(--amber)' }}>{count}</strong>{' '}
                  {type.replace(/_/g, ' ').toLowerCase()}
                </span>
              ))}
            </div>
          </div>
          <a
            href="/management/deal-health"
            style={{
              marginLeft: 'auto',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--amber)',
              textDecoration: 'none',
              flexShrink: 0,
            }}
          >
            View all
          </a>
        </div>
      )}

      {!data ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[0, 1].map((i) => (
            <div key={i} className="df-card">
              <div className="df-card-header">
                <div className="skeleton" style={{ width: 140, height: 12, borderRadius: 3 }} />
              </div>
              <div className="df-card-body">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[80, 100, 65, 90, 75].map((w, j) => (
                    <div key={j} className="skeleton" style={{ width: w, height: 26, borderRadius: 99 }} />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="df-card">
            <div className="df-card-header">
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                Quotations by Status
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                {data.quotationsByStatus.reduce((s, r) => s + r.count, 0)} total
              </span>
            </div>
            <div className="df-card-body">
              {data.quotationsByStatus.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No quotations yet.</p>
              ) : (
                <div className="df-pill-strip">
                  {data.quotationsByStatus.map((row) => (
                    <span key={row._id} className={`status-badge ${getStatusClass(row._id)}`} style={{ fontSize: 12, padding: '4px 10px' }}>
                      {row._id}
                      <strong style={{ marginLeft: 4 }}>{row.count}</strong>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="df-card">
            <div className="df-card-header">
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                Invoices by Status
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                {data.invoicesByStatus.reduce((s, r) => s + r.count, 0)} total
              </span>
            </div>
            <div className="df-card-body">
              {data.invoicesByStatus.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No invoices yet.</p>
              ) : (
                <div className="df-pill-strip">
                  {data.invoicesByStatus.map((row) => (
                    <span key={row._id} className={`status-badge ${getStatusClass(row._id)}`} style={{ fontSize: 12, padding: '4px 10px' }}>
                      {row._id}
                      <strong style={{ marginLeft: 4 }}>{row.count}</strong>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const isSalesRep = user?.role === 'SALES_REP';
  const isSalesManager = user?.role === 'SALES_MANAGER';
  const isFinance = user?.role === 'FINANCE';

  const page = useMemo(() => {
    if (isSalesRep) return <SalesRepOverview />;
    if (isSalesManager) return <SalesManagerOverview />;
    if (isFinance) return <FinanceOperationsOverview />;
    return <DashboardPageFallback />;
  }, [isSalesRep, isSalesManager, isFinance]);

  return page;
}
