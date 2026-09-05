'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';

type Plan = {
  _id: string;
  name: string;
  cycle: string;
  proration_policy: string;
  cancellation_policy: string;
  active: boolean;
};

export default function SubscriptionPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [cycle, setCycle] = useState('monthly');
  const [cancellationPolicy, setCancellationPolicy] = useState('credit_remaining');

  const load = () => {
    api
      .get<Plan[]>('/subscription-plans')
      .then(setPlans)
      .catch((err) => setError(err instanceof ApiClientError ? err.message : 'Failed to load plans'));
  };

  useEffect(load, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/subscription-plans', { name, cycle, cancellation_policy: cancellationPolicy });
      setShowModal(false);
      setName('');
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to create plan');
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Subscription Plans Setup</h1>
        <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded shadow text-sm">
          + New Plan
        </button>
      </div>

      {error && <div className="mb-4 px-3 py-2 bg-red-50 text-red-700 text-sm rounded border border-red-200">{error}</div>}

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-gray-600">
              <th className="pb-2">Plan Name</th>
              <th className="pb-2">Cycle</th>
              <th className="pb-2">Proration Policy</th>
              <th className="pb-2">Cancellation Policy</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p._id} className="border-b">
                <td className="py-3 font-medium">{p.name}</td>
                <td className="py-3 capitalize">{p.cycle}</td>
                <td className="py-3">{p.proration_policy}</td>
                <td className="py-3">{p.cancellation_policy}</td>
              </tr>
            ))}
            {plans.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-gray-500">
                  No plans yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <form onSubmit={handleCreate} className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h2 className="text-xl font-bold mb-4">New Subscription Plan</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full border rounded px-3 py-2" />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Cycle</label>
              <select value={cycle} onChange={(e) => setCycle(e.target.value)} className="w-full border rounded px-3 py-2">
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium mb-1">Cancellation Policy</label>
              <select
                value={cancellationPolicy}
                onChange={(e) => setCancellationPolicy(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="none">None</option>
                <option value="credit_remaining">Credit Remaining</option>
                <option value="full_refund">Full Refund</option>
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
