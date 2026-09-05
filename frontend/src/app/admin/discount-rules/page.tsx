'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import { AlertCircle, BadgePercent, Search } from 'lucide-react';

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
      const data = await api.get(
        `/discount-rules/allowed-discount?customerId=${customerId}&productId=${productId}`
      );
      setResult(data);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Lookup failed');
    }
  };

  const resultObj = result as Record<string, unknown> | null;

  return (
    <div className="df-page">
      <div className="df-page-header">
        <div>
          <h1 className="df-page-title">Discount Rule Lookup</h1>
          <p className="df-page-subtitle">
            Check the maximum allowed discount for a customer/product pair
          </p>
        </div>
      </div>

      {error && (
        <div className="df-alert df-alert-error">
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      <div style={{ maxWidth: 600 }}>
        <div className="df-card" style={{ marginBottom: 16 }}>
          <div className="df-card-header">
            <span style={{ fontSize: 13, fontWeight: 600 }}>Lookup Allowed Discount</span>
          </div>
          <div className="df-card-body">
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
              The allowed discount blends the customer tier ceiling with the product category ceiling.
              The more restrictive of the two applies.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div className="df-field" style={{ marginBottom: 0 }}>
                <label className="df-label">Customer</label>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="df-select"
                >
                  <option value="">Select customer…</option>
                  {customers.map((c) => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="df-field" style={{ marginBottom: 0 }}>
                <label className="df-label">Product</label>
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="df-select"
                >
                  <option value="">Select product…</option>
                  {products.map((p) => (
                    <option key={p._id} value={p._id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              onClick={lookup}
              disabled={!customerId || !productId}
              className="btn btn-primary"
              style={{ gap: 7 }}
            >
              <Search size={13} />
              Check Allowed Discount
            </button>
          </div>
        </div>

        {resultObj != null && (
          <div className="df-card">
            <div className="df-card-header">
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600 }}>
                <BadgePercent size={14} color="var(--accent)" />
                Result
              </span>
            </div>
            <div className="df-card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.entries(resultObj).map(([key, value]) => (
                  <div
                    key={key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 0',
                      borderBottom: '1px solid var(--border)',
                      fontSize: 13,
                    }}
                  >
                    <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                      {key.replace(/_/g, ' ')}
                    </span>
                    <span
                      style={{
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        fontVariantNumeric: 'tabular-nums',
                        fontFamily: typeof value === 'number' ? 'monospace' : 'inherit',
                      }}
                    >
                      {typeof value === 'number'
                        ? `${value}%`
                        : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
