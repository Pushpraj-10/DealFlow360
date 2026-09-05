'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';

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
    api.get<PriceList[]>('/price-lists').then(setPriceLists).catch((err) => setError(err instanceof ApiClientError ? err.message : 'Failed to load price lists'));
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
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Price Lists</h1>
        <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded shadow text-sm">
          + Add Price List
        </button>
      </div>

      {error && <div className="mb-4 px-3 py-2 bg-red-50 text-red-700 text-sm rounded border border-red-200">{error}</div>}

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-gray-600">
              <th className="pb-2">Name</th>
              <th className="pb-2">Tier</th>
              <th className="pb-2">Currency</th>
              <th className="pb-2">Items</th>
              <th className="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {priceLists.map((pl) => (
              <tr key={pl._id} className="border-b">
                <td className="py-3 font-medium">{pl.name}</td>
                <td className="py-3">{typeof pl.customerTierId === 'object' ? pl.customerTierId.name : pl.customerTierId}</td>
                <td className="py-3">{pl.currencyCode}</td>
                <td className="py-3">{pl.items.length}</td>
                <td className="py-3">
                  <button onClick={() => setItemsFor(pl)} className="text-blue-600 hover:underline">
                    + Add Item
                  </button>
                </td>
              </tr>
            ))}
            {priceLists.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-gray-500">
                  No price lists yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <form onSubmit={handleCreate} className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h2 className="text-xl font-bold mb-4">Add Price List</h2>
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="w-full border rounded px-3 py-2" />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium mb-1">Customer Tier</label>
              <select value={form.customerTierId} onChange={(e) => setForm({ ...form, customerTierId: e.target.value })} required className="w-full border rounded px-3 py-2">
                <option value="">Select...</option>
                {tiers.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {itemsFor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h2 className="text-xl font-bold mb-4">Add Item - {itemsFor.name}</h2>
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Product</label>
              <select value={itemForm.productId} onChange={(e) => setItemForm({ ...itemForm, productId: e.target.value })} className="w-full border rounded px-3 py-2">
                <option value="">Select...</option>
                {products.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium mb-1">Unit Price ($)</label>
              <input type="number" step="0.01" value={itemForm.unitPrice} onChange={(e) => setItemForm({ ...itemForm, unitPrice: e.target.value })} className="w-full border rounded px-3 py-2" />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setItemsFor(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">
                Cancel
              </button>
              <button onClick={addItem} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
