'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { AlertCircle, Plus, Package, X } from 'lucide-react';

type Category = { _id: string; name: string };
type Product = {
  _id: string;
  name: string;
  categoryId: { _id: string; name: string } | string;
  productType: string;
  billingType: string;
  basePrice: number;
  costPrice: number;
  taxPercentage?: number;
  isActive?: boolean;
  status?: string;
  isStockManaged: boolean;
};
type Variant = { _id: string; sku: string; extraPrice: number };

function BillingBadge({ type }: { type: string }) {
  const isRecurring = type === 'RECURRING';
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 500,
        padding: '2px 8px',
        borderRadius: 99,
        background: isRecurring ? 'var(--blue-light)' : 'var(--surface-02)',
        color: isRecurring ? 'var(--blue)' : 'var(--text-secondary)',
        border: `1px solid ${isRecurring ? 'var(--blue-muted)' : 'var(--border)'}`,
      }}
    >
      {type === 'ONE_TIME' ? 'One-time' : type === 'RECURRING' ? 'Recurring' : type}
    </span>
  );
}

export default function ProductsPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN';
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [variantsFor, setVariantsFor] = useState<Product | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [newSku, setNewSku] = useState('');
  const [form, setForm] = useState({
    name: '',
    categoryId: '',
    productType: 'Hardware',
    billingType: 'ONE_TIME',
    basePrice: '',
    costPrice: '',
    taxPercentage: '0',
    unit: 'unit',
    isStockManaged: true,
  });

  const load = () => {
    api.get<{ products: Product[] }>('/products').then((d) => setProducts(d.products)).catch((err) => setError(err instanceof ApiClientError ? err.message : 'Failed to load products')).finally(() => setLoading(false));
    api.get<{ categories: Category[] }>('/categories').then((d) => setCategories(d.categories)).catch(() => {});
  };

  useEffect(load, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/products', {
        ...form,
        basePrice: Number(form.basePrice),
        costPrice: Number(form.costPrice),
        taxPercentage: Number(form.taxPercentage),
      });
      setShowModal(false);
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to create product');
    }
  };

  const openVariants = (p: Product) => {
    setVariantsFor(p);
    api.get<{ variants: Variant[] }>(`/products/${p._id}/variants`).then((d) => setVariants(d.variants)).catch(() => setVariants([]));
  };

  const addVariant = async () => {
    if (!variantsFor) return;
    try {
      await api.post(`/products/${variantsFor._id}/variants`, { sku: newSku, extraPrice: 0 });
      setNewSku('');
      openVariants(variantsFor);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to add variant');
    }
  };

  return (
    <div className="admin-page products-page">
      <div className="admin-page-header products-page__header">
        <div>
          <p className="admin-eyebrow">Sales</p>
          <h1>Product Catalog</h1>
          <p>{products.length} product{products.length !== 1 ? 's' : ''} in catalog</p>
        </div>
        {canManage && (
          <button onClick={() => setShowModal(true)} className="btn btn-primary">
            <Plus size={13} />
            Add Product
          </button>
        )}
      </div>

      {error && (
        <div className="df-alert df-alert-error">
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      <div className="admin-panel products-page__panel">
        {loading ? (
          <div style={{ padding: '18px' }}>
            <div className="skeleton" style={{ height: 16, marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 16, width: '80%', marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 16, width: '60%' }} />
          </div>
        ) : products.length === 0 ? (
          <div className="df-empty">
            <Package size={28} style={{ margin: '0 auto 10px', color: 'var(--text-tertiary)' }} />
            <div className="df-empty-title">No products yet</div>
            <div className="df-empty-desc">Add your first product to the catalog.</div>
          </div>
        ) : (
          <table className="df-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Type</th>
                <th style={{ textAlign: 'right' }}>Price</th>
                <th style={{ textAlign: 'right' }}>Cost</th>
                <th style={{ textAlign: 'right' }}>Tax</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p._id}>
                  <td>
                    <strong>{p.name}</strong>
                    <small>{p.isStockManaged ? 'Stock-managed' : 'Non-stock item'}</small>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                    {typeof p.categoryId === 'object' ? p.categoryId.name : p.categoryId}
                  </td>
                  <td>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--surface-02)', padding: '2px 8px', borderRadius: 99, border: '1px solid var(--border)' }}>
                      {p.productType}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                    ${p.basePrice.toFixed(2)}
                  </td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>
                    ${p.costPrice.toFixed(2)}
                  </td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>
                    {p.taxPercentage ?? 0}%
                  </td>
                  <td>
                    <div className="admin-product-status">
                      <BillingBadge type={p.billingType} />
                      <span className={`status-badge ${p.isActive === false || p.status === 'INACTIVE' ? 'status-cancelled' : 'status-active'}`}>
                        {p.isActive === false || p.status === 'INACTIVE' ? 'Inactive' : 'Active'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <button
                      onClick={() => openVariants(p)}
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: 12, color: 'var(--accent)' }}
                    >
                      Variants
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Product Modal */}
      {showModal && (
        <div className="df-modal-overlay" onClick={() => setShowModal(false)}>
          <form
            onSubmit={handleCreate}
            className="df-modal df-modal-wide"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div className="df-modal-header" style={{ marginBottom: 4 }}>
              <h2 className="df-modal-title">Add Product</h2>
            </div>
            <div className="df-modal-body">
              <div className="df-field">
                <label className="df-label">Product name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="df-input"
                  placeholder="e.g. Enterprise SSD"
                />
              </div>
              <div className="df-field">
                <label className="df-label">Category</label>
                <select
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  required
                  className="df-select"
                >
                  <option value="">Select category…</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="df-field">
                  <label className="df-label">Product type</label>
                  <input
                    value={form.productType}
                    onChange={(e) => setForm({ ...form, productType: e.target.value })}
                    className="df-input"
                    placeholder="Hardware, Software, Service…"
                  />
                </div>
                <div className="df-field">
                  <label className="df-label">Billing type</label>
                  <select
                    value={form.billingType}
                    onChange={(e) => setForm({ ...form, billingType: e.target.value })}
                    className="df-select"
                  >
                    <option value="ONE_TIME">One-time</option>
                    <option value="RECURRING">Recurring</option>
                  </select>
                </div>
                <div className="df-field">
                  <label className="df-label">Base price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.basePrice}
                    onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
                    required
                    className="df-input"
                    placeholder="0.00"
                  />
                </div>
                <div className="df-field">
                  <label className="df-label">Cost price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.costPrice}
                    onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                    required
                    className="df-input"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="df-field" style={{ marginBottom: 0 }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer',
                    padding: '10px 12px',
                    background: 'var(--surface-02)',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.isStockManaged}
                    onChange={(e) => setForm({ ...form, isStockManaged: e.target.checked })}
                    style={{ width: 14, height: 14 }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                      Stock-managed product
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      Physical goods that go through warehouse allocation and fulfillment
                    </div>
                  </div>
                </label>
              </div>
            </div>
            <div className="df-modal-footer">
              <button type="button" onClick={() => setShowModal(false)} className="btn btn-ghost">
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Create Product
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Variants Modal */}
      {variantsFor && (
        <div className="df-modal-overlay" onClick={() => setVariantsFor(null)}>
          <div className="df-modal" onClick={(e) => e.stopPropagation()}>
            <div className="df-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0, paddingBottom: 16 }}>
              <div>
                <h2 className="df-modal-title">Variants</h2>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{variantsFor.name}</p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setVariantsFor(null)}>
                <X size={14} />
              </button>
            </div>
            <div className="df-modal-body">
              {variants.length > 0 ? (
                <div style={{ marginBottom: 16 }}>
                  {variants.map((v) => (
                    <div
                      key={v._id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 0',
                        borderBottom: '1px solid var(--border)',
                        fontSize: 13,
                      }}
                    >
                      <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{v.sku}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>+${v.extraPrice.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 14 }}>
                  No variants yet.
                </p>
              )}
              {canManage && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={newSku}
                    onChange={(e) => setNewSku(e.target.value)}
                    placeholder="SKU (e.g. SSD-512GB)"
                    className="df-input"
                    style={{ flex: 1 }}
                  />
                  <button onClick={addVariant} disabled={!newSku} className="btn btn-secondary">
                    Add
                  </button>
                </div>
              )}
            </div>
            <div className="df-modal-footer">
              <button onClick={() => setVariantsFor(null)} className="btn btn-ghost">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
