'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import { AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';

type Backorder = { _id: string; fulfillment_id: string; quote_line_id: string; qty: number; status: string };

export default function BackordersPage() {
  const [backorders, setBackorders] = useState<Backorder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = () => {
    api.get<Backorder[]>('/backorders').then(setBackorders).catch((err) =>
      setError(err instanceof ApiClientError ? err.message : 'Failed to load backorders')
    ).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const consolidate = async (id: string) => {
    setError(null);
    setMessage(null);
    try {
      const result = await api.post<{ resolvedQty: number; remainingQty: number }>(`/backorders/${id}/consolidate`);
      setMessage(`Resolved ${result.resolvedQty} units. ${result.remainingQty} remaining.`);
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Consolidation failed');
    }
  };

  const open = backorders.filter((b) => b.status !== 'RESOLVED');

  return (
    <div className="df-page backorders-page">
      <div className="df-page-header backorders-page__header">
        <div>
          <h1 className="df-page-title">Backorders</h1>
          <p className="df-page-subtitle">
            {open.length > 0
              ? `${open.length} open backorder${open.length !== 1 ? 's' : ''} require consolidation`
              : 'No open backorders'}
          </p>
        </div>
      </div>

      {error && (
        <div className="df-alert df-alert-error">
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}
      {message && (
        <div className="df-alert df-alert-success">
          <CheckCircle size={14} style={{ flexShrink: 0 }} />
          <span>{message}</span>
        </div>
      )}

      <div className="df-card backorders-page__panel">
        {loading ? (
          <div style={{ padding: '18px' }}>
            <div className="skeleton" style={{ height: 16, marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 16, width: '80%', marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 16, width: '60%' }} />
          </div>
        ) : backorders.length === 0 ? (
          <div className="df-empty">
            <AlertTriangle size={28} style={{ margin: '0 auto 10px', color: 'var(--text-tertiary)' }} />
            <div className="df-empty-title">No backorders</div>
            <div className="df-empty-desc">Backorders appear here when a fulfillment has stock shortages.</div>
          </div>
        ) : (
          <table className="df-table">
            <thead>
              <tr>
                <th>Fulfillment</th>
                <th style={{ textAlign: 'right' }}>Shortage Qty</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {backorders.map((b) => (
                <tr key={b._id}>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--accent)', fontWeight: 500 }}>
                      …{b.fulfillment_id.slice(-6)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: b.status !== 'RESOLVED' ? 'var(--amber)' : 'var(--green)' }}>
                    {b.qty}
                  </td>
                  <td>
                    <span className={`status-badge ${b.status === 'RESOLVED' ? 'status-approved' : 'status-returned'}`}>
                      {b.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {b.status !== 'RESOLVED' ? (
                      <button
                        onClick={() => consolidate(b._id)}
                        className="btn btn-warning btn-sm"
                      >
                        Consolidate
                      </button>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                        <CheckCircle size={11} color="var(--green)" />
                        Done
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
