'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, Circle, CreditCard, Receipt, X } from 'lucide-react';
import { api, ApiClientError } from '@/lib/api';
import {
  customerLabel,
  formatDate,
  formatStatus,
  moneyCents,
  operationsStatusClass,
  sourceLabel,
  type Invoice,
} from '@/lib/operations';

function invoiceKind(invoice: Invoice) {
  return invoice.type || invoice.source_type || (invoice.subscription_id ? 'Subscription' : 'Order');
}

function isOverdue(invoice: Invoice) {
  return new Date(invoice.due_date) < new Date() && invoice.status !== 'PAID';
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<Invoice | null>(null);
  const [amount, setAmount] = useState('');

  const load = () => {
    api
      .get<Invoice[]>('/invoices')
      .then(setInvoices)
      .catch((err) =>
        setError(err instanceof ApiClientError ? err.message : 'Failed to load invoices')
      );
  };

  useEffect(load, []);

  const handleRecordPayment = async () => {
    if (!paymentTarget) return;
    try {
      await api.post(`/invoices/${paymentTarget._id}/payments`, {
        amount_cents: Math.round(parseFloat(amount) * 100),
        method: 'card',
      });
      setSelected(null);
      setPaymentTarget(null);
      setAmount('');
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Payment failed');
    }
  };

  const totals = useMemo(
    () =>
      invoices.reduce(
        (acc, invoice) => ({
          invoiced: acc.invoiced + invoice.total_cents,
          paid: acc.paid + invoice.paid_amount_cents,
        }),
        { invoiced: 0, paid: 0 }
      ),
    [invoices]
  );
  const outstanding = totals.invoiced - totals.paid;

  return (
    <div className="ops-page">
      <div className="ops-page-heading">
        <div>
          <p className="ops-eyebrow">Finance</p>
          <h1>Invoices</h1>
          <p>Precise invoice status, due dates, balances, and payment capture.</p>
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
          <span>Total invoiced</span>
          <strong>{moneyCents(totals.invoiced)}</strong>
          <small>{invoices.length} invoice{invoices.length === 1 ? '' : 's'}</small>
        </div>
        <div>
          <CreditCard size={16} />
          <span>Paid</span>
          <strong>{moneyCents(totals.paid)}</strong>
        </div>
        <div className={outstanding > 0 ? 'warning' : ''}>
          <Receipt size={16} />
          <span>Outstanding</span>
          <strong>{moneyCents(outstanding)}</strong>
        </div>
      </section>

      <div className="ops-master-detail">
        <section className="ops-panel">
          <div className="ops-panel-header">
            <div>
              <p className="ops-eyebrow">Ledger</p>
              <h2>Invoice list</h2>
            </div>
          </div>

          {invoices.length === 0 ? (
            <div className="df-empty">
              <Receipt size={28} />
              <div className="df-empty-title">No invoices</div>
              <div className="df-empty-desc">Invoices are created when quotations are confirmed and fulfilled.</div>
            </div>
          ) : (
            <div className="ops-table-wrap">
              <table className="df-table ops-table ops-finance-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Customer</th>
                    <th>Order</th>
                    <th>Type</th>
                    <th className="num">Amount</th>
                    <th className="num">Paid</th>
                    <th>Status</th>
                    <th>Due date</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => {
                    const balance = Math.max(0, invoice.total_cents - invoice.paid_amount_cents);
                    return (
                      <tr key={invoice._id} className={selected?._id === invoice._id ? 'selected' : ''} onClick={() => setSelected(invoice)}>
                        <td>
                          <strong>{invoice.invoice_no}</strong>
                          {balance > 0 && <small>{moneyCents(balance)} balance</small>}
                        </td>
                        <td>{customerLabel(invoice.customer_id)}</td>
                        <td>{sourceLabel(invoice)}</td>
                        <td>{formatStatus(invoiceKind(invoice))}</td>
                        <td className="num">{moneyCents(invoice.total_cents)}</td>
                        <td className="num">{moneyCents(invoice.paid_amount_cents)}</td>
                        <td>
                          <span className={`status-badge ${operationsStatusClass(invoice.status)}`}>{formatStatus(invoice.status)}</span>
                        </td>
                        <td>
                          <span className={isOverdue(invoice) ? 'ops-overdue' : ''}>{formatDate(invoice.due_date)}</span>
                        </td>
                        <td className="num">
                          {['UNPAID', 'PARTIALLY_PAID'].includes(invoice.status) && (
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                setPaymentTarget(invoice);
                              }}
                              className="btn btn-ghost btn-sm"
                            >
                              Record payment
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="ops-panel ops-side-panel">
          {!selected ? (
            <div className="df-empty">
              <Receipt size={30} />
              <div className="df-empty-title">Select an invoice</div>
              <div className="df-empty-desc">Invoice summary, due date, and payment actions will appear here.</div>
            </div>
          ) : (
            <>
              <div className="ops-invoice-top">
                <span className={`status-badge ${operationsStatusClass(selected.status)}`}>{formatStatus(selected.status)}</span>
                <h2>Invoice {selected.invoice_no}</h2>
                <strong>{moneyCents(selected.total_cents)}</strong>
                <p>{customerLabel(selected.customer_id)} · Due {formatDate(selected.due_date)}</p>
              </div>
              <div className="ops-progress">
                {['Confirmed', 'Shipped', 'Invoiced', 'Paid'].map((step) => {
                  const complete = step === 'Confirmed' || step === 'Shipped' || step === 'Invoiced' || selected.status === 'PAID';
                  return (
                    <div key={step} className={complete ? 'complete' : ''}>
                      <span>{complete ? <Check size={12} /> : <Circle size={10} />}</span>
                      <strong>{step}</strong>
                    </div>
                  );
                })}
              </div>
              <dl className="ops-definition-list">
                <div>
                  <dt>Source</dt>
                  <dd>{sourceLabel(selected)}</dd>
                </div>
                <div>
                  <dt>Type</dt>
                  <dd>{formatStatus(invoiceKind(selected))}</dd>
                </div>
                <div>
                  <dt>Paid</dt>
                  <dd>{moneyCents(selected.paid_amount_cents)}</dd>
                </div>
                <div>
                  <dt>Balance</dt>
                  <dd>{moneyCents(Math.max(0, selected.total_cents - selected.paid_amount_cents))}</dd>
                </div>
              </dl>
              {['UNPAID', 'PARTIALLY_PAID'].includes(selected.status) && (
                <button onClick={() => setPaymentTarget(selected)} className="btn btn-primary btn-full">
                  Record payment
                </button>
              )}
            </>
          )}
        </aside>
      </div>

      {paymentTarget && (
        <div className="df-modal-overlay" onClick={() => setPaymentTarget(null)}>
          <div className="df-modal" onClick={(e) => e.stopPropagation()}>
            <div className="df-modal-header ops-modal-header">
              <div>
                <h2 className="df-modal-title">Record payment</h2>
                <p>{paymentTarget.invoice_no}</p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setPaymentTarget(null)}>
                <X size={14} />
              </button>
            </div>
            <div className="df-modal-body">
              <div className="ops-payment-balance">
                <span>Outstanding balance</span>
                <strong>{moneyCents(paymentTarget.total_cents - paymentTarget.paid_amount_cents)}</strong>
              </div>
              <div className="df-field">
                <label className="df-label">Payment amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="df-input"
                  placeholder="0.00"
                  autoFocus
                />
              </div>
            </div>
            <div className="df-modal-footer">
              <button onClick={() => setPaymentTarget(null)} className="btn btn-ghost">
                Cancel
              </button>
              <button onClick={handleRecordPayment} disabled={!amount || parseFloat(amount) <= 0} className="btn btn-primary">
                Confirm payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
