'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import { AlertCircle, Plus, Users } from 'lucide-react';

type Tier = { _id: string; name: string };
type Customer = {
  _id: string;
  name: string;
  company: string;
  email: string;
  tierId: { _id: string; name: string } | string;
  status: string;
};

function getStatusClass(status: string): string {
  const s = status?.toLowerCase() ?? '';
  if (s === 'active') return 'status-active';
  if (s === 'inactive' || s === 'disabled') return 'status-cancelled';
  return 'status-draft';
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', company: '', email: '', tierId: '' });

  const load = () => {
    api
      .get<{ customers: Customer[] }>('/customers')
      .then((d) => setCustomers(d.customers))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : 'Failed to load customers'));
    api.get<{ tiers: Tier[] }>('/customer-tiers').then((d) => setTiers(d.tiers)).catch(() => {});
  };

  useEffect(load, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/customers', form);
      setShowModal(false);
      setForm({ name: '', company: '', email: '', tierId: '' });
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to create customer');
    }
  };

  return (
    <div className="df-page">
      <div className="df-page-header">
        <div>
          <h1 className="df-page-title">Customers</h1>
          <p className="df-page-subtitle">{customers.length} customer{customers.length !== 1 ? 's' : ''} in your workspace</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus size={13} />
          Add Customer
        </button>
      </div>

      {error && (
        <div className="df-alert df-alert-error">
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      <div className="df-card">
        {customers.length === 0 ? (
          <div className="df-empty">
            <Users size={28} style={{ margin: '0 auto 10px', color: 'var(--text-tertiary)' }} />
            <div className="df-empty-title">No customers yet</div>
            <div className="df-empty-desc">Add your first customer to start building your pipeline.</div>
          </div>
        ) : (
          <table className="df-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Company</th>
                <th>Tier</th>
                <th>Email</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c._id}>
                  <td style={{ fontWeight: 500 }}>{c.name}</td>
                  <td>{c.company}</td>
                  <td>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--surface-02)', padding: '2px 8px', borderRadius: 99, border: '1px solid var(--border)' }}>
                      {typeof c.tierId === 'object' ? c.tierId.name : c.tierId || '—'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{c.email}</td>
                  <td>
                    <span className={`status-badge ${getStatusClass(c.status)}`}>{c.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Customer Modal */}
      {showModal && (
        <div className="df-modal-overlay" onClick={() => setShowModal(false)}>
          <form
            onSubmit={handleCreate}
            className="df-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="df-modal-header" style={{ marginBottom: 4 }}>
              <h2 className="df-modal-title">Add Customer</h2>
            </div>
            <div className="df-modal-body">
              <div className="df-field">
                <label className="df-label">Full name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="df-input"
                  placeholder="Jane Smith"
                />
              </div>
              <div className="df-field">
                <label className="df-label">Company</label>
                <input
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  required
                  className="df-input"
                  placeholder="Acme Corp"
                />
              </div>
              <div className="df-field">
                <label className="df-label">Email address</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  className="df-input"
                  placeholder="jane@acme.com"
                />
              </div>
              <div className="df-field" style={{ marginBottom: 0 }}>
                <label className="df-label">Customer tier</label>
                <select
                  value={form.tierId}
                  onChange={(e) => setForm({ ...form, tierId: e.target.value })}
                  required
                  className="df-select"
                >
                  <option value="">Select tier…</option>
                  {tiers.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="df-modal-footer">
              <button type="button" onClick={() => setShowModal(false)} className="btn btn-ghost">
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Create Customer
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
