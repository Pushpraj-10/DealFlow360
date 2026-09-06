'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import { AlertCircle, Plus, CreditCard } from 'lucide-react';

type Customer = { _id: string; name: string; company?: string; email?: string; status?: string };
type CreditNote = { _id: string; customer_id: string | Customer; amount_cents: number; reason: string; status: string };

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function CreditNotesPage() {
  const [notes, setNotes] = useState<CreditNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const load = () => {
    api.get<CreditNote[]>('/credit-notes').then(setNotes).catch((err) =>
      setError(err instanceof ApiClientError ? err.message : 'Failed to load credit notes')
    ).finally(() => setLoading(false));
  };

  const loadCustomers = useCallback(() => {
    setCustomersLoading(true);
    api
      .get<{ customers: Customer[] }>('/customers')
      .then((data) => setCustomers(data.customers || []))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : 'Failed to load customers'))
      .finally(() => setCustomersLoading(false));
  }, []);

  useEffect(() => {
    load();
    queueMicrotask(() => {
      loadCustomers();
    });
  }, [loadCustomers]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/credit-notes', {
        customer_id: customerId,
        amount_cents: Math.round(parseFloat(amount) * 100),
        reason,
      });
      setShowModal(false);
      setCustomerId('');
      setAmount('');
      setReason('');
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to issue credit note');
    }
  };

  const totalIssued = notes.reduce((s, n) => s + n.amount_cents, 0);

  return (
    <div className="df-page credit-notes-page">
      <div className="df-page-header credit-notes-page__header">
        <div>
          <h1 className="df-page-title">Credit Notes</h1>
          <p className="df-page-subtitle">{notes.length} credit note{notes.length !== 1 ? 's' : ''} issued</p>
        </div>
        <button
          onClick={() => {
            setShowModal(true);
            loadCustomers();
          }}
          className="btn btn-primary"
        >
          <Plus size={13} />
          Issue Credit Note
        </button>
      </div>

      {error && (
        <div className="df-alert df-alert-error">
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {notes.length > 0 && (
        <div className="df-metric" style={{ marginBottom: 20, maxWidth: 240 }}>
          <div className="df-metric-label">Total Credits Issued</div>
          <div className="df-metric-value text-num">{money(totalIssued)}</div>
        </div>
      )}

      <div className="df-card credit-notes-page__panel">
        {loading ? (
          <div style={{ padding: '18px' }}>
            <div className="skeleton" style={{ height: 16, marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 16, width: '80%', marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 16, width: '60%' }} />
          </div>
        ) : notes.length === 0 ? (
          <div className="df-empty">
            <CreditCard size={28} style={{ margin: '0 auto 10px', color: 'var(--text-tertiary)' }} />
            <div className="df-empty-title">No credit notes</div>
            <div className="df-empty-desc">Credit notes are issued for returns, overpayments, or goodwill adjustments.</div>
          </div>
        ) : (
          <table className="df-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Customer</th>
                <th>Reason</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {notes.map((n) => (
                <tr key={n._id}>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--green)' }}>
                    {money(n.amount_cents)}
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {typeof n.customer_id === 'object'
                      ? [n.customer_id.company || n.customer_id.name, n.customer_id.email].filter(Boolean).join(' · ')
                      : `...${n.customer_id.slice(-8)}`}
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{n.reason}</td>
                  <td>
                    <span className="status-badge status-approved">{n.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="df-modal-overlay" onClick={() => setShowModal(false)}>
          <form onSubmit={handleCreate} className="df-modal" onClick={(e) => e.stopPropagation()}>
            <div className="df-modal-header" style={{ marginBottom: 4 }}>
              <h2 className="df-modal-title">Issue Credit Note</h2>
            </div>
            <div className="df-modal-body">
              <div className="df-field">
                <label className="df-label">Customer</label>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  required
                  className="df-select"
                >
                  <option value="">
                    {customersLoading ? 'Loading customers...' : 'Select customer...'}
                  </option>
                  {customers
                    .filter((customer) => !customer.status || customer.status === 'ACTIVE')
                    .map((customer) => (
                      <option key={customer._id} value={customer._id}>
                        {[customer.company || customer.name, customer.email].filter(Boolean).join(' · ')}
                      </option>
                    ))}
                </select>
              </div>
              <div className="df-field">
                <label className="df-label">Amount ($)</label>
                <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required className="df-input" placeholder="0.00" />
              </div>
              <div className="df-field" style={{ marginBottom: 0 }}>
                <label className="df-label">Reason</label>
                <input value={reason} onChange={(e) => setReason(e.target.value)} required className="df-input" placeholder="Reason for credit note" />
              </div>
            </div>
            <div className="df-modal-footer">
              <button type="button" onClick={() => setShowModal(false)} className="btn btn-ghost">Cancel</button>
              <button type="submit" className="btn btn-primary">Issue</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
