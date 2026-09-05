'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';

type Subscription = {
  _id: string;
  customer_id: string;
  plan_id: { _id: string; name: string; cycle: string } | string;
  status: string;
  qty: number;
  recurring_unit_price_cents: number;
  next_bill_date: string;
};

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Subscription | null>(null);
  const [newQty, setNewQty] = useState(1);
  const [prorationPreview, setProrationPreview] = useState<number | null>(null);

  const load = () => {
    api
      .get<Subscription[]>('/subscriptions')
      .then(setSubs)
      .catch((err) => setError(err instanceof ApiClientError ? err.message : 'Failed to load subscriptions'));
  };

  useEffect(load, []);

  const openModify = (sub: Subscription) => {
    setSelected(sub);
    setNewQty(sub.qty);
    setProrationPreview(null);
  };

  useEffect(() => {
    if (!selected) return;
    api
      .get<{ proratedDeltaCents: number }>(`/billing/prorate?subscriptionId=${selected._id}&newQty=${newQty}`)
      .then((d) => setProrationPreview(d.proratedDeltaCents))
      .catch(() => setProrationPreview(null));
  }, [selected, newQty]);

  const confirmModify = async () => {
    if (!selected) return;
    try {
      await api.post(`/subscriptions/${selected._id}/modify`, { newQty });
      setSelected(null);
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Modify failed');
    }
  };

  const cancelSub = async (id: string) => {
    try {
      await api.post(`/subscriptions/${id}/cancel`, { reason: 'Cancelled from portal' });
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Cancel failed');
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Subscriptions & Billing</h1>

      {error && <div className="mb-4 px-3 py-2 bg-red-50 text-red-700 text-sm rounded border border-red-200">{error}</div>}

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-gray-600">
              <th className="pb-2">Plan</th>
              <th className="pb-2">Qty</th>
              <th className="pb-2">Unit Price</th>
              <th className="pb-2">Next Bill Date</th>
              <th className="pb-2">Status</th>
              <th className="pb-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {subs.map((s) => (
              <tr key={s._id} className="border-t">
                <td className="py-3 font-medium text-blue-600">{typeof s.plan_id === 'object' ? s.plan_id.name : s.plan_id}</td>
                <td className="py-3">{s.qty}</td>
                <td className="py-3">{money(s.recurring_unit_price_cents)}</td>
                <td className="py-3">{new Date(s.next_bill_date).toLocaleDateString()}</td>
                <td className="py-3">
                  <span
                    className={`px-2 py-1 rounded text-xs ${s.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}
                  >
                    {s.status}
                  </span>
                </td>
                <td className="py-3 text-right space-x-2">
                  {s.status === 'ACTIVE' && (
                    <>
                      <button onClick={() => openModify(s)} className="text-blue-600 hover:underline">
                        Modify
                      </button>
                      <button onClick={() => cancelSub(s._id)} className="text-red-600 hover:underline">
                        Cancel
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {subs.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-gray-500">
                  No subscriptions.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h2 className="text-xl font-bold mb-4">Modify Subscription</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">New Quantity</label>
              <input
                type="number"
                min={1}
                value={newQty}
                onChange={(e) => setNewQty(parseInt(e.target.value) || 1)}
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div className="bg-gray-50 p-3 rounded text-sm mb-6 border border-gray-200">
              <div className="flex justify-between mb-1">
                <span className="text-gray-600">Prorated {((prorationPreview ?? 0) >= 0 ? 'Charge' : 'Credit')}:</span>
                <span className={`font-medium ${(prorationPreview ?? 0) >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {prorationPreview !== null ? money(Math.abs(prorationPreview)) : '...'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Applied immediately per the plan&apos;s proration policy.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => setSelected(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">
                Close
              </button>
              <button onClick={confirmModify} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                Confirm Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
