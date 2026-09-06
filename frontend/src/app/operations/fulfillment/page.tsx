'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, CheckCircle2, PackageCheck, Plus, Route, Truck, X } from 'lucide-react';
import { api, ApiClientError } from '@/lib/api';
import {
  formatDateTime,
  formatStatus,
  fulfillmentCustomer,
  isOpenFulfillment,
  lineLabel,
  operationsStatusClass,
  quotationLabel,
  remainingQty,
  timeAgo,
  type Allocation,
  type Fulfillment,
  type FulfillmentDetail,
  type OrderDetail,
  type Warehouse,
} from '@/lib/operations';

type OverrideRow = { quote_line_id: string; warehouse_id: string; qty: string };
type ConfirmedQuotation = {
  id: string;
  quoteNumber: string;
  customer?: { name?: string; company?: string } | null;
  total?: number;
};

function warehouseName(warehouses: Warehouse[], id: string) {
  return warehouses.find((warehouse) => warehouse._id === id)?.name || `...${id.slice(-8)}`;
}

function AllocationBar({ allocation, total }: { allocation: Allocation; total: number }) {
  const width = total > 0 ? Math.max(8, Math.round((allocation.allocated_qty / total) * 100)) : 0;
  return (
    <div className="ops-allocation-row">
      <div className="ops-allocation-track">
        <span style={{ width: `${width}%` }} />
      </div>
      <strong>{allocation.allocated_qty} units</strong>
    </div>
  );
}

