'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import { AlertCircle, RefreshCw, X } from 'lucide-react';

type Subscription = {
  _id: string;
  customer_id: string;
  plan_id: { _id: string; name: string; cycle: string } | string;
  status: string;
  qty: number;
  recurring_unit_price_cents: number;
  next_bill_date: string;
};

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function getStatusClass(status: string) {
  if (status === 'ACTIVE') return 'status-active';
  if (status === 'CANCELLED') return 'status-cancelled';
  return 'status-draft';
}

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Subscription | null>(null);
  const [newQty, setNewQty] = useState(1);
  const [prorationPreview, setProrationPreview] = useState<number | null>(null);

  const load = () => {
    api.get<Subscription[]>('/subscriptions').then(setSubs).catch((err) =>
      setError(err instanceof ApiClientError ? err.message : 'Failed to load subscriptions')
    );
  };

  useEffect(load, []);

  const openModify = (sub: Subscription) => {
    setSelected(sub);
    setNewQty(sub.qty);
    setProrationPreview(null);
  };

  useEffect(() => {
    if (!selected) return;
    api
      .get<{ proratedDeltaCents: number }>(`/billing/prorate?subscriptionId=${selected._id}&newQty=${newQty}`)
      .then((d) => setProrationPreview(d.proratedDeltaCents))
      .catch(() => setProrationPreview(null));
  }, [selected, newQty]);

  const confirmModify = async () => {
    if (!selected) return;
    try {
      await api.post(`/subscriptions/${selected._id}/modify`, { newQty });
      setSelected(null);
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Modify failed');
    }
  };

  const cancelSub = async (id: string) => {
    try {
      await api.post(`/subscriptions/${id}/cancel`, { reason: 'Cancelled from portal' });
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Cancel failed');
    }
  };

  const active = subs.filter((s) => s.status === 'ACTIVE').length;
  const totalMRR = subs
    .filter((s) => s.status === 'ACTIVE')
    .reduce((sum, s) => sum + s.recurring_unit_price_cents * s.qty, 0);

  return (
    <div className="df-page">
      <div className="df-page-header">
        <div>
          <h1 className="df-page-title">Subscriptions</h1>
          <p className="df-page-subtitle">{subs.length} subscription{subs.length !== 1 ? 's' : ''} total</p>
        </div>
      </div>

      {error && (
        <div className="df-alert df-alert-error">
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Metric strip */}
      {subs.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          <div className="df-metric">
            <div className="df-metric-label">Active</div>
            <div className="df-metric-value text-num" style={{ color: 'var(--green)' }}>{active}</div>
            <div className="df-metric-sub">recurring subscriptions</div>
          </div>
          <div className="df-metric">
            <div className="df-metric-label">Monthly Recurring Revenue</div>
            <div className="df-metric-value text-num">{money(totalMRR)}</div>
            <div className="df-metric-sub">from active plans</div>
          </div>
          <div className="df-metric">
            <div className="df-metric-label">Churned</div>
            <div className="df-metric-value text-num">{subs.length - active}</div>
            <div className="df-metric-sub">cancelled or inactive</div>
          </div>
        </div>
      )}

      <div className="df-card">
        {subs.length === 0 ? (
          <div className="df-empty">
            <RefreshCw size={28} style={{ margin: '0 auto 10px', color: 'var(--text-tertiary)' }} />
            <div className="df-empty-title">No subscriptions</div>
            <div className="df-empty-desc">Subscriptions are created when recurring quotations are confirmed.</div>
          </div>
        ) : (
          <table className="df-table">
            <thead>
              <tr>
                <th>Plan</th>
                <th style={{ textAlign: 'right' }}>Qty</th>
                <th style={{ textAlign: 'right' }}>Unit Price</th>
                <th>Next Billing</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s._id}>
                  <td style={{ fontWeight: 500 }}>
                    {typeof s.plan_id === 'object' ? s.plan_id.name : s.plan_id}
                    {typeof s.plan_id === 'object' && (
                      <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>
                        · {s.plan_id.cycle}
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{s.qty}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{money(s.recurring_unit_price_cents)}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                    {new Date(s.next_bill_date).toLocaleDateString()}
                  </td>
                  <td>
                    <span className={`status-badge ${getStatusClass(s.status)}`}>{s.status}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {s.status === 'ACTIVE' && (
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button onClick={() => openModify(s)} className="btn btn-ghost btn-sm" style={{ color: 'var(--accent)' }}>
                          Modify
                        </button>
                        <button onClick={() => cancelSub(s._id)} className="btn btn-danger btn-sm">
                          Cancel
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <div className="df-modal-overlay" onClick={() => setSelected(null)}>
          <div className="df-modal" onClick={(e) => e.stopPropagation()}>
            <div className="df-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h2 className="df-modal-title">Modify Subscription</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>
                <X size={14} />
              </button>
            </div>
            <div className="df-modal-body">
              <div className="df-field">
                <label className="df-label">New quantity</label>
                <input type="number" min={1} value={newQty} onChange={(e) => setNewQty(parseInt(e.target.value) || 1)} className="df-input" />
              </div>
              <div
                style={{
                  background: 'var(--surface-02)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '12px 14px',
                  marginBottom: 0,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    Prorated {(prorationPreview ?? 0) >= 0 ? 'charge' : 'credit'}:
                  </span>
                  <span
                    style={{
                      fontWeight: 600,
                      fontVariantNumeric: 'tabular-nums',
                      color: (prorationPreview ?? 0) >= 0 ? 'var(--amber)' : 'var(--green)',
                    }}
                  >
                    {prorationPreview !== null ? money(Math.abs(prorationPreview)) : '—'}
                  </span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  Applied immediately per the plan&apos;s proration policy.
                </p>
              </div>
            </div>
            <div className="df-modal-footer">
              <button onClick={() => setSelected(null)} className="btn btn-ghost">Close</button>
              <button onClick={confirmModify} className="btn btn-primary">Confirm Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
