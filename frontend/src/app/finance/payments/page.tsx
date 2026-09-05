'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';

type Invoice = { _id: string; invoice_no: string };
type Payment = { _id: string; invoice_id: string; amount_cents: number; paid_at: string; method: string; reference?: string };

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function PaymentsPage() {
  const [rows, setRows] = useState<(Payment & { invoiceNo: string })[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const invoices = await api.get<Invoice[]>('/invoices');
        const all: (Payment & { invoiceNo: string })[] = [];
        for (const inv of invoices) {
          const detail = await api.get<{ payments: Payment[] }>(`/invoices/${inv._id}`);
          for (const p of detail.payments) {
            all.push({ ...p, invoiceNo: inv.invoice_no });
          }
        }
        all.sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime());
        setRows(all);
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : 'Failed to load payments');
      }
    })();
  }, []);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Payments</h1>

      {error && <div className="mb-4 px-3 py-2 bg-red-50 text-red-700 text-sm rounded border border-red-200">{error}</div>}

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-gray-600">
              <th className="pb-2">Invoice</th>
              <th className="pb-2">Amount</th>
              <th className="pb-2">Method</th>
              <th className="pb-2">Reference</th>
              <th className="pb-2">Paid At</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p._id} className="border-b">
                <td className="py-3 font-medium">{p.invoiceNo}</td>
                <td className="py-3 text-green-600 font-bold">{money(p.amount_cents)}</td>
                <td className="py-3 capitalize">{p.method}</td>
                <td className="py-3">{p.reference || '-'}</td>
                <td className="py-3">{new Date(p.paid_at).toLocaleString()}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-gray-500">
                  No payments recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
