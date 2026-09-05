'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import { AlertCircle, CheckCircle2, Truck, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

type Fulfillment = { _id: string; quotation_id: string; status: string; created_at: string };
type Allocation = {
  _id: string;
  warehouse_id: string;
  allocated_qty: number;
  shipped_qty: number;
  status: string;
  quote_line_id?: { _id: string; productId?: { name?: string }; variantId?: { sku?: string } };
};
type Backorder = { _id: string; qty: number; status: string };
type Detail = { fulfillment: Fulfillment; allocations: Allocation[]; backorders: Backorder[] };
type Warehouse = { _id: string; name: string };
type OverrideRow = { quote_line_id: string; warehouse_id: string; qty: string };

function getStatusClass(status: string): string {
  const s = status?.toLowerCase() ?? '';
  if (s === 'pending') return 'status-pending';
  if (s === 'allocated') return 'status-approved';
  if (s === 'shipped' || s === 'fulfilled') return 'status-confirmed';
  if (s === 'backordered') return 'status-returned';
  return 'status-draft';
}

export default function FulfillmentPage() {
  const router = useRouter();
  const [fulfillments, setFulfillments] = useState<Fulfillment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [newQuotationId, setNewQuotationId] = useState('');
  const [shipQty, setShipQty] = useState<Record<string, string>>({});
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [showOverride, setShowOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideRows, setOverrideRows] = useState<OverrideRow[]>([]);

  const loadList = () => {
    api
      .get<Fulfillment[]>('/fulfillments')
      .then(setFulfillments)
      .catch((err) =>
        setError(err instanceof ApiClientError ? err.message : 'Failed to load fulfillments')
      );
  };

  useEffect(() => {
    api.get<Warehouse[]>('/warehouses').then(setWarehouses).catch(() => {});
  }, []);

  const loadDetail = (id: string) => {
    api
      .get<Detail>(`/fulfillments/${id}`)
      .then(setDetail)
      .catch((err) =>
        setError(err instanceof ApiClientError ? err.message : 'Failed to load detail')
      );
  };

  useEffect(loadList, []);
  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
  }, [selectedId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const created = await api.post<Fulfillment>('/fulfillments', {
        quotation_id: newQuotationId,
      });
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

  const warehouseName = (id: string) => warehouses.find((w) => w._id === id)?.name || id.slice(-8);

  const generateInvoice = async (allocationId: string) => {
    setError(null);
    setInfo(null);
    try {
      const invoice = await api.post<{ invoice_no: string }>('/invoices', {
        source_type: 'shipment',
        fulfillment_allocation_id: allocationId,
      });
      setInfo(`Invoice ${invoice.invoice_no} generated for the shipped quantity.`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to generate invoice');
    }
  };

  const openOverride = () => {
    if (!detail) return;
    const rows: OverrideRow[] = [];
    for (const a of detail.allocations) {
      const lineId = a.quote_line_id?._id;
      if (!lineId) continue;
      rows.push({
        quote_line_id: lineId,
        warehouse_id: a.warehouse_id,
        qty: String(a.allocated_qty),
      });
    }
    setOverrideRows(rows.length > 0 ? rows : [{ quote_line_id: '', warehouse_id: '', qty: '' }]);
    setOverrideReason('');
    setShowOverride(true);
  };

  const lineLabel = (lineId: string) => {
    const alloc = detail?.allocations.find((a) => a.quote_line_id?._id === lineId);
    return (
      alloc?.quote_line_id?.productId?.name ||
      alloc?.quote_line_id?.variantId?.sku ||
      lineId.slice(-6)
    );
  };

  const submitOverride = async () => {
    if (!overrideReason.trim()) {
      setError('A reason is required for a manual override');
      return;
    }
    const allocations = overrideRows
      .filter((r) => r.quote_line_id && r.warehouse_id && r.qty)
      .map((r) => ({
        quote_line_id: r.quote_line_id,
        warehouse_id: r.warehouse_id,
        qty: Number(r.qty),
      }));

    await runAction(() =>
      api.post(`/fulfillments/${selectedId}/override`, {
        allocations,
        reason: overrideReason,
      })
    );
    setShowOverride(false);
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 52px)', overflow: 'hidden' }}>
      {/* Left sidebar — fulfillment list */}
      <div
        style={{
          width: 260,
          flexShrink: 0,
          background: 'var(--surface-01)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
            Fulfillments
          </div>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input
              value={newQuotationId}
              onChange={(e) => setNewQuotationId(e.target.value)}
              placeholder="Quotation ID"
              className="df-input"
            />
            <button className="btn btn-secondary btn-sm" style={{ justifyContent: 'center' }}>
              <Plus size={12} />
              Create Fulfillment
            </button>
          </form>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {fulfillments.length === 0 && (
            <div className="df-empty" style={{ padding: '24px 16px' }}>
              <Truck size={24} style={{ margin: '0 auto 8px', color: 'var(--text-tertiary)' }} />
              <div className="df-empty-title" style={{ fontSize: 13 }}>No fulfillments</div>
            </div>
          )}
          {fulfillments.map((f) => (
            <button
              key={f._id}
              onClick={() => setSelectedId(f._id)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '10px 16px',
                border: 'none',
                borderBottom: '1px solid var(--border)',
                background: selectedId === f._id ? 'var(--accent-light)' : 'transparent',
                cursor: 'pointer',
                transition: 'background 100ms',
              }}
              onMouseEnter={(e) => {
                if (selectedId !== f._id)
                  (e.currentTarget as HTMLElement).style.background = 'var(--surface-02)';
              }}
              onMouseLeave={(e) => {
                if (selectedId !== f._id)
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              <div style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color: selectedId === f._id ? 'var(--accent)' : 'var(--text-primary)', marginBottom: 3 }}>
                …{f._id.slice(-8)}
              </div>
              <span className={`status-badge ${getStatusClass(f.status)}`} style={{ fontSize: 10 }}>
                {f.status}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Right — detail */}
      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
        {error && (
          <div className="df-alert df-alert-error" style={{ margin: '16px 24px 0' }}>
            <AlertCircle size={14} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}
        {info && (
          <div className="df-alert df-alert-success" style={{ margin: '16px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
              {info}
            </span>
            <button onClick={() => router.push('/finance/invoices')} className="btn btn-ghost btn-sm" style={{ color: 'var(--accent)' }}>
              View Invoices
            </button>
          </div>
        )}

        {!detail && (
          <div className="df-empty" style={{ paddingTop: 80 }}>
            <Truck size={32} style={{ margin: '0 auto 12px', color: 'var(--text-tertiary)' }} />
            <div className="df-empty-title">Select a fulfillment</div>
            <div className="df-empty-desc">Or create one by entering a quotation ID.</div>
          </div>
        )}

        {detail && (
          <div style={{ padding: '24px' }}>
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 20,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h1 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Fulfillment
                </h1>
                <span className={`status-badge ${getStatusClass(detail.fulfillment.status)}`}>
                  {detail.fulfillment.status}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() =>
                    runAction(() => api.post(`/fulfillments/${selectedId}/suggest`))
                  }
                  className="btn btn-secondary"
                >
                  Suggest Split
                </button>
                <button
                  onClick={() =>
                    runAction(() => api.post(`/fulfillments/${selectedId}/accept`))
                  }
                  className="btn btn-success"
                >
                  Accept Split
                </button>
                <button onClick={openOverride} className="btn btn-warning">
                  Manual Override
                </button>
              </div>
            </div>

            {/* Allocations table */}
            <div className="df-card" style={{ marginBottom: 16 }}>
              <div className="df-card-header">
                <span style={{ fontSize: 13, fontWeight: 600 }}>Warehouse Allocations</span>
              </div>
              <table className="df-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Warehouse</th>
                    <th style={{ textAlign: 'right' }}>Allocated</th>
                    <th style={{ textAlign: 'right' }}>Shipped</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Ship</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {detail.allocations.map((a) => (
                    <tr key={a._id}>
                      <td style={{ fontWeight: 500 }}>
                        {a.quote_line_id?.productId?.name ||
                          a.quote_line_id?.variantId?.sku ||
                          '—'}
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                        {warehouseName(a.warehouse_id)}
                      </td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{a.allocated_qty}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>
                        {a.shipped_qty}
                      </td>
                      <td>
                        <span className={`status-badge ${getStatusClass(a.status)}`}>{a.status}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center' }}>
                          <input
                            type="number"
                            className="df-input"
                            style={{ width: 60, textAlign: 'right', padding: '4px 6px', fontSize: 12 }}
                            value={shipQty[a._id] || ''}
                            onChange={(e) =>
                              setShipQty({ ...shipQty, [a._id]: e.target.value })
                            }
                            placeholder="qty"
                            disabled={a.allocated_qty - a.shipped_qty <= 0}
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
                            className="btn btn-primary btn-sm"
                            disabled={a.allocated_qty - a.shipped_qty <= 0}
                          >
                            Ship
                          </button>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {a.shipped_qty > 0 && (
                          <button
                            onClick={() => generateInvoice(a._id)}
                            className="btn btn-ghost btn-sm"
                            style={{ color: 'var(--accent)', fontSize: 12 }}
                          >
                            Generate Invoice
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {detail.allocations.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-tertiary)', fontSize: 13 }}>
                        No allocations yet — click &quot;Suggest Split&quot; to allocate inventory.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Backorders */}
            {detail.backorders.length > 0 && (
              <div className="df-card">
                <div className="df-card-header">
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--amber)' }}>
                    Backorders
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    {detail.backorders.length} item{detail.backorders.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <table className="df-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'right' }}>Quantity</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.backorders.map((b) => (
                      <tr key={b._id}>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--amber)' }}>
                          {b.qty}
                        </td>
                        <td>
                          <span className="status-badge status-returned">{b.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Override Modal */}
      {showOverride && (
        <div className="df-modal-overlay" onClick={() => setShowOverride(false)}>
          <div
            className="df-modal df-modal-wide"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div className="df-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0, paddingBottom: 12 }}>
              <div>
                <h2 className="df-modal-title">Manual Warehouse Override</h2>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                  Replaces the current split. Shortfalls become backorders.
                </p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowOverride(false)}>
                <X size={14} />
              </button>
            </div>
            <div className="df-modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16, maxHeight: 260, overflowY: 'auto' }}>
                {overrideRows.map((row, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span
                      style={{
                        fontSize: 12,
                        color: 'var(--text-secondary)',
                        width: 80,
                        flexShrink: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {row.quote_line_id ? lineLabel(row.quote_line_id) : 'Line'}
                    </span>
                    <select
                      value={row.warehouse_id}
                      onChange={(e) => {
                        const next = [...overrideRows];
                        next[idx] = { ...row, warehouse_id: e.target.value };
                        setOverrideRows(next);
                      }}
                      className="df-select"
                      style={{ flex: 1 }}
                    >
                      <option value="">Warehouse…</option>
                      {warehouses.map((w) => (
                        <option key={w._id} value={w._id}>{w.name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={row.qty}
                      onChange={(e) => {
                        const next = [...overrideRows];
                        next[idx] = { ...row, qty: e.target.value };
                        setOverrideRows(next);
                      }}
                      placeholder="Qty"
                      className="df-input"
                      style={{ width: 70 }}
                    />
                    <button
                      onClick={() => setOverrideRows(overrideRows.filter((_, i) => i !== idx))}
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--red)', flexShrink: 0 }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={() =>
                  setOverrideRows([
                    ...overrideRows,
                    {
                      quote_line_id: overrideRows[0]?.quote_line_id || '',
                      warehouse_id: '',
                      qty: '',
                    },
                  ])
                }
                className="btn btn-ghost btn-sm"
                style={{ marginBottom: 16, color: 'var(--accent)' }}
              >
                <Plus size={12} />
                Add allocation row
              </button>

              <div className="df-field" style={{ marginBottom: 0 }}>
                <label className="df-label">
                  Reason <span style={{ color: 'var(--red)' }}>*</span>
                </label>
                <input
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="df-input"
                  placeholder="Why are you overriding the suggested split?"
                />
              </div>
            </div>
            <div className="df-modal-footer">
              <button onClick={() => setShowOverride(false)} className="btn btn-ghost">
                Cancel
              </button>
              <button onClick={submitOverride} className="btn btn-warning">
                Apply Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
