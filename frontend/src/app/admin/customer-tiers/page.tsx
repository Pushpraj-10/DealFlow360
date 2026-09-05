'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import { AlertCircle, Plus, Tag } from 'lucide-react';

type Tier = { _id: string; name: string; defaultMaxDiscountPercent: number; isActive: boolean };

export default function CustomerTiersPage() {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [maxDiscount, setMaxDiscount] = useState('10');

  const load = () => {
    api
      .get<{ tiers: Tier[] }>('/customer-tiers')
      .then((d) => setTiers(d.tiers))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : 'Failed to load tiers'));
  };

  useEffect(load, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/customer-tiers', { name, defaultMaxDiscountPercent: Number(maxDiscount) });
      setShowModal(false);
      setName('');
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to create tier');
    }
  };

  return (
    <div className="df-page">
      <div className="df-page-header">
        <div>
          <h1 className="df-page-title">Customer Tiers</h1>
          <p className="df-page-subtitle">Tier-based discount ceilings applied to customers in quotations</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus size={13} />
          Add Tier
        </button>
      </div>

      {error && (
        <div className="df-alert df-alert-error">
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      <div className="df-card">
        {tiers.length === 0 ? (
          <div className="df-empty">
            <Tag size={28} style={{ margin: '0 auto 10px', color: 'var(--text-tertiary)' }} />
            <div className="df-empty-title">No customer tiers</div>
            <div className="df-empty-desc">Tiers define the maximum discount available to a class of customers.</div>
          </div>
        ) : (
          <table className="df-table">
            <thead>
              <tr>
                <th>Tier</th>
                <th style={{ textAlign: 'right' }}>Default Max Discount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((t) => (
                <tr key={t._id}>
                  <td style={{ fontWeight: 500 }}>{t.name}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                    {t.defaultMaxDiscountPercent}%
                  </td>
                  <td>
                    <span className={`status-badge ${t.isActive ? 'status-active' : 'status-cancelled'}`}>
                      {t.isActive ? 'Active' : 'Inactive'}
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
              <h2 className="df-modal-title">Add Customer Tier</h2>
            </div>
            <div className="df-modal-body">
              <div className="df-field">
                <label className="df-label">Tier name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required className="df-input" placeholder="e.g. Gold, Enterprise, Standard" />
              </div>
              <div className="df-field" style={{ marginBottom: 0 }}>
                <label className="df-label">Default max discount (%)</label>
                <input type="number" value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)} className="df-input" min="0" max="100" />
                <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Customers in this tier cannot receive discounts above this percentage.</p>
              </div>
            </div>
            <div className="df-modal-footer">
              <button type="button" onClick={() => setShowModal(false)} className="btn btn-ghost">Cancel</button>
              <button type="submit" className="btn btn-primary">Create Tier</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
