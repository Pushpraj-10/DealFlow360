'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import { AlertCircle, Download, BarChart2 } from 'lucide-react';

type ReportRow = { quote_no: string; status: string; line_count: number; gross_cents: number; net_cents: number; effective_discount_pct: number };
type Report = { rows: ReportRow[]; summary: { totalQuotations: number; totalNetCents: number; avgDiscountPct: number } };

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
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
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Report>(`/reports/sales?period=${period}`)
      .then(setReport)
      .catch((err) => setError(err instanceof ApiClientError ? err.message : 'Failed to load report'));
  }, [period]);

  const handleExport = () => {
    const token = window.localStorage.getItem('dealflow360_access_token');
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8001/api/v1';
    fetch(`${base}/reports/sales/export?period=${period}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.blob())
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sales-report.xlsx';
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
        <button onClick={handleExport} className="btn btn-secondary" style={{ gap: 7 }}>
          <Download size={13} />
          Export XLSX
        </button>
      </div>

      {error && (
        <div className="df-alert df-alert-error">
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Period filter */}
      <div className="admin-filter-row">
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

      {!report && !error && (
        <div className="admin-metric-row reports-page__loading">
          {[0, 1, 2].map((i) => (
            <div className="df-metric" key={i}>
              <div className="skeleton" style={{ height: 11, width: 70, marginBottom: 10 }} />
              <div className="skeleton" style={{ height: 24, width: 90 }} />
            </div>
          ))}
        </div>
      )}

      {report && (
        <>
          {/* Summary metrics */}
          <div className="admin-metric-row">
            <div className="df-metric">
              <div className="df-metric-label">Quotations</div>
              <div className="df-metric-value text-num">{report.summary.totalQuotations}</div>
              <div className="df-metric-sub">in selected period</div>
            </div>
            <div className="df-metric">
              <div className="df-metric-label">Total Net Value</div>
              <div className="df-metric-value text-num">{money(report.summary.totalNetCents)}</div>
            </div>
            <div className="df-metric">
              <div className="df-metric-label">Avg Discount</div>
              <div
                className="df-metric-value text-num"
                style={{
                  color:
                    report.summary.avgDiscountPct > 20
                      ? 'var(--amber)'
                      : 'var(--text-primary)',
                }}
              >
                {report.summary.avgDiscountPct}%
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
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{report.rows.length} rows</span>
            </div>
            {report.rows.length === 0 ? (
              <div className="df-empty" style={{ padding: '32px' }}>
                <div className="df-empty-title">No data for this period</div>
                <div className="df-empty-desc">Try switching the period filter above.</div>
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
                  {report.rows.map((r) => (
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
                            color:
                              r.effective_discount_pct > 20
                                ? 'var(--amber)'
                                : 'var(--text-primary)',
                          }}
                        >
                          {r.effective_discount_pct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
