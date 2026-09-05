'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';

type Invoice = {
  _id: string;
  invoice_no: string;
  customer_id: string;
  status: string;
  due_date: string;
  total_cents: number;
  paid_amount_cents: number;
};

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

const statusColor: Record<string, string> = {
  PAID: 'bg-green-100 text-green-800',
  PARTIALLY_PAID: 'bg-yellow-100 text-yellow-800',
  UNPAID: 'bg-red-100 text-red-800',
  DRAFT: 'bg-gray-100 text-gray-600',
  CREDITED: 'bg-blue-100 text-blue-800',
  VOIDED: 'bg-gray-100 text-gray-400',
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [amount, setAmount] = useState('');

  const load = () => {
    api
      .get<Invoice[]>('/invoices')
      .then(setInvoices)
      .catch((err) => setError(err instanceof ApiClientError ? err.message : 'Failed to load invoices'));
  };

  useEffect(load, []);

  const handleRecordPayment = async () => {
    if (!selected) return;
    try {
      await api.post(`/invoices/${selected._id}/payments`, {
        amount_cents: Math.round(parseFloat(amount) * 100),
        method: 'card',
      });
      setSelected(null);
      setAmount('');
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Payment failed');
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Invoices</h1>

      {error && <div className="mb-4 px-3 py-2 bg-red-50 text-red-700 text-sm rounded border border-red-200">{error}</div>}

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-gray-600">
              <th className="pb-2">Invoice No</th>
              <th className="pb-2">Total</th>
              <th className="pb-2">Paid</th>
              <th className="pb-2">Due Date</th>
              <th className="pb-2">Status</th>
              <th className="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv._id} className="border-b">
                <td className="py-3 font-medium">{inv.invoice_no}</td>
                <td className="py-3">{money(inv.total_cents)}</td>
                <td className="py-3">{money(inv.paid_amount_cents)}</td>
                <td className="py-3">{new Date(inv.due_date).toLocaleDateString()}</td>
                <td className="py-3">
                  <span className={`px-2 py-1 rounded text-xs ${statusColor[inv.status] || 'bg-gray-100'}`}>{inv.status}</span>
                </td>
                <td className="py-3">
                  {['UNPAID', 'PARTIALLY_PAID'].includes(inv.status) && (
                    <button onClick={() => setSelected(inv)} className="text-blue-600 hover:underline">
                      Record Payment
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-gray-500">
                  No invoices.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h2 className="text-xl font-bold mb-4">Record Payment for {selected.invoice_no}</h2>
            <p className="text-sm text-gray-500 mb-2">
              Balance: {money(selected.total_cents - selected.paid_amount_cents)}
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Payment Amount ($)</label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setSelected(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">
                Cancel
              </button>
              <button onClick={handleRecordPayment} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
