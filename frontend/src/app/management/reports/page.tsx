'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';

type ReportRow = { quote_no: string; status: string; line_count: number; gross_cents: number; net_cents: number; effective_discount_pct: number };
type Report = { rows: ReportRow[]; summary: { totalQuotations: number; totalNetCents: number; avgDiscountPct: number } };

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function ReportsPage() {
  const [period, setPeriod] = useState('all');
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Report>(`/reports/sales?period=${period}`)
      .then(setReport)
      .catch((err) => setError(err instanceof ApiClientError ? err.message : 'Failed to load report'));
  }, [period]);

  const handleExport = () => {
    const token = window.localStorage.getItem('dealflow360_access_token');
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8001/api/v1';
    fetch(`${base}/reports/sales/export?period=${period}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sales-report.xlsx';
        a.click();
      });
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Reports & Analytics</h1>
        <button onClick={handleExport} className="px-4 py-2 bg-gray-800 text-white rounded shadow text-sm">
          Export XLSX
        </button>
      </div>

      {error && <div className="mb-4 px-3 py-2 bg-red-50 text-red-700 text-sm rounded border border-red-200">{error}</div>}

      <div className="flex gap-4 mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <select value={period} onChange={(e) => setPeriod(e.target.value)} className="border rounded px-3 py-2 text-sm">
          <option value="all">Period: All time</option>
          <option value="today">Period: Today</option>
          <option value="week">Period: This week</option>
        </select>
      </div>

      {report && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-sm text-gray-500 mb-1">Quotations</h3>
              <p className="text-3xl font-bold text-gray-900">{report.summary.totalQuotations}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-sm text-gray-500 mb-1">Total Net Value</h3>
              <p className="text-3xl font-bold text-gray-900">{money(report.summary.totalNetCents)}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-sm text-gray-500 mb-1">Avg Discount</h3>
              <p className="text-3xl font-bold text-gray-900">{report.summary.avgDiscountPct}%</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-gray-600">
                  <th className="pb-2">Quote No</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Lines</th>
                  <th className="pb-2">Net Value</th>
                  <th className="pb-2">Discount %</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.quote_no} className="border-b">
                    <td className="py-2 font-medium">{r.quote_no}</td>
                    <td className="py-2">{r.status}</td>
                    <td className="py-2">{r.line_count}</td>
                    <td className="py-2">{money(r.net_cents)}</td>
                    <td className="py-2">{r.effective_discount_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
