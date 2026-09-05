'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import { AlertCircle, Plus, BadgePercent } from 'lucide-react';

type Tier = { _id: string; name: string };
type Product = { _id: string; name: string };
type PriceListItem = { _id: string; productId: string; unitPrice: number; basePriceOverride: number };
type PriceList = { _id: string; name: string; customerTierId: { _id: string; name: string } | string; currencyCode: string; items: PriceListItem[] };

export default function PriceListsPage() {
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', customerTierId: '', currencyCode: 'USD' });
  const [itemsFor, setItemsFor] = useState<PriceList | null>(null);
  const [itemForm, setItemForm] = useState({ productId: '', unitPrice: '', basePriceOverride: '' });

  const load = () => {
    api.get<PriceList[]>('/price-lists').then(setPriceLists).catch((err) =>
      setError(err instanceof ApiClientError ? err.message : 'Failed to load price lists')
    );
    api.get<Tier[]>('/customer-tiers').then(setTiers).catch(() => {});
    api.get<Product[]>('/products').then(setProducts).catch(() => {});
  };

  useEffect(load, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/price-lists', form);
      setShowModal(false);
      setForm({ name: '', customerTierId: '', currencyCode: 'USD' });
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to create price list');
    }
  };

  const addItem = async () => {
    if (!itemsFor) return;
    try {
      await api.post(`/price-lists/${itemsFor._id}/items`, {
        productId: itemForm.productId,
        unitPrice: Number(itemForm.unitPrice),
        basePriceOverride: Number(itemForm.basePriceOverride || itemForm.unitPrice),
      });
      setItemForm({ productId: '', unitPrice: '', basePriceOverride: '' });
      load();
      setItemsFor(null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to add price list item');
    }
  };

  return (
    <div className="df-page">
      <div className="df-page-header">
        <div>
          <h1 className="df-page-title">Price Lists</h1>
          <p className="df-page-subtitle">Tier-specific pricing for products in quotations</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus size={13} />
          Add Price List
        </button>
      </div>

      {error && (
        <div className="df-alert df-alert-error">
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      <div className="df-card">
        {priceLists.length === 0 ? (
          <div className="df-empty">
            <BadgePercent size={28} style={{ margin: '0 auto 10px', color: 'var(--text-tertiary)' }} />
            <div className="df-empty-title">No price lists</div>
            <div className="df-empty-desc">Price lists define tier-specific unit prices for products.</div>
          </div>
        ) : (
          <table className="df-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Customer Tier</th>
                <th>Currency</th>
                <th style={{ textAlign: 'right' }}>Items</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {priceLists.map((pl) => (
                <tr key={pl._id}>
                  <td style={{ fontWeight: 500 }}>{pl.name}</td>
                  <td>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--surface-02)', padding: '2px 8px', borderRadius: 99, border: '1px solid var(--border)' }}>
                      {typeof pl.customerTierId === 'object' ? pl.customerTierId.name : pl.customerTierId}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{pl.currencyCode}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pl.items.length}</td>
                  <td>
                    <button onClick={() => setItemsFor(pl)} className="btn btn-ghost btn-sm" style={{ color: 'var(--accent)' }}>
                      Add Item
                    </button>
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
              <h2 className="df-modal-title">Add Price List</h2>
            </div>
            <div className="df-modal-body">
              <div className="df-field">
                <label className="df-label">Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="df-input" placeholder="e.g. Enterprise USD" />
              </div>
              <div className="df-field" style={{ marginBottom: 0 }}>
                <label className="df-label">Customer tier</label>
                <select value={form.customerTierId} onChange={(e) => setForm({ ...form, customerTierId: e.target.value })} required className="df-select">
                  <option value="">Select tier…</option>
                  {tiers.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
                </select>
              </div>
            </div>
            <div className="df-modal-footer">
              <button type="button" onClick={() => setShowModal(false)} className="btn btn-ghost">Cancel</button>
              <button type="submit" className="btn btn-primary">Create</button>
            </div>
          </form>
        </div>
      )}

      {itemsFor && (
        <div className="df-modal-overlay" onClick={() => setItemsFor(null)}>
          <div className="df-modal" onClick={(e) => e.stopPropagation()}>
            <div className="df-modal-header" style={{ marginBottom: 4 }}>
              <h2 className="df-modal-title">Add Item</h2>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{itemsFor.name}</p>
            </div>
            <div className="df-modal-body">
              <div className="df-field">
                <label className="df-label">Product</label>
                <select value={itemForm.productId} onChange={(e) => setItemForm({ ...itemForm, productId: e.target.value })} className="df-select">
                  <option value="">Select product…</option>
                  {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
              </div>
              <div className="df-field" style={{ marginBottom: 0 }}>
                <label className="df-label">Unit price ($)</label>
                <input type="number" step="0.01" value={itemForm.unitPrice} onChange={(e) => setItemForm({ ...itemForm, unitPrice: e.target.value })} className="df-input" placeholder="0.00" />
              </div>
            </div>
            <div className="df-modal-footer">
              <button onClick={() => setItemsFor(null)} className="btn btn-ghost">Cancel</button>
              <button onClick={addItem} className="btn btn-primary">Add Item</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
