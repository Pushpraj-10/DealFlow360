'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CreditCard } from 'lucide-react';
import { api, ApiClientError } from '@/lib/api';
import { customerLabel, formatDateTime, moneyCents, type Invoice, type Payment } from '@/lib/operations';

type PaymentRow = Payment & {
  invoiceNo: string;
  customer: Invoice['customer_id'];
};

export default function PaymentsPage() {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const invoices = await api.get<Invoice[]>('/invoices');
        const all: PaymentRow[] = [];
        for (const invoice of invoices) {
          const detail = await api.get<{ payments: Payment[] }>(`/invoices/${invoice._id}`);
          for (const payment of detail.payments) {
            all.push({ ...payment, invoiceNo: invoice.invoice_no, customer: invoice.customer_id });
          }
        }
        all.sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime());
        setRows(all);
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : 'Failed to load payments');
      }
    })();
  }, []);

  const totalCollected = useMemo(() => rows.reduce((sum, row) => sum + row.amount_cents, 0), [rows]);

  return (
    <div className="ops-page">
      <div className="ops-page-heading">
        <div>
          <p className="ops-eyebrow">Finance</p>
          <h1>Payments</h1>
          <p>Recorded collections with invoice references, methods, and timestamps.</p>
        </div>
      </div>

      {error && (
        <div className="df-alert df-alert-error">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      <section className="ops-secondary-strip ops-secondary-strip-compact">
        <div className="ops-strip-primary">
          <span>Total collected</span>
          <strong>{moneyCents(totalCollected)}</strong>
          <small>{rows.length} payment{rows.length === 1 ? '' : 's'} recorded</small>
        </div>
      </section>

      <section className="ops-panel">
        <div className="ops-panel-header">
          <div>
            <p className="ops-eyebrow">Receipts</p>
            <h2>Payment ledger</h2>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="df-empty">
            <CreditCard size={28} />
            <div className="df-empty-title">No payments recorded</div>
            <div className="df-empty-desc">Payments appear here after you record them on invoices.</div>
          </div>
        ) : (
          <div className="ops-table-wrap">
            <table className="df-table ops-table ops-finance-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th className="num">Amount</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Paid at</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((payment) => (
                  <tr key={payment._id}>
                    <td>
                      <strong>{payment.reference || `...${payment._id.slice(-8)}`}</strong>
                    </td>
                    <td>{payment.invoiceNo}</td>
                    <td>{customerLabel(payment.customer)}</td>
                    <td className="num">{moneyCents(payment.amount_cents)}</td>
                    <td>{payment.method}</td>
                    <td>
                      <span className="status-badge status-paid">Recorded</span>
                    </td>
                    <td>{formatDateTime(payment.paid_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
