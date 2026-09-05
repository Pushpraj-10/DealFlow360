'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';

type Tier = { _id: string; name: string; defaultMaxDiscountPercent: number; isActive: boolean };

export default function CustomerTiersPage() {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [maxDiscount, setMaxDiscount] = useState('10');

  const load = () => {
    api
      .get<Tier[]>('/customer-tiers')
      .then(setTiers)
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
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Customer Tiers</h1>
        <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded shadow text-sm">
          + Add Tier
        </button>
      </div>

      {error && <div className="mb-4 px-3 py-2 bg-red-50 text-red-700 text-sm rounded border border-red-200">{error}</div>}

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-gray-600">
              <th className="pb-2">Name</th>
              <th className="pb-2">Default Max Discount %</th>
              <th className="pb-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((t) => (
              <tr key={t._id} className="border-b">
                <td className="py-3 font-medium">{t.name}</td>
                <td className="py-3">{t.defaultMaxDiscountPercent}%</td>
                <td className={`py-3 ${t.isActive ? 'text-green-600' : 'text-gray-400'}`}>{t.isActive ? 'Active' : 'Inactive'}</td>
              </tr>
            ))}
            {tiers.length === 0 && (
              <tr>
                <td colSpan={3} className="py-4 text-center text-gray-500">
                  No tiers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <form onSubmit={handleCreate} className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h2 className="text-xl font-bold mb-4">Add Customer Tier</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full border rounded px-3 py-2" />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium mb-1">Default Max Discount %</label>
              <input type="number" value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)} className="w-full border rounded px-3 py-2" />
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
    </div>
  );
}
