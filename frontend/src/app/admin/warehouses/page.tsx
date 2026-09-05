'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { AlertCircle, Plus, Trash2, Warehouse } from 'lucide-react';

type Warehouse = {
  _id: string;
  name: string;
  shipping_cost_weight: number;
  active: boolean;
};

export default function WarehousesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('1.0');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = () => {
    api
      .get<Warehouse[]>('/warehouses')
      .then(setWarehouses)
      .catch((err) =>
        setError(err instanceof ApiClientError ? err.message : 'Failed to load warehouses')
      )
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/warehouses', { name, shipping_cost_weight: parseFloat(weight) });
      setShowModal(false);
      setName('');
      setWeight('1.0');
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to create warehouse');
    }
  };

  const handleDelete = async (warehouse: Warehouse) => {
    if (!window.confirm(`Delete ${warehouse.name}? It will be deactivated and hidden from fulfillment splits.`)) {
      return;
    }
    setError(null);
    setDeletingId(warehouse._id);
    try {
      await api.del(`/warehouses/${warehouse._id}`);
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to delete warehouse');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="admin-page warehouses-page">
      <div className="admin-page-header warehouses-page__header">
        <div>
          <p className="admin-eyebrow">Operations</p>
          <h1>Warehouses</h1>
          <p>{warehouses.length} warehouse{warehouses.length !== 1 ? 's' : ''} configured.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus size={13} />
          Add Warehouse
        </button>
      </div>

      {error && (
        <div className="df-alert df-alert-error">
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      <div className="admin-panel warehouses-page__panel">
        {loading ? (
          <div style={{ padding: '18px' }}>
            <div className="skeleton" style={{ height: 16, marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 16, width: '80%', marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 16, width: '60%' }} />
          </div>
        ) : warehouses.length === 0 ? (
          <div className="df-empty">
            <Warehouse size={28} style={{ margin: '0 auto 10px', color: 'var(--text-tertiary)' }} />
            <div className="df-empty-title">No warehouses yet</div>
            <div className="df-empty-desc">Add your first warehouse to enable inventory and fulfillment.</div>
          </div>
        ) : (
          <table className="df-table">
            <thead>
              <tr>
                <th>Warehouse Name</th>
                <th style={{ textAlign: 'right' }}>Shipping Cost Weight</th>
                <th>Status</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {warehouses.map((w) => (
                <tr key={w._id}>
                  <td style={{ fontWeight: 500 }}>{w.name}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{w.shipping_cost_weight}×</td>
                  <td>
                    <span className={`status-badge ${w.active ? 'status-active' : 'status-cancelled'}`}>
                      {w.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {isAdmin && (
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => handleDelete(w)}
                        disabled={!w.active || deletingId === w._id}
                        className="btn btn-ghost btn-sm"
                        style={{ color: w.active ? 'var(--red)' : 'var(--text-tertiary)' }}
                        title={w.active ? 'Delete warehouse' : 'Already deactivated'}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  )}
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
              <h2 className="df-modal-title">Add Warehouse</h2>
            </div>
            <div className="df-modal-body">
              <div className="df-field">
                <label className="df-label">Warehouse name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required className="df-input" placeholder="e.g. Main Distribution Center" />
              </div>
              <div className="df-field" style={{ marginBottom: 0 }}>
                <label className="df-label">Shipping cost weight multiplier</label>
                <input type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} className="df-input" />
                <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Higher values increase shipping cost estimates from this location.</p>
              </div>
            </div>
            <div className="df-modal-footer">
              <button type="button" onClick={() => setShowModal(false)} className="btn btn-ghost">Cancel</button>
              <button type="submit" className="btn btn-primary">Create Warehouse</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
