'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';

type Category = { _id: string; name: string };
type Product = {
  _id: string;
  name: string;
  categoryId: { _id: string; name: string } | string;
  productType: string;
  billingType: string;
  basePrice: number;
  costPrice: number;
  isStockManaged: boolean;
};
type Variant = { _id: string; sku: string; extraPrice: number };

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
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
    api.get<Product[]>('/products').then(setProducts).catch((err) => setError(err instanceof ApiClientError ? err.message : 'Failed to load products'));
    api.get<Category[]>('/categories').then(setCategories).catch(() => {});
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
    api.get<Variant[]>(`/products/${p._id}/variants`).then(setVariants).catch(() => setVariants([]));
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
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Product Catalog</h1>
        <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded shadow text-sm">
          + Add Product
        </button>
      </div>

      {error && <div className="mb-4 px-3 py-2 bg-red-50 text-red-700 text-sm rounded border border-red-200">{error}</div>}

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-gray-600">
              <th className="pb-2">Name</th>
              <th className="pb-2">Category</th>
              <th className="pb-2">Type</th>
              <th className="pb-2">Billing</th>
              <th className="pb-2">Price</th>
              <th className="pb-2">Stock Managed</th>
              <th className="pb-2">Variants</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p._id} className="border-b">
                <td className="py-3 font-medium">{p.name}</td>
                <td className="py-3">{typeof p.categoryId === 'object' ? p.categoryId.name : p.categoryId}</td>
                <td className="py-3">{p.productType}</td>
                <td className="py-3">{p.billingType}</td>
                <td className="py-3">${p.basePrice.toFixed(2)}</td>
                <td className="py-3">{p.isStockManaged ? 'Yes' : 'No'}</td>
                <td className="py-3">
                  <button onClick={() => openVariants(p)} className="text-blue-600 hover:underline">
                    Manage
                  </button>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={7} className="py-4 text-center text-gray-500">
                  No products yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <form onSubmit={handleCreate} className="bg-white p-6 rounded-lg shadow-lg w-96 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Add Product</h2>
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="w-full border rounded px-3 py-2" />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Category</label>
              <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} required className="w-full border rounded px-3 py-2">
                <option value="">Select...</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Product Type</label>
              <input value={form.productType} onChange={(e) => setForm({ ...form, productType: e.target.value })} className="w-full border rounded px-3 py-2" />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Billing Type</label>
              <select value={form.billingType} onChange={(e) => setForm({ ...form, billingType: e.target.value })} className="w-full border rounded px-3 py-2">
                <option value="ONE_TIME">One-time</option>
                <option value="RECURRING">Recurring</option>
              </select>
            </div>
            <div className="mb-3 flex gap-2">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Base Price ($)</label>
                <input type="number" step="0.01" value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: e.target.value })} required className="w-full border rounded px-3 py-2" />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Cost Price ($)</label>
                <input type="number" step="0.01" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} required className="w-full border rounded px-3 py-2" />
              </div>
            </div>
            <div className="mb-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isStockManaged} onChange={(e) => setForm({ ...form, isStockManaged: e.target.checked })} />
                Stock-managed (physical good, goes through warehouse allocation)
              </label>
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

      {variantsFor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h2 className="text-xl font-bold mb-4">Variants - {variantsFor.name}</h2>
            <ul className="mb-4 text-sm space-y-1">
              {variants.map((v) => (
                <li key={v._id} className="flex justify-between border-b py-1">
                  <span>{v.sku}</span>
                  <span className="text-gray-400">+${v.extraPrice.toFixed(2)}</span>
                </li>
              ))}
              {variants.length === 0 && <li className="text-gray-400">No variants yet.</li>}
            </ul>
            <div className="flex gap-2 mb-4">
              <input value={newSku} onChange={(e) => setNewSku(e.target.value)} placeholder="SKU" className="flex-1 border rounded px-3 py-2 text-sm" />
              <button onClick={addVariant} className="bg-blue-600 text-white px-3 py-2 rounded text-sm">
                Add
              </button>
            </div>
            <div className="flex justify-end">
              <button onClick={() => setVariantsFor(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
