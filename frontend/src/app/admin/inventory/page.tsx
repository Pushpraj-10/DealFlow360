'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';

type Inventory = {
  _id: string;
  sku: string;
  on_hand: number;
  reserved: number;
  available: number;
  warehouse_id: { _id: string; name: string } | string;
};

export default function InventoryPage() {
  const [rows, setRows] = useState<Inventory[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Inventory[]>('/inventory')
      .then(setRows)
      .catch((err) => setError(err instanceof ApiClientError ? err.message : 'Failed to load inventory'));
  }, []);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Inventory Management</h1>

      {error && <div className="mb-4 px-3 py-2 bg-red-50 text-red-700 text-sm rounded border border-red-200">{error}</div>}

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-gray-600">
              <th className="pb-2">SKU</th>
              <th className="pb-2">Warehouse</th>
              <th className="pb-2">On Hand</th>
              <th className="pb-2">Reserved</th>
              <th className="pb-2">Available</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((inv) => (
              <tr key={inv._id} className="border-b">
                <td className="py-3 font-medium">{inv.sku}</td>
                <td className="py-3">{typeof inv.warehouse_id === 'object' ? inv.warehouse_id.name : inv.warehouse_id}</td>
                <td className="py-3">{inv.on_hand}</td>
                <td className="py-3">{inv.reserved}</td>
                <td className={`py-3 font-bold ${inv.available < 0 ? 'text-red-600' : 'text-green-600'}`}>{inv.available}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-gray-500">
                  No inventory yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
