'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import { AlertCircle, Plus, ListFilter } from 'lucide-react';

type Category = { _id: string; name: string; maxAllowedDiscountPercent: number; isActive: boolean };

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [maxDiscount, setMaxDiscount] = useState('10');

  const load = () => {
    api
      .get<{ categories: Category[] }>('/categories')
      .then((d) => setCategories(d.categories))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : 'Failed to load categories'));
  };

  useEffect(load, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/categories', { name, maxAllowedDiscountPercent: Number(maxDiscount) });
      setShowModal(false);
      setName('');
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to create category');
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="admin-eyebrow">Sales</p>
          <h1>Product Categories</h1>
          <p>Category discount ceilings govern product-level discount rules.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus size={13} />
          Add Category
        </button>
      </div>

      {error && (
        <div className="df-alert df-alert-error">
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      <div className="admin-panel">
        {categories.length === 0 ? (
          <div className="df-empty">
            <ListFilter size={28} style={{ margin: '0 auto 10px', color: 'var(--text-tertiary)' }} />
            <div className="df-empty-title">No categories yet</div>
            <div className="df-empty-desc">Categories define discount ceilings for groups of products.</div>
          </div>
        ) : (
          <table className="df-table">
            <thead>
              <tr>
                <th>Category</th>
                <th style={{ textAlign: 'right' }}>Max Discount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c._id}>
                  <td style={{ fontWeight: 500 }}>{c.name}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {c.maxAllowedDiscountPercent}%
                  </td>
                  <td>
                    <span className={`status-badge ${c.isActive ? 'status-active' : 'status-cancelled'}`}>
                      {c.isActive ? 'Active' : 'Inactive'}
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
              <h2 className="df-modal-title">Add Category</h2>
            </div>
            <div className="df-modal-body">
              <div className="df-field">
                <label className="df-label">Category name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required className="df-input" placeholder="e.g. Hardware, Software, Services" />
              </div>
              <div className="df-field" style={{ marginBottom: 0 }}>
                <label className="df-label">Max allowed discount (%)</label>
                <input type="number" value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)} className="df-input" min="0" max="100" />
                <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                  Products in this category cannot receive discounts above this ceiling.
                </p>
              </div>
            </div>
            <div className="df-modal-footer">
              <button type="button" onClick={() => setShowModal(false)} className="btn btn-ghost">Cancel</button>
              <button type="submit" className="btn btn-primary">Create Category</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
