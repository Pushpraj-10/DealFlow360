'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';

type Tier = { _id: string; name: string };
type Customer = { _id: string; name: string; company: string; email: string; tierId: { _id: string; name: string } | string; status: string };

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', company: '', email: '', tierId: '' });

  const load = () => {
    api
      .get<{ customers: Customer[] }>('/customers')
      .then((d) => setCustomers(d.customers))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : 'Failed to load customers'));
    api.get<{ tiers: Tier[] }>('/customer-tiers').then((d) => setTiers(d.tiers)).catch(() => {});
  };

  useEffect(load, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/customers', form);
      setShowModal(false);
      setForm({ name: '', company: '', email: '', tierId: '' });
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to create customer');
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Customers</h1>
        <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded shadow text-sm">
          + Add Customer
        </button>
      </div>

      {error && <div className="mb-4 px-3 py-2 bg-red-50 text-red-700 text-sm rounded border border-red-200">{error}</div>}

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-gray-600">
              <th className="pb-2">Name</th>
              <th className="pb-2">Company</th>
              <th className="pb-2">Tier</th>
              <th className="pb-2">Email</th>
              <th className="pb-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c._id} className="border-b">
                <td className="py-3 font-medium">{c.name}</td>
                <td className="py-3">{c.company}</td>
                <td className="py-3">{typeof c.tierId === 'object' ? c.tierId.name : c.tierId}</td>
                <td className="py-3">{c.email}</td>
                <td className="py-3">{c.status}</td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-gray-500">
                  No customers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <form onSubmit={handleCreate} className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h2 className="text-xl font-bold mb-4">Add Customer</h2>
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="w-full border rounded px-3 py-2" />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Company</label>
              <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} required className="w-full border rounded px-3 py-2" />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className="w-full border rounded px-3 py-2" />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium mb-1">Tier</label>
              <select value={form.tierId} onChange={(e) => setForm({ ...form, tierId: e.target.value })} required className="w-full border rounded px-3 py-2">
                <option value="">Select tier...</option>
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
    </div>
  );
}
