'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';

type CreditNote = { _id: string; customer_id: string; amount_cents: number; reason: string; status: string };

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function CreditNotesPage() {
  const [notes, setNotes] = useState<CreditNote[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const load = () => {
    api
      .get<CreditNote[]>('/credit-notes')
      .then(setNotes)
      .catch((err) => setError(err instanceof ApiClientError ? err.message : 'Failed to load credit notes'));
  };

  useEffect(load, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/credit-notes', { customer_id: customerId, amount_cents: Math.round(parseFloat(amount) * 100), reason });
      setShowModal(false);
      setCustomerId('');
      setAmount('');
      setReason('');
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to issue credit note');
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Credit Notes</h1>
        <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded shadow text-sm">
          + Issue Credit Note
        </button>
      </div>

      {error && <div className="mb-4 px-3 py-2 bg-red-50 text-red-700 text-sm rounded border border-red-200">{error}</div>}

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-gray-600">
              <th className="pb-2">Amount</th>
              <th className="pb-2">Reason</th>
              <th className="pb-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {notes.map((n) => (
              <tr key={n._id} className="border-b">
                <td className="py-3 text-green-600 font-bold">{money(n.amount_cents)}</td>
                <td className="py-3">{n.reason}</td>
                <td className="py-3">
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">{n.status}</span>
                </td>
              </tr>
            ))}
            {notes.length === 0 && (
              <tr>
                <td colSpan={3} className="py-4 text-center text-gray-500">
                  No credit notes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <form onSubmit={handleCreate} className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h2 className="text-xl font-bold mb-4">Issue Credit Note</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Customer ID</label>
              <input value={customerId} onChange={(e) => setCustomerId(e.target.value)} required className="w-full border rounded px-3 py-2" />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Amount ($)</label>
              <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required className="w-full border rounded px-3 py-2" />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium mb-1">Reason</label>
              <input value={reason} onChange={(e) => setReason(e.target.value)} required className="w-full border rounded px-3 py-2" />
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                Issue
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
