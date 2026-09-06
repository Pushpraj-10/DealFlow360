'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
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

type Customer = { _id: string; name: string; company: string; status?: string };
type ProductVariant = {
  _id: string;
  sku: string;
  name?: string | null;
  extraPrice?: number;
  attributes?: Record<string, string>;
};
type Product = {
  _id: string;
  name: string;
  isStockManaged?: boolean;
  isActive?: boolean;
  status?: string;
  variants?: ProductVariant[];
};
type QuotationDoc = { _id: string };
type QuotationVersion = {
  _id: string;
  versionNumber: number;
  status?: string;
  approvalStatus?: string;
  riskSeverity?: string;
  grandTotal?: number;
  createdAt?: string;
  updatedAt?: string;
};
type QuotationLine = {
  _id: string;
  productId: { name: string } | string;
  variantId?: { sku?: string; name?: string; attributes?: Record<string, string>; extraPrice?: number } | string | null;
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
  currentVersion?: number;
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

const QUOTATION_STATUS_FILTERS = [
  { value: '', label: 'All quotes', statuses: [] },
  { value: 'draft', label: 'Draft', statuses: ['DRAFT', 'RETURNED_FOR_REVISION', 'REAPPROVAL_REQUIRED'] },
  { value: 'approval', label: 'Approval', statuses: ['PENDING_APPROVAL'] },
  { value: 'customer', label: 'Customer / Negotiation', statuses: ['APPROVED', 'READY_FOR_CUSTOMER', 'SENT_TO_CUSTOMER', 'UNDER_NEGOTIATION'] },
  { value: 'confirmed', label: 'Confirmed', statuses: ['CONFIRMED'] },
  { value: 'closed', label: 'Closed', statuses: ['REJECTED', 'EXPIRED', 'CANCELLED'] },
];

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
  const [versions, setVersions] = useState<QuotationVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [lineForm, setLineForm] = useState({ productId: '', variantId: '', quantity: '1', discountPercent: '0' });
  const [showNewForm, setShowNewForm] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<UpsellRecommendation[]>([]);
  const [recommendationsCurrency, setRecommendationsCurrency] = useState('USD');
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [dismissedRecommendationIds, setDismissedRecommendationIds] = useState<Set<string>>(new Set());
  const [acceptingRecommendationId, setAcceptingRecommendationId] = useState<string | null>(null);

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
  }, [canEdit]);

  const loadLines = (id: string) => {
    api
      .get<{ lines: QuotationLine[]; quotation: QuotationDetail }>(`/quotations/${id}`)
      .then((d) => {
        setLines(d.lines);
        setQuotationDetail(d.quotation || null);
      })
      .catch((err) => setError(err instanceof ApiClientError ? err.message : 'Failed to load quotation lines'));
  };

  const loadVersions = (id: string) => {
    setVersionsLoading(true);
    api
      .get<{ versions: QuotationVersion[] }>(`/quotations/${id}/versions`)
      .then((d) => setVersions(d.versions || []))
      .catch(() => setVersions([]))
      .finally(() => setVersionsLoading(false));
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
      setVersions([]);
      setDismissedRecommendationIds(new Set());
      loadLines(quoteId);
      loadVersions(quoteId);
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
      setVersions([]);
      loadLines(data.quotation._id);
      loadVersions(data.quotation._id);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to create quotation');
    }
  };

  const handleAddLine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setError(null);
    try {
      const data = await api.post<{ lines: QuotationLine[]; quotation: QuotationDetail }>(`/quotations/${selectedId}/lines`, {
        productId: lineForm.productId,
        variantId: lineForm.variantId || undefined,
        quantity: Number(lineForm.quantity),
        discountPercent: Number(lineForm.discountPercent),
      });
      setLines(data.lines);
      setQuotationDetail(data.quotation || null);
      loadQuotations();
      loadVersions(selectedId);
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
        quotation: QuotationDetail;
        lines: QuotationLine[];
        marginImpact: { estimatedMarginDelta: number; newMarginPercentage: number };
      }>(`/recommendations/quotations/${selectedId}/upsells`, { productId: recommendation.product.id });
      setLines(data.lines);
      setQuotationDetail(data.quotation || null);
      setInfo(
        `Added ${recommendation.product.name} to the quote - margin ${data.marginImpact.estimatedMarginDelta >= 0 ? '+' : ''}${money(data.marginImpact.estimatedMarginDelta, recommendationsCurrency)}, quote margin now ${data.marginImpact.newMarginPercentage?.toFixed(1)}%.`
      );
      loadQuotations();
      loadVersions(selectedId);
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
      loadVersions(selectedId);
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
      loadVersions(selectedId);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to send quotation to customer');
    }
  };

  const openQuotation = (id: string) => {
    setSelectedId(id);
    setLines([]);
    setQuotationDetail(null);
    setVersions([]);
    setDismissedRecommendationIds(new Set());
    loadLines(id);
    loadVersions(id);
    loadRecommendations(id);
    setInfo(null);
  };

  const filteredQuotations = useMemo(() => {
    const term = search.trim().toLowerCase();
    const activeFilter = QUOTATION_STATUS_FILTERS.find((filter) => filter.value === statusFilter);
    return quotations.filter((quotation) => {
      const matchesStatus = !activeFilter?.statuses.length || activeFilter.statuses.includes(quotation.status);
      const matchesSearch =
        !term ||
        [quotation.quoteNumber, getCustomerName(quotation.customer), quotation.status, quotation.riskSeverity, quotation.approvalStatus]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      return matchesStatus && matchesSearch;
    });
  }, [quotations, search, statusFilter]);

  const selectedQuotation = quotations.find((q) => q.id === selectedId);

  // Calculate summary from lines
  const subtotal = lines.reduce((s, l) => s + (l.lineSubtotal || l.quantity * l.unitPrice), 0);
  const totalDiscount = lines.reduce((s, l) => s + (l.discountAmount || 0), 0);
  const totalTax = lines.reduce((s, l) => s + (l.tax || 0), 0);
  const grandTotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const violationLines = lines.filter((l) => l.is_violation);

  // Use quotation detail for margin and risk if available
  const margin = quotationDetail?.marginPercentage;
  const riskSeverity = quotationDetail?.riskSeverity || selectedQuotation?.riskSeverity;
  const approvalStatus = quotationDetail?.approvalStatus || selectedQuotation?.approvalStatus;
  const selectedVersion = quotationDetail?.currentVersion || selectedQuotation?.currentVersion;

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
  const activeCustomers = customers.filter((customer) => !customer.status || customer.status === 'ACTIVE');
  const activeProducts = products.filter((product) => product.isActive !== false && product.status !== 'ARCHIVED');
  const selectedLineProduct = activeProducts.find((product) => product._id === lineForm.productId) || null;
  const selectedLineProductVariants = selectedLineProduct?.variants?.filter((variant) => variant._id) || [];

  return (
    <div className={`sales-page quotations-page${selectedId ? ' quotations-page--has-selection' : ''}`}>
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
        <div className="sales-create-popover-layer" onClick={() => setShowNewForm(false)}>
          <form
            onSubmit={handleCreate}
            className="sales-create-card sales-create-popover"
            aria-label="Create draft quotation"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sales-create-card__header">
              <div>
                <p className="sales-eyebrow">New draft</p>
                <h2>Create quotation</h2>
                <span>Select the customer first. Products, pricing, discounts, and risk checks are added inside the builder.</span>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm sales-create-card__close"
                onClick={() => setShowNewForm(false)}
                aria-label="Close create quotation"
              >
                <X size={14} />
              </button>
            </div>
            <label className="form-field">
              <span className="form-label">Customer</span>
              <select
                value={newCustomerId}
                onChange={(e) => setNewCustomerId(e.target.value)}
                required
                className="df-select"
              >
                <option value="">Choose customer...</option>
                {activeCustomers.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.company || c.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="sales-create-card__actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowNewForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Create Draft</button>
            </div>
          </form>
        </div>
      )}

      <section className="sales-table-section">
        <div className="sales-table-toolbar">
          <div className="sales-filter-control">
            <Search size={15} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search quotes or customers" />
          </div>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="df-select">
            {QUOTATION_STATUS_FILTERS.map((filter) => (
              <option key={filter.value || 'all'} value={filter.value}>{filter.label}</option>
            ))}
          </select>
        </div>

        <div className="sales-quote-table-wrap">
          <table className="df-table sales-quote-table">
            <thead>
              <tr>
                <th>Quote</th>
                <th>Version</th>
                <th>Customer</th>
                <th className="num">Amount</th>
                <th>Status</th>
                <th>Risk</th>
                <th>Approval</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {loading && <TableSkeletonRows columns={8} />}
              {!loading && filteredQuotations.map((quotation) => (
                <tr
                  key={quotation.id}
                  className={selectedId === quotation.id ? 'selected' : ''}
                  onClick={() => openQuotation(quotation.id)}
                >
                  <td>
                    <span className="sales-quote-id">{quotation.quoteNumber}</span>
                  </td>
                  <td>
                    <span className="version-pill">v{quotation.currentVersion || 1}</span>
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
                  <td colSpan={8}>
                    <div className="sales-empty-line">No quotations match the current filters.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedId && (
      <div
        className="quotation-builder-popover-layer"
        onClick={() => {
          setSelectedId(null);
          setLines([]);
          setQuotationDetail(null);
          setVersions([]);
          setInfo(null);
        }}
      >
      <section
        className="quotation-builder-section quotation-builder-popover"
        role="dialog"
        aria-modal="true"
        aria-label="Quotation builder"
        onClick={(event) => event.stopPropagation()}
      >
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
                    <span className="version-pill version-pill--strong">
                      Version {selectedVersion || 1}
                    </span>
                    <span className={`status-badge ${getStatusClass(selectedQuotation.status)}`}>
                      {formatStatus(selectedQuotation.status)}
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setSelectedId(null);
                        setLines([]);
                        setQuotationDetail(null);
                        setVersions([]);
                        setInfo(null);
                      }}
                    >
                      Back to list
                    </button>
                  </div>
                </div>
              )}

              <div className="quotation-version-panel">
                <div className="quotation-version-panel__header">
                  <div>
                    <h3 className="quotation-section-title">Version history</h3>
                    <p>Material customer changes create a new quotation version and keep older submitted terms viewable.</p>
                  </div>
                </div>
                {versionsLoading ? (
                  <div className="skeleton" style={{ height: 52 }} />
                ) : versions.length === 0 ? (
                  <div className="quotation-empty-lines">
                    <p>No submitted versions yet. Draft changes will appear here after submission or negotiation updates.</p>
                  </div>
                ) : (
                  <div className="quotation-version-list">
                    {versions.map((version) => (
                      <div
                        key={version._id}
                        className={`quotation-version-item${version.versionNumber === selectedVersion ? ' is-current' : ''}`}
                      >
                        <div>
                          <strong>Version {version.versionNumber}</strong>
                          <span>{timeAgo(version.updatedAt || version.createdAt)}</span>
                        </div>
                        <span className={`status-badge ${getStatusClass(version.status)}`}>
                          {formatStatus(version.status)}
                        </span>
                        <span>{formatStatus(version.approvalStatus || 'Not required')}</span>
                        <span className="sales-risk-inline">
                          <span className={`risk-dot ${getRiskClass(version.riskSeverity)}`} />
                          {version.riskSeverity || 'None'}
                        </span>
                        <strong className="text-num">{money(version.grandTotal)}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>

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
                      const variantLabel = typeof line.variantId === 'object' && line.variantId
                        ? [line.variantId.name, line.variantId.sku].filter(Boolean).join(' · ')
                        : typeof line.variantId === 'string'
                          ? line.variantId
                          : null;
                      const allowedDiscount = line.allowed_discount ?? line.allowedDiscountPercent ?? 0;
                      const excessDiscount = line.excess_discount ?? 0;

                      return (
                        <div key={line._id} className={`quotation-line-item ${line.is_violation ? 'has-violation' : ''}`}>
                          <div className="quotation-line-main">
                            <div className="quotation-line-product">
                              <span className="product-name">{productName}</span>
                              <div className="quotation-line-details">
                                {variantLabel && <span>{variantLabel}</span>}
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
                          onChange={(e) => setLineForm({ ...lineForm, productId: e.target.value, variantId: '' })}
                          required
                          className="df-select"
                        >
                          <option value="">Select product...</option>
                          {activeProducts.map((p) => (
                            <option key={p._id} value={p._id}>
                              {p.name}{p.variants?.length ? ` (${p.variants.length} variants)` : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="form-field">
                        <span className="form-label">Variant / SKU</span>
                        <select
                          value={lineForm.variantId}
                          onChange={(e) => setLineForm({ ...lineForm, variantId: e.target.value })}
                          required={!!selectedLineProduct?.isStockManaged && selectedLineProductVariants.length > 0}
                          disabled={!selectedLineProduct || selectedLineProductVariants.length === 0}
                          className="df-select"
                        >
                          <option value="">
                            {selectedLineProductVariants.length ? 'Select variant...' : 'No variants'}
                          </option>
                          {selectedLineProductVariants.map((variant) => (
                            <option key={variant._id} value={variant._id}>
                              {[variant.name, variant.sku].filter(Boolean).join(' · ') || variant.sku}
                              {variant.extraPrice ? ` (+${money(variant.extraPrice)})` : ''}
                            </option>
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
      </section>
      </div>
      )}

    </div>
  );
}
