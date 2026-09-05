'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';

type DashboardData = {
  quotationsByStatus: { _id: string; count: number }[];
  invoicesByStatus: { _id: string; count: number }[];
  activeSubscriptions: number;
  invoiceTotals: { total_cents: number; paid_cents: number };
  openAlertsCount: number;
  openAlertsByType: Record<string, number>;
};

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<DashboardData>('/dashboard')
      .then(setData)
      .catch((err) => setError(err instanceof ApiClientError ? err.message : 'Failed to load dashboard'));
  }, []);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {error && <div className="mb-4 px-3 py-2 bg-red-50 text-red-700 text-sm rounded border border-red-200">{error}</div>}

      {!data && !error && <p className="text-gray-500">Loading...</p>}

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
            <p className="text-sm text-gray-500 mb-1">Active Subscriptions</p>
            <p className="text-3xl font-bold text-gray-900">{data.activeSubscriptions}</p>
          </div>
          <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
            <p className="text-sm text-gray-500 mb-1">Open Deal Alerts</p>
            <p className="text-3xl font-bold text-gray-900">{data.openAlertsCount}</p>
            <p className="text-xs text-gray-400 mt-1">
              {Object.entries(data.openAlertsByType).map(([k, v]) => `${k}: ${v}`).join(' - ') || 'None'}
            </p>
          </div>
          <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
            <p className="text-sm text-gray-500 mb-1">Invoiced / Paid</p>
            <p className="text-3xl font-bold text-gray-900">{money(data.invoiceTotals.total_cents)}</p>
            <p className="text-xs text-gray-400 mt-1">{money(data.invoiceTotals.paid_cents)} collected</p>
          </div>

          <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 md:col-span-3">
            <h2 className="text-sm uppercase text-gray-500 font-bold mb-3">Quotations by Status</h2>
            <div className="flex gap-3 flex-wrap">
              {data.quotationsByStatus.map((row) => (
                <span key={row._id} className="px-3 py-1 bg-gray-100 rounded text-sm">
                  {row._id}: <strong>{row.count}</strong>
                </span>
              ))}
            </div>
          </div>

          <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 md:col-span-3">
            <h2 className="text-sm uppercase text-gray-500 font-bold mb-3">Invoices by Status</h2>
            <div className="flex gap-3 flex-wrap">
              {data.invoicesByStatus.map((row) => (
                <span key={row._id} className="px-3 py-1 bg-gray-100 rounded text-sm">
                  {row._id}: <strong>{row.count}</strong>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
