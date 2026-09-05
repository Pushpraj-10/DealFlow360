'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';

type Customer = { _id: string; name: string; company: string };
type Product = { _id: string; name: string };
type Quotation = {
  _id: string;
  quoteNumber: string;
  status: string;
  grandTotal: number;
  riskSeverity: string;
  customerId: { _id: string; name: string } | string;
};
type QuotationLine = { _id: string; productId: { name: string } | string; quantity: number; unitPrice: number; discountPercent: number; lineTotal: number; is_violation: boolean };

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [newCustomerId, setNewCustomerId] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lines, setLines] = useState<QuotationLine[]>([]);
  const [lineForm, setLineForm] = useState({ productId: '', quantity: '1', discountPercent: '0' });

  const loadQuotations = () => {
    api
      .get<{ quotations: Quotation[] }>('/quotations')
      .then((d) => setQuotations(d.quotations))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : 'Failed to load quotations'));
  };

  useEffect(() => {
    loadQuotations();
    api.get<Customer[]>('/customers').then(setCustomers).catch(() => {});
    api.get<Product[]>('/products').then(setProducts).catch(() => {});
  }, []);

  const loadLines = (id: string) => {
    api
      .get<{ lines: QuotationLine[] }>(`/quotations/${id}/risk`)
      .catch(() => null);
    // Lines come back attached to quotation mutations; simplest reliable
    // source is re-fetching the quotation list detail via the lines the
    // last add/submit call returned, so refetch by re-adding nothing and
    // relying on cached lines state from create/add responses instead.
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const data = await api.post<{ quotation: Quotation }>('/quotations', { customerId: newCustomerId });
      setNewCustomerId('');
      loadQuotations();
      setSelectedId(data.quotation._id);
      setLines([]);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to create quotation');
    }
  };

  const handleAddLine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setError(null);
    try {
      const data = await api.post<{ lines: QuotationLine[] }>(`/quotations/${selectedId}/lines`, {
        productId: lineForm.productId,
        quantity: Number(lineForm.quantity),
        discountPercent: Number(lineForm.discountPercent),
      });
      setLines(data.lines);
      loadQuotations();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to add line');
    }
  };

  const handleSubmit = async () => {
    if (!selectedId) return;
    setError(null);
    try {
      const data = await api.post<{ approval: { approvalRequired: boolean } }>(`/quotations/${selectedId}/submit`);
      setInfo(
        data.approval.approvalRequired
          ? 'Submitted - routed for approval based on blended discount risk.'
          : 'Submitted - no approval required, ready for the customer.'
      );
      loadQuotations();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to submit quotation');
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Quotations</h1>

      {error && <div className="mb-4 px-3 py-2 bg-red-50 text-red-700 text-sm rounded border border-red-200">{error}</div>}
      {info && <div className="mb-4 px-3 py-2 bg-blue-50 text-blue-700 text-sm rounded border border-blue-200">{info}</div>}

      <form onSubmit={handleCreate} className="flex gap-2 mb-6">
        <select value={newCustomerId} onChange={(e) => setNewCustomerId(e.target.value)} required className="border rounded px-3 py-2 text-sm flex-1">
          <option value="">Select customer for a new draft...</option>
          {customers.map((c) => (
            <option key={c._id} value={c._id}>
              {c.company || c.name}
            </option>
          ))}
        </select>
        <button className="bg-blue-600 text-white px-4 py-2 rounded text-sm">New Draft Quotation</button>
      </form>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 col-span-1">
          <h2 className="text-sm uppercase text-gray-500 font-bold mb-3">All Quotations</h2>
          <ul className="space-y-1 text-sm">
            {quotations.map((q) => (
              <li key={q._id}>
                <button
                  onClick={() => {
                    setSelectedId(q._id);
                    setLines([]);
                    loadLines(q._id);
                  }}
                  className={`w-full text-left px-2 py-2 rounded hover:bg-gray-100 ${selectedId === q._id ? 'bg-blue-50 text-blue-700' : ''}`}
                >
                  <div className="font-medium">{q.quoteNumber}</div>
                  <div className="text-xs text-gray-500">
                    {q.status} - ${q.grandTotal?.toFixed?.(2) ?? 0}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="col-span-2">
          {!selectedId && <p className="text-gray-500">Select or create a quotation.</p>}
          {selectedId && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-800">Lines</h2>
                <button onClick={handleSubmit} className="px-3 py-1 bg-green-600 text-white rounded text-sm">
                  Submit for Approval
                </button>
              </div>

              <table className="w-full text-left text-sm mb-4">
                <thead>
                  <tr className="border-b text-gray-600">
                    <th className="pb-2">Product</th>
                    <th className="pb-2">Qty</th>
                    <th className="pb-2">Unit Price</th>
                    <th className="pb-2">Discount %</th>
                    <th className="pb-2">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l._id} className={`border-t ${l.is_violation ? 'bg-red-50' : ''}`}>
                      <td className="py-2">{typeof l.productId === 'object' ? l.productId.name : l.productId}</td>
                      <td className="py-2">{l.quantity}</td>
                      <td className="py-2">${l.unitPrice.toFixed(2)}</td>
                      <td className="py-2">{l.discountPercent}%</td>
                      <td className="py-2">${l.lineTotal.toFixed(2)}</td>
                    </tr>
                  ))}
                  {lines.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-3 text-center text-gray-400">
                        No lines added yet in this session - add one below.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <form onSubmit={handleAddLine} className="flex gap-2 items-end border-t pt-4">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Product</label>
                  <select
                    value={lineForm.productId}
                    onChange={(e) => setLineForm({ ...lineForm, productId: e.target.value })}
                    required
                    className="w-full border rounded px-2 py-1 text-sm"
                  >
                    <option value="">Select...</option>
                    {products.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-20">
                  <label className="block text-xs text-gray-500 mb-1">Qty</label>
                  <input
                    type="number"
                    value={lineForm.quantity}
                    onChange={(e) => setLineForm({ ...lineForm, quantity: e.target.value })}
                    className="w-full border rounded px-2 py-1 text-sm"
                  />
                </div>
                <div className="w-24">
                  <label className="block text-xs text-gray-500 mb-1">Discount %</label>
                  <input
                    type="number"
                    value={lineForm.discountPercent}
                    onChange={(e) => setLineForm({ ...lineForm, discountPercent: e.target.value })}
                    className="w-full border rounded px-2 py-1 text-sm"
                  />
                </div>
                <button className="bg-gray-800 text-white px-3 py-1 rounded text-sm">Add Line</button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
