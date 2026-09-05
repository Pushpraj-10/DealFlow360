'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';

type Customer = { _id: string; name: string };
type Product = { _id: string; name: string };

export default function DiscountRulesPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [productId, setProductId] = useState('');
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ customers: Customer[] }>('/customers').then((d) => setCustomers(d.customers)).catch(() => {});
    api.get<{ products: Product[] }>('/products').then((d) => setProducts(d.products)).catch(() => {});
  }, []);

  const lookup = async () => {
    setError(null);
    setResult(null);
    try {
      const data = await api.get(`/discount-rules/allowed-discount?customerId=${customerId}&productId=${productId}`);
      setResult(data);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Lookup failed');
    }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Discount Rule Lookup</h1>
      <p className="text-sm text-gray-500 mb-6">
        Check the max allowed discount for a customer/product pair, blending the customer&apos;s tier ceiling with the
        product&apos;s category ceiling.
      </p>

      {error && <div className="mb-4 px-3 py-2 bg-red-50 text-red-700 text-sm rounded border border-red-200">{error}</div>}

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Customer</label>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="w-full border rounded px-3 py-2">
              <option value="">Select...</option>
              {customers.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Product</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className="w-full border rounded px-3 py-2">
              <option value="">Select...</option>
              {products.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button onClick={lookup} disabled={!customerId || !productId} className="bg-blue-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50">
          Check Allowed Discount
        </button>

        {result != null && (
          <pre className="mt-4 bg-gray-50 p-4 rounded text-sm overflow-x-auto">{JSON.stringify(result, null, 2)}</pre>
        )}
      </div>
    </div>
  );
}
