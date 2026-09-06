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

const PAYMENT_METHODS = ['cash', 'bank_transfer', 'card', 'other'];

type InvoiceLine = { _id: string; description: string; qty: number; unit_price_cents: number; amount_cents: number; source_type: string };
type PaymentRow = { _id: string; amount_cents: number; method: string; paid_at: string };
type InvoiceDetail = { invoice: Invoice; lines: InvoiceLine[]; payments: PaymentRow[] };

function invoiceKind(invoice: Invoice) {
  return invoice.subscription_id ? 'Subscription' : 'Order';
}

function isOverdue(invoice: Invoice) {
  return new Date(invoice.due_date) < new Date() && invoice.status !== 'PAID';
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<InvoiceDetail | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<Invoice | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('card');

  const load = () => {
    api
      .get<Invoice[]>('/invoices')
      .then(setInvoices)
      .catch((err) =>
        setError(err instanceof ApiClientError ? err.message : 'Failed to load invoices')
      )
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  useEffect(() => {
    if (!selected) {
      setSelectedDetail(null);
      return;
    }
    api
      .get<InvoiceDetail>(`/invoices/${selected._id}`)
      .then(setSelectedDetail)
      .catch(() => setSelectedDetail(null));
  }, [selected]);

  const handleRecordPayment = async () => {
    if (!paymentTarget) return;
    try {
      await api.post(`/invoices/${paymentTarget._id}/payments`, {
        amount_cents: Math.round(parseFloat(amount) * 100),
        method,
      });
      setPaymentTarget(null);
      setAmount('');
      setMethod('card');
      load();
      if (selected?._id === paymentTarget._id) {
        api.get<InvoiceDetail>(`/invoices/${paymentTarget._id}`).then(setSelectedDetail).catch(() => {});
      }
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
    <div className="ops-page invoices-page">
      <div className="ops-page-heading invoices-page__header">
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

          {loading ? (
            <div style={{ padding: '18px' }}>
              <div className="skeleton" style={{ height: 16, marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 16, width: '80%', marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 16, width: '60%' }} />
            </div>
          ) : invoices.length === 0 ? (
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
                {(() => {
                  const hasShipmentLine = (selectedDetail?.lines || []).some((line) => line.source_type === 'shipment');
                  return ['Confirmed', 'Shipped', 'Invoiced', 'Paid'].map((step) => {
                    let complete = false;
                    if (step === 'Confirmed' || step === 'Invoiced') complete = true;
                    else if (step === 'Shipped') complete = hasShipmentLine;
                    else if (step === 'Paid') complete = selected.status === 'PAID';
                    return (
                      <div key={step} className={complete ? 'complete' : ''}>
                        <span>{complete ? <Check size={12} /> : <Circle size={10} />}</span>
                        <strong>{step}</strong>
                      </div>
                    );
                  });
                })()}
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

              {selectedDetail && selectedDetail.lines.length > 0 && (
                <div className="ops-subsection">
                  <div className="ops-subsection-header"><h3>Line items</h3></div>
                  <table className="df-table">
                    <thead>
                      <tr><th>Description</th><th className="num">Qty</th><th className="num">Unit price</th><th className="num">Amount</th></tr>
                    </thead>
                    <tbody>
                      {selectedDetail.lines.map((line) => (
                        <tr key={line._id}>
                          <td>{line.description || formatStatus(line.source_type)}</td>
                          <td className="num">{line.qty}</td>
                          <td className="num">{moneyCents(line.unit_price_cents)}</td>
                          <td className="num">{moneyCents(line.amount_cents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {selectedDetail && selectedDetail.payments.length > 0 && (
                <div className="ops-subsection">
                  <div className="ops-subsection-header"><h3>Payments</h3></div>
                  <table className="df-table">
                    <thead>
                      <tr><th>Date</th><th>Method</th><th className="num">Amount</th></tr>
                    </thead>
                    <tbody>
                      {selectedDetail.payments.map((payment) => (
                        <tr key={payment._id}>
                          <td>{formatDate(payment.paid_at)}</td>
                          <td>{formatStatus(payment.method)}</td>
                          <td className="num">{moneyCents(payment.amount_cents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

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
