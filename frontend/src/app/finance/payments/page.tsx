'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import { AlertCircle, DollarSign } from 'lucide-react';

type Invoice = { _id: string; invoice_no: string };
type Payment = { _id: string; invoice_id: string; amount_cents: number; paid_at: string; method: string; reference?: string };

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function PaymentsPage() {
  const [rows, setRows] = useState<(Payment & { invoiceNo: string })[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const invoices = await api.get<Invoice[]>('/invoices');
        const all: (Payment & { invoiceNo: string })[] = [];
        for (const inv of invoices) {
          const detail = await api.get<{ payments: Payment[] }>(`/invoices/${inv._id}`);
          for (const p of detail.payments) {
            all.push({ ...p, invoiceNo: inv.invoice_no });
          }
        }
        all.sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime());
        setRows(all);
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : 'Failed to load payments');
      }
    })();
  }, []);

  const totalCollected = rows.reduce((s, r) => s + r.amount_cents, 0);

  return (
    <div className="df-page">
      <div className="df-page-header">
        <div>
          <h1 className="df-page-title">Payments</h1>
          <p className="df-page-subtitle">{rows.length} payment{rows.length !== 1 ? 's' : ''} recorded</p>
        </div>
      </div>

      {error && (
        <div className="df-alert df-alert-error">
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {rows.length > 0 && (
        <div className="df-metric" style={{ marginBottom: 20, maxWidth: 240 }}>
          <div className="df-metric-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <DollarSign size={10} />
            Total Collected
          </div>
          <div className="df-metric-value text-num" style={{ color: 'var(--green)' }}>{money(totalCollected)}</div>
          <div className="df-metric-sub">across all invoices</div>
        </div>
      )}

      <div className="df-card">
        {rows.length === 0 ? (
          <div className="df-empty">
            <DollarSign size={28} style={{ margin: '0 auto 10px', color: 'var(--text-tertiary)' }} />
            <div className="df-empty-title">No payments recorded</div>
            <div className="df-empty-desc">Payments appear here after you record them on invoices.</div>
          </div>
        ) : (
          <table className="df-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Method</th>
                <th>Reference</th>
                <th>Paid At</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p._id}>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 13 }}>{p.invoiceNo}</span>
                  </td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--green)' }}>
                    {money(p.amount_cents)}
                  </td>
                  <td style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{p.method}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-tertiary)' }}>
                    {p.reference || '—'}
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                    {new Date(p.paid_at).toLocaleString()}
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
