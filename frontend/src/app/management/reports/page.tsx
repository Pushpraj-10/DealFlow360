'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import { AlertCircle, Download, BarChart2, FileText } from 'lucide-react';

type ReportRow = { quote_no: string; status: string; line_count: number; gross_cents: number; net_cents: number; effective_discount_pct: number };
type Pagination = { page: number; limit: number; total: number; totalPages: number };
type ReportSummary = { totalQuotations: number; totalNetCents: number; avgDiscountPct: number };
type Report = { rows: ReportRow[]; summary: ReportSummary; pagination: Pagination };
type SalesRep = { id: string; fullName: string; email: string; team: string | null };
type ReportFilterOptions = { reps: SalesRep[]; teams: string[]; approvalStatuses: string[] };
type Product = { _id: string; name: string };
type Category = { _id: string; name: string };

const PAGE_LIMIT = 20;
const SKELETON_ROWS = 3;

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatStatus(status: string) {
  return status.replace(/_/g, ' ');
}

function getStatusClass(status: string): string {
  const s = status?.toLowerCase() ?? '';
  if (s === 'draft') return 'status-draft';
  if (s.includes('pending')) return 'status-pending';
  if (s === 'approved') return 'status-approved';
  if (s === 'rejected') return 'status-rejected';
  if (s === 'confirmed') return 'status-confirmed';
  return 'status-draft';
}

