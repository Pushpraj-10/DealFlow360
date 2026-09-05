'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Plus,
  Search,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  formatStatus,
  getActivityTime,
  getCustomerName,
  getRiskClass,
  getStatusClass,
  money,
  normalizeQuotationCard,
  timeAgo,
  type QuotationListItem,
} from '@/lib/salesRep';
import { TableSkeletonRows } from '@/components/ui/primitives';

type Customer = { _id: string; name: string; company: string };
type Product = { _id: string; name: string };
type QuotationDoc = { _id: string };
type QuotationLine = {
  _id: string;
  productId: { name: string } | string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  lineTotal: number;
  allowed_discount?: number;
  allowedDiscountPercent?: number;
  actual_discount?: number;
  excess_discount?: number;
  is_violation: boolean;
  lineSubtotal?: number;
  discountAmount?: number;
  tax?: number;
  taxPercentage?: number;
  marginPercentage?: number;
};

type QuotationDetail = {
  subtotal?: number;
  totalDiscount?: number;
  totalTax?: number;
  grandTotal?: number;
  riskScore?: number;
  riskSeverity?: string;
  approvalStatus?: string;
  marginPercentage?: number;
};

type UpsellRecommendation = {
  product: { id: string; name: string; productType?: string; billingType?: string; unit?: string };
  coPurchaseScore: number;
  promotionBoost: number;
  rankScore: number;
  expectedRevenue: number;
  estimatedMarginDelta: number;
  estimatedMarginPercent: number;
};

type OrderSnapshotSubscription = {
  id: string;
  status: string;
  qty: number;
  recurringUnitPriceCents: number;
  nextBillDate: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  plan: { id: string; name: string; cycle: string } | null;
};

type OrderSnapshotLine = {
  quotationLineId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  type: 'ONE_TIME' | 'RECURRING';
  subscription: OrderSnapshotSubscription | null;
};

type OrderSnapshot = {
  quotationId: string;
  currency: string;
  lines: OrderSnapshotLine[];
};

