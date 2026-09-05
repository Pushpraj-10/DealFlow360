'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';

type Alert = {
  _id: string;
  type: 'STALLED' | 'DISCOUNT_ANOMALY' | 'DELIVERY_SLIPPAGE';
  severity: string;
  status: string;
  quotation_id: string;
  details: Record<string, unknown>;
};

export default function DealHealthPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    api
      .get<Alert[]>('/deal-health')
      .then(setAlerts)
      .catch((err) => setError(err instanceof ApiClientError ? err.message : 'Failed to load alerts'));
  };

  useEffect(load, []);

  const handleAction = async (id: string, action: 'nudge' | 'escalate') => {
    try {
      await api.post(`/deal-health/${id}/${action}`, action === 'nudge' ? { message: 'Please follow up' } : { reason: 'Escalated from dashboard' });
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Action failed');
    }
  };

  const counts = {
    STALLED: alerts.filter((a) => a.type === 'STALLED').length,
    DISCOUNT_ANOMALY: alerts.filter((a) => a.type === 'DISCOUNT_ANOMALY').length,
    DELIVERY_SLIPPAGE: alerts.filter((a) => a.type === 'DELIVERY_SLIPPAGE').length,
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Deal Health & Anomaly Dashboard</h1>

      {error && <div className="mb-4 px-3 py-2 bg-red-50 text-red-700 text-sm rounded border border-red-200">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
          <h2 className="text-red-800 font-bold">Stalled Deals</h2>
          <p className="text-2xl text-red-600 font-bold">{counts.STALLED}</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
          <h2 className="text-yellow-800 font-bold">Discount Anomalies</h2>
          <p className="text-2xl text-yellow-600 font-bold">{counts.DISCOUNT_ANOMALY}</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
          <h2 className="text-orange-800 font-bold">Delivery Slippages</h2>
          <p className="text-2xl text-orange-600 font-bold">{counts.DELIVERY_SLIPPAGE}</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold mb-4">Active Alerts</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-gray-600">
              <th className="pb-2">Type</th>
              <th className="pb-2">Quotation</th>
              <th className="pb-2">Severity</th>
              <th className="pb-2">Details</th>
              <th className="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((a) => (
              <tr key={a._id} className="border-b">
                <td className="py-3 font-medium">{a.type.replace('_', ' ')}</td>
                <td className="py-3 text-blue-600">{a.quotation_id.slice(-6)}</td>
                <td className="py-3">{a.severity}</td>
                <td className="py-3 text-gray-600 text-xs">{JSON.stringify(a.details)}</td>
                <td className="py-3 space-x-2">
                  <button onClick={() => handleAction(a._id, 'nudge')} className="px-3 py-1 bg-blue-100 text-blue-800 rounded hover:bg-blue-200">
                    Nudge Rep
                  </button>
                  <button onClick={() => handleAction(a._id, 'escalate')} className="px-3 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200">
                    Escalate
                  </button>
                </td>
              </tr>
            ))}
            {alerts.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-gray-500">
                  No active alerts!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
