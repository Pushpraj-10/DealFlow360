'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import { AlertCircle, AlertTriangle, RefreshCw, DollarSign, Activity } from 'lucide-react';

type DashboardData = {
  quotationsByStatus: { _id: string; count: number }[];
  invoicesByStatus: { _id: string; count: number }[];
  activeSubscriptions: number;
  invoiceTotals: { total_cents: number; paid_cents: number };
  openAlertsCount: number;
  openAlertsByType: Record<string, number>;
};

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function getStatusClass(status: string): string {
  const s = status?.toLowerCase() ?? '';
  if (s === 'draft') return 'status-draft';
  if (s.includes('pending') || s.includes('approval')) return 'status-pending';
  if (s === 'approved') return 'status-approved';
  if (s === 'rejected') return 'status-rejected';
  if (s === 'negotiating' || s === 'sent') return 'status-negotiating';
  if (s === 'confirmed') return 'status-confirmed';
  if (s.includes('paid') && !s.includes('un')) return 'status-paid';
  if (s === 'unpaid') return 'status-unpaid';
  if (s.includes('partial')) return 'status-partial';
  if (s === 'voided' || s === 'cancelled') return 'status-cancelled';
  return 'status-draft';
}

function SkeletonMetric() {
  return (
    <div className="df-metric">
      <div className="skeleton" style={{ width: 80, height: 11, marginBottom: 10, borderRadius: 3 }} />
      <div className="skeleton" style={{ width: 100, height: 28, borderRadius: 4 }} />
    </div>
  );
}

export default function DashboardPage() {
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
      {/* Page header */}
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

      {/* Metric strip */}
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
              <div className="df-metric-value text-num">{money(data.invoiceTotals.total_cents)}</div>
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
                {money(collected)}
              </div>
              <div className="df-metric-sub">{collectionRate}% collection rate</div>
            </div>
          </>
        )}
      </div>

      {/* Needs Attention */}
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
            View all →
          </a>
        </div>
      )}

      {/* Status grids */}
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
          {/* Quotations by status */}
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

          {/* Invoices by status */}
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
