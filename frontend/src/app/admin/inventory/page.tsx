'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import { AlertCircle, Boxes } from 'lucide-react';

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
      .catch((err) =>
        setError(err instanceof ApiClientError ? err.message : 'Failed to load inventory')
      );
  }, []);

  return (
    <div className="df-page">
      <div className="df-page-header">
        <div>
          <h1 className="df-page-title">Inventory</h1>
          <p className="df-page-subtitle">{rows.length} SKU{rows.length !== 1 ? 's' : ''} across all warehouses</p>
        </div>
      </div>

      {error && (
        <div className="df-alert df-alert-error">
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      <div className="df-card">
        {rows.length === 0 ? (
          <div className="df-empty">
            <Boxes size={28} style={{ margin: '0 auto 10px', color: 'var(--text-tertiary)' }} />
            <div className="df-empty-title">No inventory records</div>
            <div className="df-empty-desc">Inventory appears here once products are stocked in warehouses.</div>
          </div>
        ) : (
          <table className="df-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Warehouse</th>
                <th style={{ textAlign: 'right' }}>On Hand</th>
                <th style={{ textAlign: 'right' }}>Reserved</th>
                <th style={{ textAlign: 'right' }}>Available</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((inv) => {
                const low = inv.available <= 0;
                return (
                  <tr key={inv._id}>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 500, fontSize: 13 }}>
                        {inv.sku}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {typeof inv.warehouse_id === 'object'
                        ? inv.warehouse_id.name
                        : inv.warehouse_id}
                    </td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {inv.on_hand}
                    </td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>
                      {inv.reserved}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span
                        style={{
                          fontVariantNumeric: 'tabular-nums',
                          fontWeight: 600,
                          color: low ? 'var(--red)' : inv.available < 10 ? 'var(--amber)' : 'var(--green)',
                        }}
                      >
                        {inv.available}
                      </span>
                      {low && (
                        <span
                          style={{
                            marginLeft: 6,
                            fontSize: 10,
                            background: 'var(--red-light)',
                            color: 'var(--red)',
                            border: '1px solid var(--red-muted)',
                            padding: '1px 5px',
                            borderRadius: 3,
                            fontWeight: 500,
                          }}
                        >
                          shortage
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