export default function ReportsPage() {
  const [period, setPeriod] = useState('all');
  const [repId, setRepId] = useState('');
  const [team, setTeam] = useState('');
  const [approvalStatus, setApprovalStatus] = useState('');
  const [productId, setProductId] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const [filterOptions, setFilterOptions] = useState<ReportFilterOptions | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [rows, setRows] = useState<ReportRow[]>([]);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    api.get<ReportFilterOptions>('/reports/sales/filters').then(setFilterOptions).catch(() => {});
    api.get<{ products: Product[] }>('/products').then((d) => setProducts(d.products)).catch(() => {});
    api.get<{ categories: Category[] }>('/categories').then((d) => setCategories(d.categories)).catch(() => {});
  }, []);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ period });
    if (repId) params.set('repId', repId);
    if (team) params.set('team', team);
    if (approvalStatus) params.set('approvalStatus', approvalStatus);
    if (productId) params.set('product', productId);
    if (categoryId) params.set('category', categoryId);
    return params.toString();
  }, [period, repId, team, approvalStatus, productId, categoryId]);

  // Any filter change invalidates what's loaded so far - drop back to a
  // fresh page 1 and clear the accumulated rows rather than appending onto
  // a now-stale scroll session.
  useEffect(() => {
    setPage(1);
    setRows([]);
    setPagination(null);
    setInitialLoading(true);
  }, [queryString]);

  const pagedQueryString = useMemo(() => {
    const params = new URLSearchParams(queryString);
    params.set('page', String(page));
    params.set('limit', String(PAGE_LIMIT));
    return params.toString();
  }, [queryString, page]);

  useEffect(() => {
    if (page > 1) setLoadingMore(true);
    api
      .get<Report>(`/reports/sales?${pagedQueryString}`)
      .then((data) => {
        setSummary(data.summary);
        setPagination(data.pagination);
        setRows((prev) => (data.pagination.page === 1 ? data.rows : [...prev, ...data.rows]));
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiClientError ? err.message : 'Failed to load report'))
      .finally(() => {
        setInitialLoading(false);
        setLoadingMore(false);
      });
  }, [pagedQueryString]);

  // Auto-pagination: load the next page as soon as the sentinel below the
  // table scrolls into view, instead of a prev/next control.
  useEffect(() => {
    if (!pagination || pagination.page >= pagination.totalPages) return;
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore) {
          setPage((p) => p + 1);
        }
      },
      { rootMargin: '300px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [pagination, loadingMore]);

  // Export covers exactly the rows already fetched via scrolling (not the
  // whole filtered dataset): page 1 at a limit equal to how many rows are
  // already loaded reproduces that same set deterministically.
  const exportQueryString = useMemo(() => {
    const params = new URLSearchParams(queryString);
    params.set('page', '1');
    params.set('limit', String(Math.max(rows.length, 1)));
    return params.toString();
  }, [queryString, rows.length]);

  const handleExport = (format: 'xlsx' | 'pdf') => {
    const token = window.localStorage.getItem('dealflow360_access_token');
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8001/api/v1';
    const path = format === 'pdf' ? '/reports/sales/export/pdf' : '/reports/sales/export';
    fetch(`${base}${path}?${exportQueryString}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.blob())
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sales-report.${format}`;
        a.click();
      });
  };

  return (
    <div className="admin-page reports-page">
      <div className="admin-page-header reports-page__header">
        <div>
          <p className="admin-eyebrow">Insights</p>
          <h1>Sales Reports</h1>
          <p>Quotation performance, net value, and discount analytics.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => handleExport('xlsx')} className="btn btn-secondary" style={{ gap: 7 }}>
            <Download size={13} />
            Export XLSX
          </button>
          <button onClick={() => handleExport('pdf')} className="btn btn-secondary" style={{ gap: 7 }}>
            <FileText size={13} />
            Export PDF
          </button>
        </div>
      </div>

      {error && (
        <div className="df-alert df-alert-error">
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Period filter */}
      <div className="admin-filter-row reports-page__period-row">
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>Period:</span>
        {['all', 'today', 'week'].map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            style={{
              padding: '5px 12px',
              borderRadius: 99,
              fontSize: 12,
              fontWeight: period === p ? 600 : 400,
              border: `1px solid ${period === p ? 'var(--accent)' : 'var(--border)'}`,
              background: period === p ? 'var(--accent-light)' : 'var(--surface-01)',
              color: period === p ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 120ms',
            }}
          >
            {p === 'all' ? 'All time' : p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {/* Additional report filters (PRD A7): Sales Team / Rep, Approval Status, Product / Category */}
      <div className="admin-filter-row reports-page__filter-row">
        <label className="reports-page__filter-field">
          <span>Sales Rep</span>
          <select value={repId} onChange={(e) => setRepId(e.target.value)} className="df-select">
            <option value="">All reps</option>
            {(filterOptions?.reps || []).map((rep) => (
              <option key={rep.id} value={rep.id}>{rep.fullName}</option>
            ))}
          </select>
        </label>
        <label className="reports-page__filter-field">
          <span>Team</span>
          <select value={team} onChange={(e) => setTeam(e.target.value)} className="df-select">
            <option value="">All teams</option>
            {(filterOptions?.teams || []).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="reports-page__filter-field">
          <span>Approval Status</span>
          <select value={approvalStatus} onChange={(e) => setApprovalStatus(e.target.value)} className="df-select">
            <option value="">All approval statuses</option>
            {(filterOptions?.approvalStatuses || []).map((status) => (
              <option key={status} value={status}>{formatStatus(status)}</option>
            ))}
          </select>
        </label>
        <label className="reports-page__filter-field">
          <span>Category</span>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="df-select">
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category._id} value={category._id}>{category.name}</option>
            ))}
          </select>
        </label>
        <label className="reports-page__filter-field">
          <span>Product</span>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className="df-select">
            <option value="">All products</option>
            {products.map((product) => (
              <option key={product._id} value={product._id}>{product.name}</option>
            ))}
          </select>
        </label>
      </div>

      {initialLoading && !error && (
        <div className="admin-metric-row reports-page__loading">
          {[0, 1, 2].map((i) => (
            <div className="df-metric" key={i}>
              <div className="skeleton" style={{ height: 11, width: 70, marginBottom: 10 }} />
              <div className="skeleton" style={{ height: 24, width: 90 }} />
            </div>
          ))}
        </div>
      )}

      {!initialLoading && summary && pagination && (
        <>
          {/* Summary metrics */}
          <div className="admin-metric-row">
            <div className="df-metric">
              <div className="df-metric-label">Quotations</div>
              <div className="df-metric-value text-num">{summary.totalQuotations}</div>
              <div className="df-metric-sub">in selected period</div>
            </div>
            <div className="df-metric">
              <div className="df-metric-label">Total Net Value</div>
              <div className="df-metric-value text-num">{money(summary.totalNetCents)}</div>
            </div>
            <div className="df-metric">
              <div className="df-metric-label">Avg Discount</div>
              <div
                className="df-metric-value text-num"
                style={{
                  color: summary.avgDiscountPct > 20 ? 'var(--amber)' : 'var(--text-primary)',
                }}
              >
                {summary.avgDiscountPct}%
              </div>
            </div>
          </div>

          {/* Row table */}
          <div className="admin-panel">
            <div className="admin-panel-header">
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600 }}>
                <BarChart2 size={14} color="var(--accent)" />
                Quotation Breakdown
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                {pagination.total === 0 ? '0 rows' : `${rows.length} of ${pagination.total} rows`}
              </span>
            </div>
            {rows.length === 0 ? (
              <div className="df-empty" style={{ padding: '32px' }}>
                <div className="df-empty-title">No data for this period</div>
                <div className="df-empty-desc">Try switching the filters above.</div>
              </div>
            ) : (
              <table className="df-table">
                <thead>
                  <tr>
                    <th>Quote No.</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Lines</th>
                    <th style={{ textAlign: 'right' }}>Net Value</th>
                    <th style={{ textAlign: 'right' }}>Eff. Discount</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.quote_no}>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{r.quote_no}</span>
                      </td>
                      <td>
                        <span className={`status-badge ${getStatusClass(r.status)}`}>{r.status}</span>
                      </td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.line_count}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                        {money(r.net_cents)}
                      </td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        <span
                          style={{
                            fontWeight: 600,
                            color: r.effective_discount_pct > 20 ? 'var(--amber)' : 'var(--text-primary)',
                          }}
                        >
                          {r.effective_discount_pct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                  {loadingMore &&
                    Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                      <tr key={`skeleton-${i}`}>
                        <td><div className="skeleton" style={{ height: 13, width: '80%' }} /></td>
                        <td><div className="skeleton" style={{ height: 13, width: '60%' }} /></td>
                        <td style={{ textAlign: 'right' }}><div className="skeleton" style={{ height: 13, width: 24, marginLeft: 'auto' }} /></td>
                        <td style={{ textAlign: 'right' }}><div className="skeleton" style={{ height: 13, width: 60, marginLeft: 'auto' }} /></td>
                        <td style={{ textAlign: 'right' }}><div className="skeleton" style={{ height: 13, width: 40, marginLeft: 'auto' }} /></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
            {pagination.page < pagination.totalPages && <div ref={sentinelRef} style={{ height: 1 }} />}
          </div>
        </>
      )}
    </div>
  );
}
