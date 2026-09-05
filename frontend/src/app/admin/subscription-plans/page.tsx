'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import { AlertCircle, Plus, RefreshCw } from 'lucide-react';

type Plan = {
  _id: string;
  name: string;
  cycle: string;
  proration_policy: string;
  cancellation_policy: string;
  active: boolean;
};

export default function SubscriptionPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [cycle, setCycle] = useState('monthly');
  const [cancellationPolicy, setCancellationPolicy] = useState('credit_remaining');

  const load = () => {
    api.get<Plan[]>('/subscription-plans').then(setPlans).catch((err) =>
      setError(err instanceof ApiClientError ? err.message : 'Failed to load plans')
    ).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/subscription-plans', { name, cycle, cancellation_policy: cancellationPolicy });
      setShowModal(false);
      setName('');
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to create plan');
    }
  };

  return (
    <div className="admin-page subscription-plans-page">
      <div className="admin-page-header subscription-plans-page__header">
        <div>
          <p className="admin-eyebrow">Operations</p>
          <h1>Subscription Plans</h1>
          <p>Configure recurring billing cycles and cancellation policies.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus size={13} />
          New Plan
        </button>
      </div>

      {error && (
        <div className="df-alert df-alert-error">
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      <div className="admin-panel subscription-plans-page__panel">
        {loading ? (
          <div style={{ padding: '18px' }}>
            <div className="skeleton" style={{ height: 16, marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 16, width: '80%', marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 16, width: '60%' }} />
          </div>
        ) : plans.length === 0 ? (
          <div className="df-empty">
            <RefreshCw size={28} style={{ margin: '0 auto 10px', color: 'var(--text-tertiary)' }} />
            <div className="df-empty-title">No subscription plans</div>
            <div className="df-empty-desc">Create a plan to enable recurring billing for customers.</div>
          </div>
        ) : (
          <table className="df-table">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Billing Cycle</th>
                <th>Proration Policy</th>
                <th>Cancellation Policy</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p._id}>
                  <td style={{ fontWeight: 500 }}>{p.name}</td>
                  <td style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{p.cycle}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{p.proration_policy?.replace(/_/g, ' ')}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{p.cancellation_policy?.replace(/_/g, ' ')}</td>
                  <td>
                    <span className={`status-badge ${p.active ? 'status-active' : 'status-cancelled'}`}>
                      {p.active ? 'Active' : 'Inactive'}
                    </span>
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
              <h2 className="df-modal-title">New Subscription Plan</h2>
            </div>
            <div className="df-modal-body">
              <div className="df-field">
                <label className="df-label">Plan name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required className="df-input" placeholder="e.g. Pro Monthly" />
              </div>
              <div className="df-field">
                <label className="df-label">Billing cycle</label>
                <select value={cycle} onChange={(e) => setCycle(e.target.value)} className="df-select">
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div className="df-field" style={{ marginBottom: 0 }}>
                <label className="df-label">Cancellation policy</label>
                <select value={cancellationPolicy} onChange={(e) => setCancellationPolicy(e.target.value)} className="df-select">
                  <option value="none">None</option>
                  <option value="credit_remaining">Credit Remaining</option>
                  <option value="full_refund">Full Refund</option>
                </select>
              </div>
            </div>
            <div className="df-modal-footer">
              <button type="button" onClick={() => setShowModal(false)} className="btn btn-ghost">Cancel</button>
              <button type="submit" className="btn btn-primary">Create Plan</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
