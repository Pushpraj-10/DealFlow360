'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiClientError } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { AlertCircle, ArrowLeft, CheckCircle, Trash2 } from 'lucide-react';

type Category = { _id: string; name: string };
type Product = {
  _id: string;
  name: string;
  categoryId: { _id: string; name: string } | string;
  productType: string;
  billingType: string;
  basePrice: number;
  costPrice: number;
  taxPercentage: number;
  unit: string;
  description?: string | null;
  isStockManaged: boolean;
  isActive?: boolean;
  status?: string;
  createdAt?: string;
};

type FormState = {
  name: string;
  categoryId: string;
  productType: string;
  billingType: string;
  basePrice: string;
  costPrice: string;
  taxPercentage: string;
  unit: string;
  description: string;
  isStockManaged: boolean;
};

function currentCategoryId(product: Product) {
  return typeof product.categoryId === 'object' ? product.categoryId._id : product.categoryId;
}

function categoryName(product: Product) {
  return typeof product.categoryId === 'object' ? product.categoryId.name : 'Uncategorized';
}

function isArchived(product: Product) {
  return product.isActive === false || product.status === 'ARCHIVED';
}

function formFromProduct(product: Product): FormState {
  return {
    name: product.name,
    categoryId: currentCategoryId(product),
    productType: product.productType,
    billingType: product.billingType,
    basePrice: String(product.basePrice),
    costPrice: String(product.costPrice),
    taxPercentage: String(product.taxPercentage ?? 0),
    unit: product.unit,
    description: product.description || '',
    isStockManaged: product.isStockManaged,
  };
}

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const productId = params.id;
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [productData, categoriesData] = await Promise.all([
        api.get<{ product: Product }>(`/products/${productId}`),
        isAdmin ? api.get<{ categories: Category[] }>('/categories') : Promise.resolve({ categories: [] as Category[] }),
      ]);
      setProduct(productData.product);
      setCategories(categoriesData.categories);
      setForm(formFromProduct(productData.product));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load product');
    } finally {
      setLoading(false);
    }
  }, [productId, isAdmin]);

  useEffect(() => {
    queueMicrotask(() => {
      load();
    });
  }, [load]);

  const hasChanges = !!product && !!form &&
    JSON.stringify(form) !== JSON.stringify(formFromProduct(product));

  const handleSave = async () => {
    if (!product || !form) return;
    setError(null);
    setInfo(null);
    setSaving(true);
    try {
      const data = await api.patch<{ product: Product }>(`/products/${productId}`, {
        name: form.name,
        categoryId: form.categoryId,
        productType: form.productType,
        billingType: form.billingType,
        basePrice: Number(form.basePrice),
        costPrice: Number(form.costPrice),
        taxPercentage: Number(form.taxPercentage),
        unit: form.unit,
        description: form.description,
        isStockManaged: form.isStockManaged,
      });
      setProduct(data.product);
      setForm(formFromProduct(data.product));
      setInfo('Product updated successfully.');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to update product');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setError(null);
    setDeleting(true);
    try {
      await api.del(`/products/${productId}`);
      router.push('/admin/products');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to delete product');
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  return (
    <div className="manager-page">
      <Link href="/admin/products" className="manager-back-link">
        <ArrowLeft size={14} />
        Products
      </Link>

      {error && (
        <div className="df-alert df-alert-error">
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}
      {info && (
        <div className="df-alert df-alert-success">
          <CheckCircle size={14} style={{ flexShrink: 0 }} />
          <span>{info}</span>
        </div>
      )}

      {loading || !product || !form ? (
        <div className="manager-detail-shell">
          <div className="manager-panel"><div className="skeleton" style={{ height: 220 }} /></div>
          <div className="manager-panel"><div className="skeleton" style={{ height: 220 }} /></div>
        </div>
      ) : (
        <>
          <section className="manager-approval-hero">
            <div>
              <p className="sales-eyebrow">Product</p>
              <h1>{product.name}</h1>
              <span>{categoryName(product)} · {product.productType}</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className={`status-badge ${isArchived(product) ? 'status-cancelled' : 'status-active'}`}>
                {isArchived(product) ? 'Archived' : 'Active'}
              </span>
            </div>
          </section>

          <div className="manager-detail-shell">
            <main className="manager-detail-main">
              <section className="manager-panel">
                <div className="manager-panel-header">
                  <h2>Commercial</h2>
                </div>
                <div className="manager-commercial-grid">
                  <div><span>Base price</span><strong>${product.basePrice.toFixed(2)}</strong></div>
                  <div><span>Cost price</span><strong>${product.costPrice.toFixed(2)}</strong></div>
                  <div><span>Tax</span><strong>{product.taxPercentage ?? 0}%</strong></div>
                  <div><span>Billing</span><strong style={{ fontSize: 14 }}>{product.billingType === 'RECURRING' ? 'Recurring' : 'One-time'}</strong></div>
                </div>
              </section>

              <section className="manager-panel">
                <div className="manager-panel-header">
                  <h2>Details</h2>
                </div>
                <div className="manager-commercial-grid">
                  <div><span>Category</span><strong style={{ fontSize: 14 }}>{categoryName(product)}</strong></div>
                  <div><span>Unit</span><strong style={{ fontSize: 14 }}>{product.unit}</strong></div>
                  <div><span>Stock managed</span><strong style={{ fontSize: 14 }}>{product.isStockManaged ? 'Yes' : 'No'}</strong></div>
                  <div><span>Listed since</span><strong style={{ fontSize: 14 }}>{product.createdAt ? new Date(product.createdAt).toLocaleDateString() : '—'}</strong></div>
                </div>
              </section>

              <section className="manager-panel">
                <div className="manager-panel-header">
                  <h2>Description</h2>
                </div>
                {product.description ? (
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                    {product.description}
                  </p>
                ) : (
                  <div className="sales-empty-line">No description has been added for this product yet.</div>
                )}
              </section>
            </main>

            <aside className="manager-detail-side">
              {isAdmin && (
                <section className="manager-panel manager-action-panel">
                  <div>
                    <p className="sales-eyebrow">Admin controls</p>
                    <h2>Edit product</h2>
                    <p>Changes apply immediately to pricing and quotation lines going forward.</p>
                  </div>
                  <div className="df-field">
                    <label className="df-label">Product name</label>
                    <input
                      className="df-input"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>
                  <div className="df-field">
                    <label className="df-label">Category</label>
                    <select
                      className="df-select"
                      value={form.categoryId}
                      onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                    >
                      {categories.map((c) => (
                        <option key={c._id} value={c._id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="df-field">
                    <label className="df-label">Product type</label>
                    <input
                      className="df-input"
                      value={form.productType}
                      onChange={(e) => setForm({ ...form, productType: e.target.value })}
                    />
                  </div>
                  <div className="df-field">
                    <label className="df-label">Billing type</label>
                    <select
                      className="df-select"
                      value={form.billingType}
                      onChange={(e) => setForm({ ...form, billingType: e.target.value })}
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
                      className="df-input"
                      value={form.basePrice}
                      onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
                    />
                  </div>
                  <div className="df-field">
                    <label className="df-label">Cost price ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="df-input"
                      value={form.costPrice}
                      onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                    />
                  </div>
                  <div className="df-field">
                    <label className="df-label">Tax (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="df-input"
                      value={form.taxPercentage}
                      onChange={(e) => setForm({ ...form, taxPercentage: e.target.value })}
                    />
                  </div>
                  <div className="df-field">
                    <label className="df-label">Unit</label>
                    <input
                      className="df-input"
                      value={form.unit}
                      onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    />
                  </div>
                  <div className="df-field" style={{ marginBottom: 0 }}>
                    <label className="df-label">Description</label>
                    <textarea
                      className="df-input"
                      rows={3}
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                    />
                  </div>
                  <button className="btn btn-primary btn-full" disabled={!hasChanges || saving} onClick={handleSave}>
                    {saving ? 'Saving...' : 'Save changes'}
                  </button>
                </section>
              )}

              {isAdmin && (
                <section className="manager-panel manager-action-panel">
                  <div>
                    <p className="sales-eyebrow">Danger zone</p>
                    <h2>Delete product</h2>
                    <p>Archives the product. It's removed from the catalog but kept for history.</p>
                  </div>
                  {confirmingDelete ? (
                    <>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        Are you sure? This can't be undone from here.
                      </span>
                      <button className="btn btn-ghost btn-full" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
                        Cancel
                      </button>
                      <button className="btn btn-danger btn-full" onClick={handleDelete} disabled={deleting}>
                        {deleting ? 'Deleting...' : 'Yes, delete product'}
                      </button>
                    </>
                  ) : (
                    <button className="btn btn-danger btn-full" onClick={() => setConfirmingDelete(true)}>
                      <Trash2 size={14} />
                      Delete product
                    </button>
                  )}
                </section>
              )}
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
