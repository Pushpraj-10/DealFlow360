'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarClock, RefreshCw, X } from 'lucide-react';
import { api, ApiClientError } from '@/lib/api';
import {
  customerLabel,
  formatDate,
  formatStatus,
  moneyCents,
  operationsStatusClass,
  planInterval,
  planName,
  type Subscription,
} from '@/lib/operations';

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Subscription | null>(null);
  const [modifyTarget, setModifyTarget] = useState<Subscription | null>(null);
  const [newQty, setNewQty] = useState(1);
  const [prorationPreview, setProrationPreview] = useState<number | null>(null);

  const load = () => {
    api.get<Subscription[]>('/subscriptions').then(setSubs).catch((err) =>
      setError(err instanceof ApiClientError ? err.message : 'Failed to load subscriptions')
    ).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openModify = (sub: Subscription) => {
    setSelected(sub);
    setModifyTarget(sub);
    setNewQty(sub.qty);
    setProrationPreview(null);
  };

  useEffect(() => {
    if (!modifyTarget) return;
    api
      .get<{ proratedDeltaCents: number }>(`/billing/prorate?subscriptionId=${modifyTarget._id}&newQty=${newQty}`)
      .then((d) => setProrationPreview(d.proratedDeltaCents))
      .catch(() => setProrationPreview(null));
  }, [modifyTarget, newQty]);

  const confirmModify = async () => {
    if (!modifyTarget) return;
    try {
      await api.post(`/subscriptions/${modifyTarget._id}/modify`, { newQty });
      setModifyTarget(null);
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Modify failed');
    }
  };

  const cancelSub = async (id: string) => {
    try {
      await api.post(`/subscriptions/${id}/cancel`, { reason: 'Cancelled from portal' });
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Cancel failed');
    }
  };

  const active = subs.filter((sub) => sub.status === 'ACTIVE').length;
  const totalMRR = subs
    .filter((sub) => sub.status === 'ACTIVE')
    .reduce((sum, sub) => sum + sub.recurring_unit_price_cents * sub.qty, 0);
  const nextBill = useMemo(
    () =>
      [...subs]
        .filter((sub) => sub.status === 'ACTIVE' && sub.next_bill_date)
        .sort((a, b) => new Date(a.next_bill_date).getTime() - new Date(b.next_bill_date).getTime())[0],
    [subs]
  );

  return (
    <div className="ops-page subscriptions-page">
      <div className="ops-page-heading subscriptions-page__header">
        <div>
          <p className="ops-eyebrow">Finance</p>
          <h1>Subscriptions</h1>
          <p>Recurring commercial data, billing dates, and plan changes.</p>
        </div>
      </div>

      {error && (
        <div className="df-alert df-alert-error">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      <section className="ops-secondary-strip">
        <div className="ops-strip-primary">
          <span>Active recurring revenue</span>
          <strong>{moneyCents(totalMRR)}</strong>
          <small>{active} active subscription{active === 1 ? '' : 's'}</small>
        </div>
        <div>
          <RefreshCw size={16} />
          <span>Total subscriptions</span>
          <strong>{subs.length}</strong>
        </div>
        <div>
          <CalendarClock size={16} />
          <span>Next bill</span>
          <strong>{nextBill ? formatDate(nextBill.next_bill_date) : 'None'}</strong>
        </div>
      </section>

      <div className="ops-master-detail">
        <section className="ops-panel">
          <div className="ops-panel-header">
            <div>
              <p className="ops-eyebrow">Recurring</p>
              <h2>Subscription list</h2>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '18px' }}>
              <div className="skeleton" style={{ height: 16, marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 16, width: '80%', marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 16, width: '60%' }} />
            </div>
          ) : subs.length === 0 ? (
            <div className="df-empty">
              <RefreshCw size={28} />
              <div className="df-empty-title">No subscriptions</div>
              <div className="df-empty-desc">Subscriptions are created when recurring quotations are confirmed.</div>
            </div>
          ) : (
            <div className="ops-table-wrap">
              <table className="df-table ops-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Plan</th>
                    <th>Billing interval</th>
                    <th className="num">Amount</th>
                    <th>Next bill</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {subs.map((sub) => (
                    <tr key={sub._id} className={selected?._id === sub._id ? 'selected' : ''} onClick={() => setSelected(sub)}>
                      <td>{customerLabel(sub.customer_id)}</td>
                      <td>
                        <strong>{planName(sub)}</strong>
                        <small>Qty {sub.qty}</small>
                      </td>
                      <td>{planInterval(sub)}</td>
                      <td className="num">{moneyCents(sub.recurring_unit_price_cents * sub.qty)}</td>
                      <td>{formatDate(sub.next_bill_date)}</td>
                      <td>
                        <span className={`status-badge ${operationsStatusClass(sub.status)}`}>{formatStatus(sub.status)}</span>
                      </td>
                      <td className="num">
                        {sub.status === 'ACTIVE' && (
                          <div className="ops-row-actions">
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                openModify(sub);
                              }}
                              className="btn btn-ghost btn-sm"
                            >
                              Modify
                            </button>
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                cancelSub(sub._id);
                              }}
                              className="btn btn-danger btn-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="ops-panel ops-side-panel">
          {!selected ? (
            <div className="df-empty">
              <CalendarClock size={30} />
              <div className="df-empty-title">Select a subscription</div>
              <div className="df-empty-desc">Plan summary, billing timeline, and proration details will appear here.</div>
            </div>
          ) : (
            <>
              <div className="ops-record-header">
                <span className={`status-badge ${operationsStatusClass(selected.status)}`}>{formatStatus(selected.status)}</span>
                <h2>{planName(selected)}</h2>
                <p>{customerLabel(selected.customer_id)}</p>
              </div>
              <dl className="ops-definition-list">
                <div>
                  <dt>Billing interval</dt>
                  <dd>{planInterval(selected)}</dd>
                </div>
                <div>
                  <dt>Quantity</dt>
                  <dd>{selected.qty}</dd>
                </div>
                <div>
                  <dt>Recurring amount</dt>
                  <dd>{moneyCents(selected.recurring_unit_price_cents * selected.qty)}</dd>
                </div>
                <div>
                  <dt>Next bill</dt>
                  <dd>{formatDate(selected.next_bill_date)}</dd>
                </div>
                <div>
                  <dt>Current period</dt>
                  <dd>{selected.current_period_start || selected.current_period_end ? `${formatDate(selected.current_period_start)} - ${formatDate(selected.current_period_end)}` : 'Not returned'}</dd>
                </div>
              </dl>
              {selected.status === 'ACTIVE' && (
                <div className="ops-side-actions">
                  <button onClick={() => openModify(selected)} className="btn btn-primary">
                    Modify subscription
                  </button>
                  <button onClick={() => cancelSub(selected._id)} className="btn btn-danger">
                    Cancel
                  </button>
                </div>
              )}
            </>
          )}
        </aside>
      </div>

      {modifyTarget && (
        <div className="df-modal-overlay" onClick={() => setModifyTarget(null)}>
          <div className="df-modal" onClick={(e) => e.stopPropagation()}>
            <div className="df-modal-header ops-modal-header">
              <div>
                <h2 className="df-modal-title">Modify subscription</h2>
                <p>{planName(modifyTarget)} for {customerLabel(modifyTarget.customer_id)}</p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setModifyTarget(null)}>
                <X size={14} />
              </button>
            </div>
            <div className="df-modal-body">
              <div className="df-field">
                <label className="df-label">New quantity</label>
                <input type="number" min={1} value={newQty} onChange={(e) => setNewQty(parseInt(e.target.value) || 1)} className="df-input" />
              </div>
              <div className="ops-proration-box">
                <span>Prorated {(prorationPreview ?? 0) >= 0 ? 'charge' : 'credit'}</span>
                <strong>{prorationPreview !== null ? moneyCents(Math.abs(prorationPreview)) : 'Not returned'}</strong>
              </div>
            </div>
            <div className="df-modal-footer">
              <button onClick={() => setModifyTarget(null)} className="btn btn-ghost">Close</button>
              <button onClick={confirmModify} className="btn btn-primary">Confirm changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
