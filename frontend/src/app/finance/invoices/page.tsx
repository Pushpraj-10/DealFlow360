'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import { AlertCircle, Receipt, X } from 'lucide-react';

type Invoice = {
  _id: string;
  invoice_no: string;
  customer_id: string;
  status: string;
  due_date: string;
  total_cents: number;
  paid_amount_cents: number;
};

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function getStatusClass(status: string): string {
  const s = status?.toUpperCase() ?? '';
  if (s === 'PAID') return 'status-paid';
  if (s === 'PARTIALLY_PAID') return 'status-partial';
  if (s === 'UNPAID') return 'status-unpaid';
  if (s === 'DRAFT') return 'status-draft';
  if (s === 'CREDITED') return 'status-info';
  if (s === 'VOIDED') return 'status-cancelled';
  return 'status-draft';
}

function getStatusLabel(status: string): string {
  return {
    PAID: 'Paid',
    PARTIALLY_PAID: 'Partial',
    UNPAID: 'Unpaid',
    DRAFT: 'Draft',
    CREDITED: 'Credited',
    VOIDED: 'Voided',
  }[status] ?? status;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [amount, setAmount] = useState('');

  const load = () => {
    api
      .get<Invoice[]>('/invoices')
      .then(setInvoices)
      .catch((err) =>
        setError(err instanceof ApiClientError ? err.message : 'Failed to load invoices')
      );
  };

  useEffect(load, []);

  const handleRecordPayment = async () => {
    if (!selected) return;
    try {
      await api.post(`/invoices/${selected._id}/payments`, {
        amount_cents: Math.round(parseFloat(amount) * 100),
        method: 'card',
      });
      setSelected(null);
      setAmount('');
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Payment failed');
    }
  };

  const totalInvoiced = invoices.reduce((s, i) => s + i.total_cents, 0);
  const totalCollected = invoices.reduce((s, i) => s + i.paid_amount_cents, 0);

  return (
    <div className="df-page">
      <div className="df-page-header">
        <div>
          <h1 className="df-page-title">Invoices</h1>
          <p className="df-page-subtitle">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {error && (
        <div className="df-alert df-alert-error">
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Summary strip */}
      {invoices.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          <div className="df-metric">
            <div className="df-metric-label">Total Invoiced</div>
            <div className="df-metric-value text-num">{money(totalInvoiced)}</div>
          </div>
          <div className="df-metric">
            <div className="df-metric-label">Collected</div>
            <div className="df-metric-value text-num" style={{ color: 'var(--green)' }}>
              {money(totalCollected)}
            </div>
          </div>
          <div className="df-metric">
            <div className="df-metric-label">Outstanding</div>
            <div
              className="df-metric-value text-num"
              style={{ color: totalInvoiced - totalCollected > 0 ? 'var(--amber)' : 'var(--green)' }}
            >
              {money(totalInvoiced - totalCollected)}
            </div>
          </div>
        </div>
      )}

      <div className="df-card">
        {invoices.length === 0 ? (
          <div className="df-empty">
            <Receipt size={28} style={{ margin: '0 auto 10px', color: 'var(--text-tertiary)' }} />
            <div className="df-empty-title">No invoices</div>
            <div className="df-empty-desc">Invoices are created when quotations are confirmed and fulfilled.</div>
          </div>
        ) : (
          <table className="df-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th style={{ textAlign: 'right' }}>Paid</th>
                <th style={{ textAlign: 'right' }}>Balance</th>
                <th>Due Date</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const balance = inv.total_cents - inv.paid_amount_cents;
                const isOverdue = new Date(inv.due_date) < new Date() && inv.status !== 'PAID';
                return (
                  <tr key={inv._id}>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 13 }}>
                        {inv.invoice_no}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                      {money(inv.total_cents)}
                    </td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>
                      {money(inv.paid_amount_cents)}
                    </td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      <span
                        style={{
                          fontWeight: 600,
                          color: balance > 0 ? 'var(--amber)' : 'var(--green)',
                        }}
                      >
                        {money(balance)}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: 13, color: isOverdue ? 'var(--red)' : 'var(--text-secondary)', fontWeight: isOverdue ? 600 : 400 }}>
                        {new Date(inv.due_date).toLocaleDateString()}
                        {isOverdue && (
                          <span style={{ marginLeft: 4, fontSize: 10, background: 'var(--red-light)', color: 'var(--red)', border: '1px solid var(--red-muted)', padding: '1px 5px', borderRadius: 3 }}>
                            overdue
                          </span>
                        )}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${getStatusClass(inv.status)}`}>
                        {getStatusLabel(inv.status)}
                      </span>
                    </td>
                    <td>
                      {['UNPAID', 'PARTIALLY_PAID'].includes(inv.status) && (
                        <button
                          onClick={() => setSelected(inv)}
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--accent)', fontSize: 12 }}
                        >
                          Record Payment
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Record Payment Modal */}
      {selected && (
        <div className="df-modal-overlay" onClick={() => setSelected(null)}>
          <div className="df-modal" onClick={(e) => e.stopPropagation()}>
            <div className="df-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div>
                <h2 className="df-modal-title">Record Payment</h2>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, fontFamily: 'monospace' }}>
                  {selected.invoice_no}
                </p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>
                <X size={14} />
              </button>
            </div>
            <div className="df-modal-body">
              <div
                style={{
                  background: 'var(--surface-02)',
                  borderRadius: 'var(--radius)',
                  padding: '12px 14px',
                  marginBottom: 16,
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500, marginBottom: 3 }}>
                    OUTSTANDING BALANCE
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--amber)' }}>
                    {money(selected.total_cents - selected.paid_amount_cents)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500, marginBottom: 3 }}>TOTAL</div>
                  <div style={{ fontSize: 14, fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>
                    {money(selected.total_cents)}
                  </div>
                </div>
              </div>
              <div className="df-field" style={{ marginBottom: 0 }}>
                <label className="df-label">Payment amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="df-input"
                  placeholder="0.00"
                  autoFocus
                />
              </div>
            </div>
            <div className="df-modal-footer">
              <button onClick={() => setSelected(null)} className="btn btn-ghost">
                Cancel
              </button>
              <button
                onClick={handleRecordPayment}
                disabled={!amount || parseFloat(amount) <= 0}
                className="btn btn-primary"
              >
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
