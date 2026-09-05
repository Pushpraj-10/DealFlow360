'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';

type Fulfillment = { _id: string; quotation_id: string; status: string; created_at: string };
type Allocation = {
  _id: string;
  warehouse_id: string;
  allocated_qty: number;
  shipped_qty: number;
  status: string;
  quote_line_id?: { productId?: { name?: string }; variantId?: { sku?: string } };
};
type Backorder = { _id: string; qty: number; status: string };
type Detail = { fulfillment: Fulfillment; allocations: Allocation[]; backorders: Backorder[] };

export default function FulfillmentPage() {
  const [fulfillments, setFulfillments] = useState<Fulfillment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newQuotationId, setNewQuotationId] = useState('');
  const [shipQty, setShipQty] = useState<Record<string, string>>({});

  const loadList = () => {
    api
      .get<Fulfillment[]>('/fulfillments')
      .then(setFulfillments)
      .catch((err) => setError(err instanceof ApiClientError ? err.message : 'Failed to load fulfillments'));
  };

  const loadDetail = (id: string) => {
    api
      .get<Detail>(`/fulfillments/${id}`)
      .then(setDetail)
      .catch((err) => setError(err instanceof ApiClientError ? err.message : 'Failed to load detail'));
  };

  useEffect(loadList, []);
  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
  }, [selectedId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const created = await api.post<Fulfillment>('/fulfillments', { quotation_id: newQuotationId });
      setNewQuotationId('');
      loadList();
      setSelectedId(created._id);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to create fulfillment');
    }
  };

  const runAction = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
      if (selectedId) loadDetail(selectedId);
      loadList();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Action failed');
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Fulfillment & Warehouse Split</h1>
      </div>

      {error && <div className="mb-4 px-3 py-2 bg-red-50 text-red-700 text-sm rounded border border-red-200">{error}</div>}

      <form onSubmit={handleCreate} className="flex gap-2 mb-6">
        <input
          value={newQuotationId}
          onChange={(e) => setNewQuotationId(e.target.value)}
          placeholder="Quotation ID"
          className="border rounded px-3 py-2 text-sm flex-1"
        />
        <button className="bg-blue-600 text-white px-4 py-2 rounded text-sm">Create Fulfillment</button>
      </form>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 col-span-1">
          <h2 className="text-sm uppercase text-gray-500 font-bold mb-3">Fulfillments</h2>
          <ul className="space-y-1 text-sm">
            {fulfillments.map((f) => (
              <li key={f._id}>
                <button
                  onClick={() => setSelectedId(f._id)}
                  className={`w-full text-left px-2 py-2 rounded hover:bg-gray-100 ${selectedId === f._id ? 'bg-blue-50 text-blue-700' : ''}`}
                >
                  <div className="font-medium">{f._id.slice(-6)}</div>
                  <div className="text-xs text-gray-500">{f.status}</div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="col-span-2">
          {!detail && <p className="text-gray-500">Select a fulfillment.</p>}
          {detail && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-800">Status: {detail.fulfillment.status}</h2>
                <div className="space-x-2">
                  <button
                    onClick={() => runAction(() => api.post(`/fulfillments/${selectedId}/suggest`))}
                    className="px-3 py-1 bg-gray-800 text-white rounded text-sm"
                  >
                    Suggest Split
                  </button>
                  <button
                    onClick={() => runAction(() => api.post(`/fulfillments/${selectedId}/accept`))}
                    className="px-3 py-1 bg-green-600 text-white rounded text-sm"
                  >
                    Accept Suggested Split
                  </button>
                </div>
              </div>

              <table className="w-full text-left text-sm mb-6">
                <thead>
                  <tr className="border-b text-gray-600">
                    <th className="pb-2">Product</th>
                    <th className="pb-2">Warehouse</th>
                    <th className="pb-2">Allocated</th>
                    <th className="pb-2">Shipped</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Ship</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.allocations.map((a) => (
                    <tr key={a._id} className="border-t">
                      <td className="py-2">{a.quote_line_id?.productId?.name || a.quote_line_id?.variantId?.sku || '-'}</td>
                      <td className="py-2">{a.warehouse_id}</td>
                      <td className="py-2">{a.allocated_qty}</td>
                      <td className="py-2">{a.shipped_qty}</td>
                      <td className="py-2">{a.status}</td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <input
                            type="number"
                            className="w-16 border rounded px-1 text-xs"
                            value={shipQty[a._id] || ''}
                            onChange={(e) => setShipQty({ ...shipQty, [a._id]: e.target.value })}
                          />
                          <button
                            onClick={() =>
                              runAction(() =>
                                api.post(`/fulfillments/${selectedId}/ship`, {
                                  allocation_id: a._id,
                                  qty: Number(shipQty[a._id] || 0),
                                })
                              )
                            }
                            className="text-blue-600 hover:underline text-xs"
                          >
                            Ship
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {detail.backorders.length > 0 && (
                <div>
                  <h3 className="text-sm uppercase text-gray-500 font-bold mb-2">Backorders</h3>
                  <ul className="text-sm space-y-1">
                    {detail.backorders.map((b) => (
                      <li key={b._id} className="flex justify-between border-b py-1">
                        <span>Qty {b.qty}</span>
                        <span className="text-red-600">{b.status}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