export default function FulfillmentPage() {
  const searchParams = useSearchParams();
  const [fulfillments, setFulfillments] = useState<Fulfillment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<FulfillmentDetail | null>(null);
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [newQuotationId, setNewQuotationId] = useState('');
  const [confirmedQuotations, setConfirmedQuotations] = useState<ConfirmedQuotation[]>([]);
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
      )
      .finally(() => setLoading(false));
  };

  const loadConfirmedQuotations = () => {
    api
      .get<{ quotations: ConfirmedQuotation[] }>('/quotations?status=CONFIRMED')
      .then((data) => setConfirmedQuotations(data.quotations || []))
      .catch(() => setConfirmedQuotations([]));
  };

  useEffect(() => {
    api.get<Warehouse[]>('/warehouses').then(setWarehouses).catch(() => {});
    loadConfirmedQuotations();
  }, []);

  const loadDetail = (id: string) => {
    api
      .get<FulfillmentDetail>(`/fulfillments/${id}`)
      .then((data) => {
        setDetail(data);
        const quotationId = typeof data.fulfillment.quotation_id === 'object'
          ? data.fulfillment.quotation_id?._id
          : data.fulfillment.quotation_id;
        if (quotationId) {
          api
            .get<OrderDetail>(`/orders/by-quotation/${quotationId}`)
            .then(setOrderDetail)
            .catch(() => setOrderDetail(null));
        } else {
          setOrderDetail(null);
        }
      })
      .catch((err) =>
        setError(err instanceof ApiClientError ? err.message : 'Failed to load detail')
      );
  };

  useEffect(loadList, []);
  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
  }, [selectedId]);

  // Coming from the Orders page's "Open fulfillment" link.
  useEffect(() => {
    const idFromUrl = searchParams.get('id');
    if (idFromUrl && idFromUrl !== selectedId) {
      setSelectedId(idFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const created = await api.post<Fulfillment>('/fulfillments', {
        quotation_id: newQuotationId,
      });
      setNewQuotationId('');
      loadList();
      loadConfirmedQuotations();
      setSelectedId(created._id);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to create fulfillment');
    }
  };

  const runAction = async (action: () => Promise<unknown>, successMessage?: string) => {
    setError(null);
    setInfo(null);
    try {
      await action();
      if (selectedId) loadDetail(selectedId);
      loadList();
      if (successMessage) setInfo(successMessage);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Action failed');
    }
  };

  const openOverride = () => {
    if (!detail) return;
    const rows: OverrideRow[] = [];
    for (const allocation of detail.allocations) {
      const lineId = allocation.quote_line_id?._id;
      if (!lineId) continue;
      rows.push({
        quote_line_id: lineId,
        warehouse_id: allocation.warehouse_id,
        qty: String(allocation.allocated_qty),
      });
    }
    setOverrideRows(rows.length > 0 ? rows : [{ quote_line_id: '', warehouse_id: '', qty: '' }]);
    setOverrideReason('');
    setShowOverride(true);
  };

  const lineName = (lineId: string) => {
    const allocation = detail?.allocations.find((item) => item.quote_line_id?._id === lineId);
    return allocation ? lineLabel(allocation) : lineId.slice(-6);
  };

  const submitOverride = async () => {
    if (!overrideReason.trim()) {
      setError('A reason is required for a manual override');
      return;
    }
    const allocations = overrideRows
      .filter((row) => row.quote_line_id && row.warehouse_id && row.qty)
      .map((row) => ({
        quote_line_id: row.quote_line_id,
        warehouse_id: row.warehouse_id,
        qty: Number(row.qty),
      }));

    await runAction(() =>
      api.post(`/fulfillments/${selectedId}/override`, {
        allocations,
        reason: overrideReason,
      })
    );
    setShowOverride(false);
  };

  const allocationTotal = useMemo(
    () => detail?.allocations.reduce((sum, allocation) => sum + Number(allocation.allocated_qty || 0), 0) || 0,
    [detail]
  );
  const shippedTotal = useMemo(
    () => detail?.allocations.reduce((sum, allocation) => sum + Number(allocation.shipped_qty || 0), 0) || 0,
    [detail]
  );
  const backorderTotal = useMemo(
    () => detail?.backorders.reduce((sum, backorder) => sum + Number(backorder.qty || 0), 0) || 0,
    [detail]
  );
  const requiredTotal = allocationTotal + backorderTotal;
  const shipmentCount = detail?.allocations.filter((allocation) => Number(allocation.shipped_qty || 0) > 0).length || 0;

  return (
    <div className="ops-page fulfillment-page">
      <div className="ops-page-heading fulfillment-page__header">
        <div>
          <p className="ops-eyebrow">Fulfillment</p>
          <h1>Warehouse allocation</h1>
          <p>Review order allocation, shortages, backorders, and shipment actions.</p>
        </div>
        <form onSubmit={handleCreate} className="ops-inline-create">
          <select
            value={newQuotationId}
            onChange={(e) => setNewQuotationId(e.target.value)}
            className="df-select"
            required
          >
            <option value="">Confirmed quotation...</option>
            {confirmedQuotations.map((quotation) => (
              <option key={quotation.id} value={quotation.id}>
                {quotation.quoteNumber} · {quotation.customer?.company || quotation.customer?.name || 'Customer'}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" disabled={!newQuotationId}>
            <Plus size={14} />
            Create fulfillment
          </button>
        </form>
      </div>

      {error && (
        <div className="df-alert df-alert-error">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}
      {info && (
        <div className="df-alert df-alert-success ops-success-alert">
          <span>
            <CheckCircle2 size={14} />
            {info}
          </span>
        </div>
      )}

      <div className="ops-detail-layout">
        <section className="ops-panel ops-panel-list">
          <div className="ops-panel-header">
            <div>
              <p className="ops-eyebrow">Queue</p>
              <h2>Fulfillment list</h2>
            </div>
            <span>{fulfillments.filter((item) => isOpenFulfillment(item.status)).length} open</span>
          </div>

          {loading ? (
            <div style={{ padding: '18px' }}>
              <div className="skeleton" style={{ height: 16, marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 16, width: '80%', marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 16, width: '60%' }} />
            </div>
          ) : fulfillments.length === 0 ? (
            <div className="df-empty">
              <Truck size={28} />
              <div className="df-empty-title">No fulfillments</div>
              <div className="df-empty-desc">Create one from a confirmed quotation ID.</div>
            </div>
          ) : (
            <div className="ops-table-wrap">
              <table className="df-table ops-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th>Allocation</th>
                    <th>Backorder</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {fulfillments.map((fulfillment) => (
                    <tr
                      key={fulfillment._id}
                      className={selectedId === fulfillment._id ? 'selected' : ''}
                      onClick={() => setSelectedId(fulfillment._id)}
                    >
                      <td>
                        <strong>...{fulfillment._id.slice(-8)}</strong>
                        <small>{quotationLabel(fulfillment.quotation_id)}</small>
                      </td>
                      <td>{fulfillmentCustomer(fulfillment)}</td>
                      <td>
                        <span className={`status-badge ${operationsStatusClass(fulfillment.status)}`}>
                          {formatStatus(fulfillment.status)}
                        </span>
                      </td>
                      <td>{selectedId === fulfillment._id && detail ? `${shippedTotal}/${allocationTotal} shipped` : 'Open detail'}</td>
                      <td>
                        {selectedId === fulfillment._id && backorderTotal > 0 ? (
                          <span className="ops-shortage">{backorderTotal} units</span>
                        ) : (
                          <span className="ops-muted">None shown</span>
                        )}
                      </td>
                      <td>{timeAgo(fulfillment.updated_at || fulfillment.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="ops-panel ops-panel-detail">
          {!detail ? (
            <div className="df-empty">
              <PackageCheck size={32} />
              <div className="df-empty-title">Select a fulfillment</div>
              <div className="df-empty-desc">Allocation details and shipment controls will appear here.</div>
            </div>
          ) : (
            <>
              <div className="ops-fulfillment-hero">
                <div>
                  <p className="ops-eyebrow">Selected fulfillment</p>
                  <h2>...{detail.fulfillment._id.slice(-8)}</h2>
                  <span>{formatDateTime(detail.fulfillment.updated_at || detail.fulfillment.created_at)}</span>
                </div>
                <span className={`status-badge ${operationsStatusClass(detail.fulfillment.status)}`}>
                  {formatStatus(detail.fulfillment.status)}
                </span>
              </div>

              {orderDetail && (
                <div className="df-alert df-alert-info" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <span>
                    Order <strong>{orderDetail.order.orderNumber}</strong> · {formatStatus(orderDetail.order.status)}
                    {' · billing '}
                    {formatStatus(orderDetail.order.billingStatus || 'PENDING')}
                  </span>
                  <Link className="btn btn-ghost btn-sm" href={`/operations/orders?id=${orderDetail.order._id}`}>
                    Open order
                  </Link>
                </div>
              )}

              <div className="ops-allocation-summary">
                <div>
                  <span>Units required</span>
                  <strong>{requiredTotal}</strong>
                </div>
                <div>
                  <span>Allocated</span>
                  <strong>{allocationTotal}</strong>
                </div>
                <div>
                  <span>Shipped</span>
                  <strong>{shippedTotal}</strong>
                </div>
                <div className={backorderTotal > 0 ? 'warning' : ''}>
                  <span>Backordered</span>
                  <strong>{backorderTotal}</strong>
                </div>
              </div>

              <div className="ops-action-row">
                <button onClick={() => runAction(() => api.post(`/fulfillments/${selectedId}/suggest`))} className="btn btn-secondary">
                  <Route size={14} />
                  Suggest split
                </button>
                <button onClick={() => runAction(() => api.post(`/fulfillments/${selectedId}/accept`))} className="btn btn-primary">
                  Accept recommended split
                </button>
                <button onClick={openOverride} className="btn btn-warning">
                  Manual override
                </button>
              </div>

              <div className="ops-subsection">
                <div className="ops-subsection-header">
                  <h3>Recommended allocation</h3>
                  <span>{shipmentCount} shipment{shipmentCount === 1 ? '' : 's'}</span>
                </div>
                {detail.allocations.length === 0 ? (
                  <div className="ops-empty-line">No allocations yet. Use suggest split to request an allocation.</div>
                ) : (
                  <div className="ops-allocation-list">
                    {detail.allocations.map((allocation) => (
                      <div className="ops-allocation-card" key={allocation._id}>
                        <div className="ops-allocation-card-head">
                          <div>
                            <strong>{warehouseName(warehouses, allocation.warehouse_id)}</strong>
                            <small>
                              {lineLabel(allocation)}
                              {allocation.est_cost !== undefined && ` · est. cost ${allocation.est_cost.toFixed(1)}`}
                            </small>
                          </div>
                          <span className={`status-badge ${operationsStatusClass(allocation.status)}`}>
                            {formatStatus(allocation.status)}
                          </span>
                        </div>
                        <AllocationBar allocation={allocation} total={allocationTotal} />
                        <div className="ops-ship-row">
                          <span>{remainingQty(allocation)} units remaining to ship</span>
                          <div>
                            <input
                              type="number"
                              className="df-input"
                              value={shipQty[allocation._id] || ''}
                              onChange={(e) => setShipQty({ ...shipQty, [allocation._id]: e.target.value })}
                              placeholder="Qty"
                              disabled={remainingQty(allocation) <= 0}
                            />
                            <button
                              onClick={() =>
                                runAction(() =>
                                  api.post(`/fulfillments/${selectedId}/ship`, {
                                    allocation_id: allocation._id,
                                    qty: Number(shipQty[allocation._id] || 0),
                                  })
                                )
                              }
                              className="btn btn-primary btn-sm"
                              disabled={remainingQty(allocation) <= 0}
                            >
                              Ship
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="ops-subsection">
                <div className="ops-subsection-header">
                  <h3>Backorder status</h3>
                  <span className={backorderTotal > 0 ? 'ops-shortage' : 'ops-muted'}>{backorderTotal} units</span>
                </div>
                {detail.backorders.length === 0 ? (
                  <div className="ops-empty-line">No backordered quantity is currently shown.</div>
                ) : (
                  <div className="ops-backorder-list">
                    {detail.backorders.map((backorder) => (
                      <div key={backorder._id}>
                        <strong>{backorder.qty} units</strong>
                        <span className={`status-badge ${operationsStatusClass(backorder.status)}`}>
                          {formatStatus(backorder.status)}
                        </span>
                        {backorder.status !== 'RESOLVED' && (
                          <button
                            onClick={() =>
                              runAction(
                                () => api.post(`/backorders/${backorder._id}/consolidate`),
                                'Backorder consolidated against current stock.'
                              )
                            }
                            className="btn btn-secondary btn-sm"
                          >
                            Consolidate
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      {showOverride && (
        <div className="df-modal-overlay" onClick={() => setShowOverride(false)}>
          <div className="df-modal df-modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="df-modal-header ops-modal-header">
              <div>
                <h2 className="df-modal-title">Manual warehouse override</h2>
                <p>Replaces the current split. Shortfalls become backorders.</p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowOverride(false)}>
                <X size={14} />
              </button>
            </div>
            <div className="df-modal-body">
              <div className="ops-override-rows">
                {overrideRows.map((row, idx) => (
                  <div key={idx} className="ops-override-row">
                    <span>{row.quote_line_id ? lineName(row.quote_line_id) : 'Line'}</span>
                    <select
                      value={row.warehouse_id}
                      onChange={(e) => {
                        const next = [...overrideRows];
                        next[idx] = { ...row, warehouse_id: e.target.value };
                        setOverrideRows(next);
                      }}
                      className="df-select"
                    >
                      <option value="">Warehouse...</option>
                      {warehouses.map((warehouse) => (
                        <option key={warehouse._id} value={warehouse._id}>
                          {warehouse.name}
                        </option>
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
                    />
                    <button onClick={() => setOverrideRows(overrideRows.filter((_, i) => i !== idx))} className="btn btn-ghost btn-sm">
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={() =>
                  setOverrideRows([
                    ...overrideRows,
                    { quote_line_id: overrideRows[0]?.quote_line_id || '', warehouse_id: '', qty: '' },
                  ])
                }
                className="btn btn-ghost btn-sm"
              >
                <Plus size={12} />
                Add allocation row
              </button>

              <div className="df-field ops-reason-field">
                <label className="df-label">Reason</label>
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
                Apply override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