export default function QuotationsPage() {
  const { user } = useAuth();
  // Mirrors the backend's requireRoles() guards on /quotations (quotations.routes.js):
  // only Sales Rep and Admin may create drafts, add lines, submit, or send.
  const canEdit = user?.role === 'SALES_REP' || user?.role === 'ADMIN';
  const [quotations, setQuotations] = useState<QuotationListItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [newCustomerId, setNewCustomerId] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lines, setLines] = useState<QuotationLine[]>([]);
  const [quotationDetail, setQuotationDetail] = useState<QuotationDetail | null>(null);
  const [lineForm, setLineForm] = useState({ productId: '', quantity: '1', discountPercent: '0' });
  const [showNewForm, setShowNewForm] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<UpsellRecommendation[]>([]);
  const [recommendationsCurrency, setRecommendationsCurrency] = useState('USD');
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [dismissedRecommendationIds, setDismissedRecommendationIds] = useState<Set<string>>(new Set());
  const [acceptingRecommendationId, setAcceptingRecommendationId] = useState<string | null>(null);
  const [orderSnapshot, setOrderSnapshot] = useState<OrderSnapshot | null>(null);
  const [orderSnapshotLoading, setOrderSnapshotLoading] = useState(false);
  const [modifyTarget, setModifyTarget] = useState<OrderSnapshotSubscription | null>(null);
  const [modifyQty, setModifyQty] = useState(1);
  const [modifyProrationPreview, setModifyProrationPreview] = useState<number | null>(null);
  const [subscriptionActionId, setSubscriptionActionId] = useState<string | null>(null);

  const loadQuotations = () => {
    api
      .get<{ quotations: QuotationListItem[] }>('/quotations')
      .then((d) => setQuotations(d.quotations.map(normalizeQuotationCard)))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : 'Failed to load quotations'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadQuotations();
    if (canEdit) {
      api.get<{ customers: Customer[] }>('/customers').then((d) => setCustomers(d.customers)).catch(() => {});
    }
    api.get<{ products: Product[] }>('/products').then((d) => setProducts(d.products)).catch(() => {});
  }, []);

  const loadLines = (id: string) => {
    api
      .get<{ lines: QuotationLine[]; quotation: any }>(`/quotations/${id}`)
      .then((d) => {
        setLines(d.lines);
        setQuotationDetail(d.quotation || null);
      })
      .catch((err) => setError(err instanceof ApiClientError ? err.message : 'Failed to load quotation lines'));
  };

  const loadRecommendations = (id: string) => {
    setRecommendationsLoading(true);
    api
      .get<{ recommendations: UpsellRecommendation[]; currencyCode?: string }>(`/recommendations/quotations/${id}/upsells`)
      .then((d) => {
        setRecommendations(d.recommendations || []);
        setRecommendationsCurrency(d.currencyCode || 'USD');
      })
      .catch(() => setRecommendations([]))
      .finally(() => setRecommendationsLoading(false));
  };

  useEffect(() => {
    queueMicrotask(() => {
      const quoteId = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('quote');
      if (!quoteId || selectedId === quoteId) return;
      setSelectedId(quoteId);
      setLines([]);
      setQuotationDetail(null);
      setDismissedRecommendationIds(new Set());
      loadLines(quoteId);
      loadRecommendations(quoteId);
    });
  }, [selectedId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const data = await api.post<{ quotation: QuotationDoc }>('/quotations', { customerId: newCustomerId });
      setNewCustomerId('');
      setShowNewForm(false);
      loadQuotations();
      setSelectedId(data.quotation._id);
      setLines([]);
      setQuotationDetail(null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to create quotation');
    }
  };

  const handleAddLine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setError(null);
    try {
      const data = await api.post<{ lines: QuotationLine[]; quotation: any }>(`/quotations/${selectedId}/lines`, {
        productId: lineForm.productId,
        quantity: Number(lineForm.quantity),
        discountPercent: Number(lineForm.discountPercent),
      });
      setLines(data.lines);
      setQuotationDetail(data.quotation || null);
      loadQuotations();
      loadRecommendations(selectedId);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to add line');
    }
  };

  const acceptRecommendation = async (recommendation: UpsellRecommendation) => {
    if (!selectedId) return;
    setError(null);
    setInfo(null);
    setAcceptingRecommendationId(recommendation.product.id);
    try {
      const data = await api.post<{
        quotation: any;
        lines: QuotationLine[];
        marginImpact: { estimatedMarginDelta: number; newMarginPercentage: number };
      }>(`/recommendations/quotations/${selectedId}/upsells`, { productId: recommendation.product.id });
      setLines(data.lines);
      setQuotationDetail(data.quotation || null);
      setInfo(
        `Added ${recommendation.product.name} to the quote - margin ${data.marginImpact.estimatedMarginDelta >= 0 ? '+' : ''}${money(data.marginImpact.estimatedMarginDelta, recommendationsCurrency)}, quote margin now ${data.marginImpact.newMarginPercentage?.toFixed(1)}%.`
      );
      loadQuotations();
      loadRecommendations(selectedId);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to add recommendation to quote');
    } finally {
      setAcceptingRecommendationId(null);
    }
  };

  const dismissRecommendation = (productId: string) => {
    setDismissedRecommendationIds((prev) => new Set(prev).add(productId));
  };

  const handleSubmit = async () => {
    if (!selectedId) return;
    setError(null);
    setInfo(null);
    try {
      const data = await api.post<{ approval: { approvalRequired: boolean } }>(
        `/quotations/${selectedId}/submit`
      );
      setInfo(
        data.approval.approvalRequired
          ? 'Submitted - routed for approval based on blended discount risk.'
          : 'Submitted - no approval required, ready for the customer.'
      );
      loadQuotations();
      loadLines(selectedId);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to submit quotation');
    }
  };

  const handleSend = async () => {
    if (!selectedId) return;
    setError(null);
    setInfo(null);
    try {
      await api.post(`/quotations/${selectedId}/send`);
      setInfo('Sent to customer - they can now review and confirm it from their portal.');
      loadQuotations();
      loadLines(selectedId);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to send quotation to customer');
    }
  };

  const filteredQuotations = useMemo(() => {
    const term = search.trim().toLowerCase();
    return quotations.filter((quotation) => {
      const matchesStatus = !statusFilter || quotation.status === statusFilter;
      const matchesSearch =
        !term ||
        [quotation.quoteNumber, getCustomerName(quotation.customer), quotation.status, quotation.riskSeverity, quotation.approvalStatus]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      return matchesStatus && matchesSearch;
    });
  }, [quotations, search, statusFilter]);

  const statuses = Array.from(new Set(quotations.map((quotation) => quotation.status))).filter(Boolean);
  const selectedQuotation = quotations.find((q) => q.id === selectedId);

  // PRD B7: confirmed orders show one-time and recurring lines together with
  // a billing schedule, so fetch the order snapshot once a quote is confirmed.
  useEffect(() => {
    if (!selectedId || selectedQuotation?.status !== 'CONFIRMED') {
      setOrderSnapshot(null);
      return;
    }
    setOrderSnapshotLoading(true);
    api
      .get<{ snapshot: OrderSnapshot }>(`/quotations/${selectedId}/order-snapshot`)
      .then((d) => setOrderSnapshot(d.snapshot))
      .catch(() => setOrderSnapshot(null))
      .finally(() => setOrderSnapshotLoading(false));
  }, [selectedId, selectedQuotation?.status]);

  const cancelOrderSubscription = async (subscriptionId: string) => {
    setError(null);
    setInfo(null);
    setSubscriptionActionId(subscriptionId);
    try {
      await api.post(`/subscriptions/${subscriptionId}/cancel`, { reason: 'Cancelled from order view' });
      setInfo('Subscription cancelled. A prorated credit note is issued automatically if applicable.');
      if (selectedId) {
        api
          .get<{ snapshot: OrderSnapshot }>(`/quotations/${selectedId}/order-snapshot`)
          .then((d) => setOrderSnapshot(d.snapshot))
          .catch(() => {});
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to cancel subscription');
    } finally {
      setSubscriptionActionId(null);
    }
  };

  const openModify = (subscription: OrderSnapshotSubscription) => {
    setModifyTarget(subscription);
    setModifyQty(subscription.qty);
    setModifyProrationPreview(null);
  };

  useEffect(() => {
    if (!modifyTarget) return;
    api
      .get<{ proratedDeltaCents: number }>(`/billing/prorate?subscriptionId=${modifyTarget.id}&newQty=${modifyQty}`)
      .then((d) => setModifyProrationPreview(d.proratedDeltaCents))
      .catch(() => setModifyProrationPreview(null));
  }, [modifyTarget, modifyQty]);

  const confirmModifySubscription = async () => {
    if (!modifyTarget) return;
    setSubscriptionActionId(modifyTarget.id);
    try {
      await api.post(`/subscriptions/${modifyTarget.id}/modify`, { newQty: modifyQty });
      setModifyTarget(null);
      setInfo('Subscription modified. A prorated credit note is issued automatically if applicable.');
      if (selectedId) {
        api
          .get<{ snapshot: OrderSnapshot }>(`/quotations/${selectedId}/order-snapshot`)
          .then((d) => setOrderSnapshot(d.snapshot))
          .catch(() => {});
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to modify subscription');
    } finally {
      setSubscriptionActionId(null);
    }
  };

  const oneTimeOrderLines = orderSnapshot?.lines.filter((line) => line.type === 'ONE_TIME') || [];
  const recurringOrderLines = orderSnapshot?.lines.filter((line) => line.type === 'RECURRING') || [];
  const productNameByLineId = new Map(
    lines.map((line) => [line._id, typeof line.productId === 'object' ? line.productId.name : 'Product'])
  );

  // Calculate summary from lines
  const subtotal = lines.reduce((s, l) => s + (l.lineSubtotal || l.quantity * l.unitPrice), 0);
  const totalDiscount = lines.reduce((s, l) => s + (l.discountAmount || 0), 0);
  const totalTax = lines.reduce((s, l) => s + (l.tax || 0), 0);
  const grandTotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const hasViolations = lines.some((l) => l.is_violation);
  const violationLines = lines.filter((l) => l.is_violation);

  // Use quotation detail for margin and risk if available
  const margin = quotationDetail?.marginPercentage;
  const riskSeverity = quotationDetail?.riskSeverity || selectedQuotation?.riskSeverity;
  const approvalStatus = quotationDetail?.approvalStatus || selectedQuotation?.approvalStatus;

  // Mirrors the backend's own state-transition guards (quotations.controller.js):
  // submit only from DRAFT/RETURNED_FOR_REVISION/REAPPROVAL_REQUIRED, send only
  // from APPROVED/READY_FOR_CUSTOMER, and lines can't be edited once terminal.
  const canSubmit = canEdit && selectedQuotation
    ? ['DRAFT', 'RETURNED_FOR_REVISION', 'REAPPROVAL_REQUIRED'].includes(selectedQuotation.status)
    : false;
  const canSend = canEdit && selectedQuotation
    ? ['APPROVED', 'READY_FOR_CUSTOMER'].includes(selectedQuotation.status)
    : false;
  const canEditLines = canEdit && selectedQuotation
    ? !['REJECTED', 'CONFIRMED', 'EXPIRED', 'CANCELLED'].includes(selectedQuotation.status)
    : false;

  const visibleRecommendations = recommendations.filter(
    (recommendation) => !dismissedRecommendationIds.has(recommendation.product.id)
  );

  return (
    <div className="sales-page quotations-page">
      <div className="sales-page-heading quotations-page__header">
        <div>
          <p className="sales-eyebrow">Quotations</p>
          <h1>Commercial workbench</h1>
          <p>Create drafts, review terms, and submit quotes without leaving the sales flow.</p>
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={() => setShowNewForm(!showNewForm)}>
            <Plus size={14} />
            New quotation
          </button>
        )}
      </div>

      {error && (
        <div className="df-alert df-alert-error">
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}
      {info && (
        <div className="df-alert df-alert-success">
          <CheckCircle size={14} style={{ flexShrink: 0 }} />
          <span>{info}</span>
        </div>
      )}

      {showNewForm && canEdit && (
        <form onSubmit={handleCreate} className="sales-inline-form">
          <label>
            <span>Customer</span>
            <select
              value={newCustomerId}
              onChange={(e) => setNewCustomerId(e.target.value)}
              required
              className="df-select"
            >
              <option value="">Choose customer...</option>
              {customers.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.company || c.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn btn-primary">Create Draft</button>
          <button type="button" className="btn btn-ghost" onClick={() => setShowNewForm(false)}>Cancel</button>
        </form>
      )}

      <section className="sales-table-section">
        <div className="sales-table-toolbar">
          <div className="sales-filter-control">
            <Search size={15} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search quotes or customers" />
          </div>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="df-select">
            <option value="">All statuses</option>
            {statuses.map((status) => (
              <option key={status} value={status}>{formatStatus(status)}</option>
            ))}
          </select>
        </div>

        <div className="sales-quote-table-wrap">
          <table className="df-table sales-quote-table">
            <thead>
              <tr>
                <th>Quote</th>
                <th>Customer</th>
                <th className="num">Amount</th>
                <th>Status</th>
                <th>Risk</th>
                <th>Approval</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {loading && <TableSkeletonRows columns={7} />}
              {!loading && filteredQuotations.map((quotation) => (
                <tr
                  key={quotation.id}
                  className={selectedId === quotation.id ? 'selected' : ''}
                  onClick={() => {
                    setSelectedId(quotation.id);
                    setLines([]);
                    setQuotationDetail(null);
                    setDismissedRecommendationIds(new Set());
                    loadLines(quotation.id);
                    loadRecommendations(quotation.id);
                    setInfo(null);
                  }}
                >
                  <td>
                    <span className="sales-quote-id">{quotation.quoteNumber}</span>
                  </td>
                  <td>{getCustomerName(quotation.customer)}</td>
                  <td className="num">{money(quotation.total)}</td>
                  <td><span className={`status-badge ${getStatusClass(quotation.status)}`}>{formatStatus(quotation.status)}</span></td>
                  <td>
                    <span className="sales-risk-inline">
                      <span className={`risk-dot ${getRiskClass(quotation.riskSeverity)}`} />
                      {quotation.riskSeverity || 'None'}
                    </span>
                  </td>
                  <td>{formatStatus(quotation.approvalStatus || 'Not required')}</td>
                  <td>{timeAgo(getActivityTime(quotation))}</td>
                </tr>
              ))}
              {!loading && filteredQuotations.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="sales-empty-line">No quotations match the current filters.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="quotation-builder-section">
        {!selectedId ? (
          <div className="sales-empty-state">
            <ChevronRight size={30} />
            <strong>Select a quotation</strong>
            <span>Choose a quote from the table or create a new draft.</span>
          </div>
        ) : (
          <div className="quotation-builder-layout">
            {/* Main Content - 70% */}
            <div className="quotation-main-content">
              {/* Header */}
              {selectedQuotation && (
                <div className="quotation-detail-header">
                  <div className="quotation-detail-title">
                    <span className="quotation-number">{selectedQuotation.quoteNumber}</span>
                    <h2 className="quotation-customer">{getCustomerName(selectedQuotation.customer)}</h2>
                  </div>
                  <div className="quotation-detail-meta">
                    <span className={`status-badge ${getStatusClass(selectedQuotation.status)}`}>
                      {formatStatus(selectedQuotation.status)}
                    </span>
                  </div>
                </div>
              )}

              {/* Product Lines */}
              <div className="quotation-lines-section">
                <h3 className="quotation-section-title">Line items</h3>

                {lines.length === 0 ? (
                  <div className="quotation-empty-lines">
                    <p>No line items yet. Add products below to get started.</p>
                  </div>
                ) : (
                  <div className="quotation-lines-list">
                    {lines.map((line) => {
                      const productName = typeof line.productId === 'object' ? line.productId.name : line.productId;
                      const allowedDiscount = line.allowed_discount ?? line.allowedDiscountPercent ?? 0;
                      const excessDiscount = line.excess_discount ?? 0;

                      return (
                        <div key={line._id} className={`quotation-line-item ${line.is_violation ? 'has-violation' : ''}`}>
                          <div className="quotation-line-main">
                            <div className="quotation-line-product">
                              <span className="product-name">{productName}</span>
                              <div className="quotation-line-details">
                                <span>{line.quantity} × {money(line.unitPrice)}</span>
                                {line.discountPercent > 0 && (
                                  <span className="line-discount">Discount {line.discountPercent}%</span>
                                )}
                                {!line.is_violation && allowedDiscount > 0 && (
                                  <span className="line-policy">Policy limit {allowedDiscount}%</span>
                                )}
                              </div>
                            </div>
                            <div className="quotation-line-amount">
                              {money(line.lineTotal)}
                            </div>
                          </div>

                          {line.is_violation && (
                            <div className="quotation-line-violation">
                              <AlertTriangle size={13} />
                              <span>
                                {line.discountPercent}% discount · policy limit {allowedDiscount}%
                              </span>
                              <span className="violation-excess">
                                {Math.abs(excessDiscount).toFixed(1)}% above policy
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Order & Billing (PRD B7): one-time and recurring lines shown
                  together for a confirmed order, with billing schedule and
                  cancel/modify controls for recurring lines. */}
              {selectedQuotation?.status === 'CONFIRMED' && (
                <div className="quotation-billing-section">
                  <h3 className="quotation-section-title">Order &amp; billing</h3>

                  {orderSnapshotLoading ? (
                    <div className="skeleton" style={{ height: 80 }} />
                  ) : !orderSnapshot ? (
                    <div className="quotation-empty-lines">
                      <p>Order and billing details were not returned for this order.</p>
                    </div>
                  ) : (
                    <div className="quotation-billing-groups">
                      <div className="quotation-billing-group">
                        <h4>One-time</h4>
                        {oneTimeOrderLines.length === 0 ? (
                          <p className="sales-empty-line">No one-time lines on this order.</p>
                        ) : (
                          <ul className="quotation-billing-list">
                            {oneTimeOrderLines.map((line) => (
                              <li key={line.quotationLineId}>
                                <span>{productNameByLineId.get(line.quotationLineId) || 'Product'}</span>
                                <span>{line.quantity} x {money(line.unitPrice)}</span>
                                <strong>{money(line.lineTotal)}</strong>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className="quotation-billing-group">
                        <h4>Recurring</h4>
                        {recurringOrderLines.length === 0 ? (
                          <p className="sales-empty-line">No recurring lines on this order.</p>
                        ) : (
                          <ul className="quotation-billing-list quotation-billing-list-recurring">
                            {recurringOrderLines.map((line) => (
                              <li key={line.quotationLineId}>
                                <div className="quotation-billing-recurring-main">
                                  <span>{productNameByLineId.get(line.quotationLineId) || 'Product'}</span>
                                  <span>{line.quantity} x {money(line.unitPrice)}</span>
                                  <strong>{money(line.lineTotal)}</strong>
                                </div>
                                {line.subscription && (
                                  <div className="quotation-billing-schedule">
                                    <span className={`status-badge ${line.subscription.status === 'ACTIVE' ? 'status-active' : 'status-draft'}`}>
                                      {line.subscription.status}
                                    </span>
                                    <span>{line.subscription.plan?.name || 'Plan'} ({line.subscription.plan?.cycle || 'cycle'})</span>
                                    {line.subscription.status === 'ACTIVE' && (
                                      <span>Next bill {new Date(line.subscription.nextBillDate).toLocaleDateString()}</span>
                                    )}
                                    {line.subscription.status === 'ACTIVE' && (
                                      <div className="quotation-billing-actions">
                                        <button
                                          type="button"
                                          className="btn btn-ghost btn-sm"
                                          disabled={subscriptionActionId === line.subscription.id}
                                          onClick={() => openModify(line.subscription!)}
                                        >
                                          Modify
                                        </button>
                                        <button
                                          type="button"
                                          className="btn btn-danger btn-sm"
                                          disabled={subscriptionActionId === line.subscription.id}
                                          onClick={() => cancelOrderSubscription(line.subscription!.id)}
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Add Line Form */}
              {canEditLines && (
                <div className="quotation-add-line-section">
                  <h3 className="quotation-section-title">Add line item</h3>
                  <form onSubmit={handleAddLine} className="quotation-add-line-form">
                    <div className="form-grid">
                      <label className="form-field">
                        <span className="form-label">Product</span>
                        <select
                          value={lineForm.productId}
                          onChange={(e) => setLineForm({ ...lineForm, productId: e.target.value })}
                          required
                          className="df-select"
                        >
                          <option value="">Select product...</option>
                          {products.map((p) => (
                            <option key={p._id} value={p._id}>{p.name}</option>
                          ))}
                        </select>
                      </label>
                      <label className="form-field">
                        <span className="form-label">Quantity</span>
                        <input
                          type="number"
                          value={lineForm.quantity}
                          onChange={(e) => setLineForm({ ...lineForm, quantity: e.target.value })}
                          className="df-input"
                          min="1"
                        />
                      </label>
                      <label className="form-field">
                        <span className="form-label">Discount %</span>
                        <input
                          type="number"
                          value={lineForm.discountPercent}
                          onChange={(e) => setLineForm({ ...lineForm, discountPercent: e.target.value })}
                          className="df-input"
                          min="0"
                          max="100"
                        />
                      </label>
                    </div>
                    <button type="submit" className="btn btn-secondary">
                      <Plus size={14} />
                      Add line
                    </button>
                  </form>
                </div>
              )}

              {/* Upsell / Cross-sell Panel */}
              {canEditLines && (
                <div className="quotation-upsell-section">
                  <h3 className="quotation-section-title">
                    <Sparkles size={15} />
                    Recommended for this quote
                  </h3>

                  {recommendationsLoading ? (
                    <div className="quotation-upsell-list">
                      {[0, 1].map((i) => (
                        <div key={i} className="skeleton" style={{ height: 64, marginBottom: 8 }} />
                      ))}
                    </div>
                  ) : visibleRecommendations.length === 0 ? (
                    <div className="quotation-empty-lines">
                      <p>No upsell or cross-sell suggestions for the products on this quote yet.</p>
                    </div>
                  ) : (
                    <div className="quotation-upsell-list">
                      {visibleRecommendations.map((recommendation) => (
                        <div key={recommendation.product.id} className="quotation-upsell-item">
                          <div className="quotation-upsell-main">
                            <div className="quotation-upsell-name">
                              <span className="product-name">{recommendation.product.name}</span>
                              {recommendation.promotionBoost > 0 && (
                                <span className="quotation-upsell-promo-tag">Promoted</span>
                              )}
                            </div>
                            <div className={`quotation-upsell-margin ${recommendation.estimatedMarginDelta < 0 ? 'negative' : ''}`}>
                              <TrendingUp size={13} />
                              <span>
                                {recommendation.estimatedMarginDelta >= 0 ? '+' : ''}
                                {money(recommendation.estimatedMarginDelta, recommendationsCurrency)} margin
                              </span>
                              <span className="quotation-upsell-margin-percent">
                                ({recommendation.estimatedMarginPercent.toFixed(1)}% margin)
                              </span>
                            </div>
                          </div>
                          <div className="quotation-upsell-actions">
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              disabled={acceptingRecommendationId === recommendation.product.id}
                              onClick={() => acceptRecommendation(recommendation)}
                            >
                              <Plus size={13} />
                              Add to Quote
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => dismissRecommendation(recommendation.product.id)}
                            >
                              <X size={13} />
                              Dismiss
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Commercial Summary - 30% Sticky */}
            <div className="quotation-summary-sidebar">
              <div className="quotation-summary-sticky">
                <h3 className="quotation-summary-title">Commercial summary</h3>

                <div className="quotation-summary-section">
                  <div className="summary-line">
                    <span>Subtotal</span>
                    <span>{money(subtotal)}</span>
                  </div>
                  {totalDiscount > 0 && (
                    <div className="summary-line">
                      <span>Discount</span>
                      <span className="negative">-{money(totalDiscount)}</span>
                    </div>
                  )}
                  {totalTax > 0 && (
                    <div className="summary-line">
                      <span>Tax</span>
                      <span>{money(totalTax)}</span>
                    </div>
                  )}
                </div>

                <div className="summary-total">
                  <span>Total</span>
                  <strong>{money(grandTotal)}</strong>
                </div>

                {margin !== undefined && margin !== null && (
                  <div className="quotation-summary-section">
                    <div className="summary-line">
                      <span>Margin</span>
                      <span className="margin-value">{margin.toFixed(1)}%</span>
                    </div>
                  </div>
                )}

                {riskSeverity && riskSeverity !== 'NONE' && (
                  <div className="quotation-summary-section">
                    <div className="summary-risk-header">
                      <span>Risk</span>
                    </div>
                    <div className={`summary-risk-badge risk-${riskSeverity.toLowerCase()}`}>
                      {riskSeverity}
                    </div>
                    {violationLines.length > 0 && (
                      <div className="summary-risk-details">
                        {violationLines.map((line) => {
                          const productName = typeof line.productId === 'object' ? line.productId.name : 'Product';
                          const allowedDiscount = line.allowed_discount ?? line.allowedDiscountPercent ?? 0;
                          const excessDiscount = line.excess_discount ?? 0;
                          return (
                            <div key={line._id} className="risk-item">
                              <AlertTriangle size={12} />
                              <span>{productName} discount exceeds policy by {Math.abs(excessDiscount).toFixed(1)}%</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {approvalStatus && approvalStatus !== 'NOT_REQUIRED' && (
                  <div className="quotation-summary-section">
                    <div className="summary-approval-header">
                      <span>Approval</span>
                    </div>
                    <div className="summary-approval-status">
                      {formatStatus(approvalStatus)}
                    </div>
                  </div>
                )}

                {(canSubmit || canSend) && (
                  <div className="quotation-summary-actions">
                    {canSubmit && (
                      <button onClick={handleSubmit} className="btn btn-primary btn-full">
                        Submit for Approval
                      </button>
                    )}
                    {canSend && (
                      <button onClick={handleSend} className="btn btn-primary btn-full">
                        Send to Customer
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {modifyTarget && (
        <div className="df-modal-overlay" onClick={() => setModifyTarget(null)}>
          <div className="df-modal" onClick={(e) => e.stopPropagation()}>
            <div className="df-modal-header ops-modal-header">
              <div>
                <h2 className="df-modal-title">Modify subscription</h2>
                <p>{modifyTarget.plan?.name || 'Plan'}</p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setModifyTarget(null)}>
                <X size={14} />
              </button>
            </div>
            <div className="df-modal-body">
              <div className="df-field">
                <label className="df-label">New quantity</label>
                <input
                  type="number"
                  min={1}
                  value={modifyQty}
                  onChange={(e) => setModifyQty(parseInt(e.target.value, 10) || 1)}
                  className="df-input"
                />
              </div>
              <div className="ops-proration-box">
                <span>Prorated {(modifyProrationPreview ?? 0) >= 0 ? 'charge' : 'credit'}</span>
                <strong>{modifyProrationPreview !== null ? money(Math.abs(modifyProrationPreview) / 100) : 'Not returned'}</strong>
              </div>
            </div>
            <div className="df-modal-footer">
              <button onClick={() => setModifyTarget(null)} className="btn btn-ghost">Close</button>
              <button onClick={confirmModifySubscription} className="btn btn-primary" disabled={subscriptionActionId === modifyTarget.id}>
                Confirm changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
