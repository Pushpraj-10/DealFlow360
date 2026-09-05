'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';

type Backorder = { _id: string; fulfillment_id: string; quote_line_id: string; qty: number; status: string };

export default function BackordersPage() {
  const [backorders, setBackorders] = useState<Backorder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = () => {
    api
      .get<Backorder[]>('/backorders')
      .then(setBackorders)
      .catch((err) => setError(err instanceof ApiClientError ? err.message : 'Failed to load backorders'));
  };

  useEffect(load, []);

  const consolidate = async (id: string) => {
    setError(null);
    setMessage(null);
    try {
      const result = await api.post<{ resolvedQty: number; remainingQty: number }>(`/backorders/${id}/consolidate`);
      setMessage(`Resolved ${result.resolvedQty}, ${result.remainingQty} remaining.`);
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Consolidation failed');
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Backorders Management</h1>

      {error && <div className="mb-4 px-3 py-2 bg-red-50 text-red-700 text-sm rounded border border-red-200">{error}</div>}
      {message && <div className="mb-4 px-3 py-2 bg-blue-50 text-blue-700 text-sm rounded border border-blue-200">{message}</div>}

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-gray-600">
              <th className="pb-2">Fulfillment</th>
              <th className="pb-2">Shortage Qty</th>
              <th className="pb-2">Status</th>
              <th className="pb-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {backorders.map((b) => (
              <tr key={b._id} className="border-b">
                <td className="py-3 font-medium text-blue-600">{b.fulfillment_id.slice(-6)}</td>
                <td className="py-3 text-red-600 font-bold">{b.qty}</td>
                <td className="py-3">{b.status}</td>
                <td className="py-3">
                  {b.status !== 'RESOLVED' ? (
                    <button
                      onClick={() => consolidate(b._id)}
                      className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded hover:bg-yellow-200"
                    >
                      Consolidate Now
                    </button>
                  ) : (
                    <span className="text-gray-400">Resolved</span>
                  )}
                </td>
              </tr>
            ))}
            {backorders.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-gray-500">
                  No backorders.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
