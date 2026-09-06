'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, PackageCheck, RefreshCw, RotateCcw } from 'lucide-react';
import { api, ApiClientError } from '@/lib/api';
import {
  formatStatus,
  fulfillmentIdFromOrder,
  money,
  operationsStatusClass,
  orderCustomer,
  orderLineLabel,
  orderQuotation,
  timeAgo,
  type Order,
  type OrderDetail,
} from '@/lib/operations';

const STATUS_FILTERS = [
  { value: '', label: 'All orders' },
  { value: 'FLOW_FAILED', label: 'Needs retry' },
  { value: 'SPLIT_PROPOSED', label: 'Split proposed' },
  { value: 'RESERVED', label: 'Reserved' },
  { value: 'PARTIAL_BACKORDER', label: 'Backordered' },
  { value: 'PARTIALLY_SHIPPED', label: 'Shipping' },
  { value: 'COMPLETED', label: 'Completed' },
];

export default function OrdersPage() {
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('id'));
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [acting, setActing] = useState(false);

  const applyOrderList = (data: { orders: Order[] }) => {
    setOrders(data.orders || []);
    setSelectedId((current) => current || data.orders?.[0]?._id || null);
  };

  const loadOrders = () => {
    setLoading(true);
    api
      .get<{ orders: Order[] }>('/orders')
      .then(applyOrderList)
      .catch((err) => setError(err instanceof ApiClientError ? err.message : 'Failed to load orders'))
      .finally(() => setLoading(false));
  };

  const loadDetail = (orderId: string) => {
    queueMicrotask(() => {
      if (mounted) setDetailLoading(true);
    });
    api
      .get<OrderDetail>(`/orders/${orderId}`)
      .then(setDetail)
      .catch((err) => setError(err instanceof ApiClientError ? err.message : 'Failed to load order detail'))
      .finally(() => setDetailLoading(false));
  };

  useEffect(() => {
    let mounted = true;

    api
      .get<{ orders: Order[] }>('/orders')
      .then((data) => {
        if (!mounted) return;
        applyOrderList(data);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof ApiClientError ? err.message : 'Failed to load orders');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let mounted = true;

    api
      .get<OrderDetail>(`/orders/${selectedId}`)
      .then((data) => {
        if (mounted) setDetail(data);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof ApiClientError ? err.message : 'Failed to load order detail');
      })
      .finally(() => {
        if (mounted) setDetailLoading(false);
      });

    queueMicrotask(() => {
      if (mounted) setDetailLoading(true);
    });

    return () => {
      mounted = false;
    };
  }, [selectedId]);

  const filteredOrders = useMemo(() => {
    if (!statusFilter) return orders;
    return orders.filter((order) => order.status === statusFilter);
  }, [orders, statusFilter]);

  const selectedOrder = detail?.order || orders.find((order) => order._id === selectedId) || null;
  const fulfillmentId = fulfillmentIdFromOrder(selectedOrder);

  const runOrderAction = async (action: 'retry-flow' | 'sync-status') => {
    if (!selectedId) return;
    setError(null);
    setActing(true);
    try {
      await api.post(`/orders/${selectedId}/${action}`);
      loadOrders();
      loadDetail(selectedId);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Order action failed');
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="ops-page orders-page">
      <div className="ops-page-heading">
        <div>
          <p className="ops-eyebrow">Operations</p>
          <h1>Orders</h1>
          <p>Track confirmed quotes as they move through inventory, fulfillment, backorders, shipment, and billing.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <select className="df-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            {STATUS_FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>{filter.label}</option>
            ))}
          </select>
          <button className="btn btn-secondary" onClick={loadOrders}>
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="df-alert df-alert-error">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      <div className="ops-detail-layout">
        <section className="ops-panel ops-panel-list">
          <div className="ops-panel-header">
            <div>
              <p className="ops-eyebrow">Queue</p>
              <h2>Order flow</h2>
            </div>
            <span>{filteredOrders.length} shown</span>
          </div>

          {loading ? (
            <div style={{ padding: 18 }}>
              <div className="skeleton" style={{ height: 16, marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 16, width: '78%', marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 16, width: '58%' }} />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="df-empty">
              <PackageCheck size={30} />
              <div className="df-empty-title">No orders yet</div>
              <div className="df-empty-desc">Confirmed quotations will create orders automatically.</div>
            </div>
          ) : (
            <div className="ops-table-wrap">
              <table className="df-table ops-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th>Billing</th>
                    <th>Total</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr
                      key={order._id}
                      className={selectedId === order._id ? 'selected' : ''}
                      onClick={() => setSelectedId(order._id)}
                    >
                      <td>
                        <strong>{order.orderNumber}</strong>
                        <small>{orderQuotation(order)} · v{order.quotationVersion}</small>
                      </td>
                      <td>{orderCustomer(order)}</td>
                      <td>
                        <span className={`status-badge ${operationsStatusClass(order.status)}`}>
                          {formatStatus(order.status)}
                        </span>
                      </td>
                      <td>{formatStatus(order.billingStatus || 'PENDING')}</td>
                      <td>{money(order.grandTotal, order.currencyCode || 'USD')}</td>
                      <td>{timeAgo(order.updatedAt || order.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="ops-panel ops-panel-detail">
          {detailLoading ? (
            <div style={{ padding: 18 }}>
              <div className="skeleton" style={{ height: 24, marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 120 }} />
            </div>
          ) : !selectedOrder ? (
            <div className="df-empty">
              <PackageCheck size={32} />
              <div className="df-empty-title">Select an order</div>
              <div className="df-empty-desc">Order lines and retry controls will appear here.</div>
            </div>
          ) : (
            <>
              <div className="ops-fulfillment-hero">
                <div>
                  <p className="ops-eyebrow">Selected order</p>
                  <h2>{selectedOrder.orderNumber}</h2>
                  <span>{orderCustomer(selectedOrder)} · {orderQuotation(selectedOrder)}</span>
                </div>
                <span className={`status-badge ${operationsStatusClass(selectedOrder.status)}`}>
                  {formatStatus(selectedOrder.status)}
                </span>
              </div>

              {selectedOrder.flow?.lastError && (
                <div className="df-alert df-alert-warning">
                  <AlertCircle size={14} />
                  <span>{selectedOrder.flow.lastFailedStage}: {selectedOrder.flow.lastError}</span>
                </div>
              )}

              <div className="ops-action-row">
                <button className="btn btn-secondary" disabled={acting} onClick={() => runOrderAction('sync-status')}>
                  <RefreshCw size={14} />
                  Sync status
                </button>
                <button className="btn btn-primary" disabled={acting} onClick={() => runOrderAction('retry-flow')}>
                  <RotateCcw size={14} />
                  Retry flow
                </button>
                {fulfillmentId && (
                  <Link className="btn btn-ghost" href={`/operations/fulfillment?id=${fulfillmentId}`}>
                    Open fulfillment
                  </Link>
                )}
                <Link className="btn btn-ghost" href="/finance/invoices">
                  View invoices
                </Link>
              </div>

              <div className="ops-allocation-summary">
                <div>
                  <span>Lines</span>
                  <strong>{detail?.lines.length || 0}</strong>
                </div>
                <div>
                  <span>Allocated</span>
                  <strong>{detail?.lines.reduce((sum, line) => sum + Number(line.allocatedQty || 0), 0) || 0}</strong>
                </div>
                <div>
                  <span>Shipped</span>
                  <strong>{detail?.lines.reduce((sum, line) => sum + Number(line.shippedQty || 0), 0) || 0}</strong>
                </div>
                <div>
                  <span>Backordered</span>
                  <strong>{detail?.lines.reduce((sum, line) => sum + Number(line.backorderQty || 0), 0) || 0}</strong>
                </div>
              </div>

              <div className="ops-subsection">
                <div className="ops-subsection-header">
                  <h3>Order lines</h3>
                  <span>{formatStatus(selectedOrder.fulfillmentStatus || 'No fulfillment')}</span>
                </div>
                {!detail?.lines.length ? (
                  <div className="ops-empty-line">No order lines returned.</div>
                ) : (
                  <div className="ops-allocation-list">
                    {detail.lines.map((line) => (
                      <div className="ops-allocation-card" key={line._id}>
                        <div className="ops-allocation-card-head">
                          <div>
                            <strong>{orderLineLabel(line)}</strong>
                            <small>{line.lineType} · requested {line.requestedQty}</small>
                          </div>
                          <span className={`status-badge ${operationsStatusClass(line.status)}`}>
                            {formatStatus(line.status)}
                          </span>
                        </div>
                        <div className="ops-allocation-summary" style={{ marginTop: 12 }}>
                          <div><span>Allocated</span><strong>{line.allocatedQty}</strong></div>
                          <div><span>Backorder</span><strong>{line.backorderQty}</strong></div>
                          <div><span>Shipped</span><strong>{line.shippedQty}</strong></div>
                          <div><span>Invoiced</span><strong>{line.invoicedQty}</strong></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
