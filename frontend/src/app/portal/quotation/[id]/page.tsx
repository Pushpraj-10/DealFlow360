'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { AlertCircle, CheckCircle2, FileText, MessageSquare, Send, X } from 'lucide-react';
import { api, ApiClientError } from '@/lib/api';

type PortalLine = {
  id: string;
  product: { id: string; name: string; description?: string; productType?: string; billingType?: string; unit?: string } | null;
  variant: { id: string; sku?: string; name?: string; attributes?: Record<string, unknown> } | null;
  lineType: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxPercentage: number;
  tax: number;
  lineSubtotal: number;
  discountAmount: number;
  revenueAfterDiscount: number;
  lineTotal: number;
  description?: string;
};

type PortalMessage = {
  id: string;
  quotationVersion: number;
  quotationLineId?: string | null;
  messageType: string;
  message: string;
  proposedValue?: Record<string, unknown> | null;
  sender?: { name?: string | null; role?: string | null };
  createdAt: string;
};

type PortalNegotiation = {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  submittedBy?: { name?: string | null; role?: string | null };
};

type PortalQuotation = {
  id: string;
  quoteNumber: string;
  status: string;
  currencyCode: string;
  version: number;
  customer: { name?: string; company?: string; email?: string } | null;
  totals: {
    subtotal: number;
    totalDiscount: number;
    revenueAfterDiscount: number;
    tax: number;
    grandTotal: number;
  };
  lines: PortalLine[];
  negotiationHistory: {
    negotiations: PortalNegotiation[];
    messages: PortalMessage[];
  };
  createdAt: string;
  updatedAt: string;
};

const messageTypes = [
  { value: 'GENERAL_COMMENT', label: 'Comment' },
  { value: 'LINE_QUESTION', label: 'Line question' },
  { value: 'QUANTITY_CHANGE', label: 'Quantity change' },
  { value: 'PRICE_CHANGE', label: 'Price change' },
  { value: 'COUNTER_DISCOUNT', label: 'Counter discount' },
];

function money(value?: number | null, currency = 'USD') {
  return `${currency} ${(Number(value) || 0).toFixed(2)}`;
}

function statusClass(status: string): string {
  const s = status?.toLowerCase() ?? '';
  if (s.includes('confirmed')) return 'status-confirmed';
  if (s.includes('approved') || s.includes('ready')) return 'status-approved';
  if (s.includes('negotiation') || s.includes('sent')) return 'status-negotiating';
  if (s.includes('pending')) return 'status-pending';
  if (s.includes('reject')) return 'status-rejected';
  return 'status-draft';
}

function formatStatus(value: string) {
  return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function lineName(line: PortalLine) {
  return line.product?.name || line.variant?.sku || line.description || 'Quoted item';
}

function proposedValueFor(type: string, value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || value.trim() === '') return null;
  if (type === 'COUNTER_DISCOUNT') return { discountPercent: parsed, scope: 'LINE' };
  if (type === 'QUANTITY_CHANGE') return { quantity: parsed };
  if (type === 'PRICE_CHANGE') return { unitPrice: parsed };
  return null;
}

export default function PortalQuotationPage() {
  const params = useParams<{ id: string }>();
  const [quotation, setQuotation] = useState<PortalQuotation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [messageType, setMessageType] = useState('GENERAL_COMMENT');
  const [quotationLineId, setQuotationLineId] = useState('');
  const [message, setMessage] = useState('');
  const [proposedValue, setProposedValue] = useState('');
  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountScope, setDiscountScope] = useState<'QUOTE' | 'LINE'>('QUOTE');
  const [discountLineId, setDiscountLineId] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [discountMessage, setDiscountMessage] = useState('');

  const load = () => {
    api
      .get<{ quotation: PortalQuotation }>(`/quotations/portal/${params.id}`)
      .then((d) => setQuotation(d.quotation))
      .catch((err) =>
        setError(err instanceof ApiClientError ? err.message : 'Failed to load quotation')
      );
  };

  useEffect(load, [params.id]);

  const selectedLine = useMemo(
    () => quotation?.lines.find((line) => line.id === quotationLineId) || null,
    [quotation, quotationLineId]
  );

  const submitChangeRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!quotation) return;
    setError(null);
    setSuccess(null);

    try {
      await api.post(`/negotiations/quotations/${quotation.id}`, {
        messageType,
        quotationLineId: quotationLineId || null,
        message,
        proposedValue: proposedValueFor(messageType, proposedValue),
      });
      setRequestOpen(false);
      setMessage('');
      setProposedValue('');
      setQuotationLineId('');
      setMessageType('GENERAL_COMMENT');
      setSuccess('Request submitted to your sales rep.');
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to submit request');
    }
  };

  const submitDiscountProposal = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!quotation) return;
    setError(null);
    setSuccess(null);

    try {
      await api.post(`/negotiations/quotations/${quotation.id}/discount-proposals`, {
        scope: discountScope,
        quotationLineId: discountScope === 'LINE' ? discountLineId : null,
        proposedDiscountPercent: Number(discountPercent),
        message: discountMessage,
      });
      setDiscountOpen(false);
      setDiscountPercent('');
      setDiscountMessage('');
      setDiscountLineId('');
      setSuccess('Discount proposal submitted.');
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to submit discount proposal');
    }
  };

  const confirmQuotation = async () => {
    if (!quotation) return;
    setError(null);
    setSuccess(null);
    try {
      await api.post(`/quotations/${quotation.id}/confirm`, { reason: 'Customer confirmed from portal' });
      setSuccess('Quotation confirmed successfully.');
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to confirm quotation');
    }
  };

  const canConfirm = quotation && ['APPROVED', 'READY_FOR_CUSTOMER', 'SENT_TO_CUSTOMER'].includes(quotation.status);
  const messages = quotation?.negotiationHistory?.messages || [];

  return (
    <div className="portal-page portal-quotation-detail-page">
      {error && (
        <div className="df-alert df-alert-error">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="df-alert df-alert-success">
          <CheckCircle2 size={14} />
          <span>{success}</span>
        </div>
      )}

      {!quotation && !error && (
        <div className="portal-skeleton">
          <div className="skeleton" />
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
      )}

      {quotation && (
        <>
          <section className="portal-quote-hero">
            <div>
              <p className="portal-eyebrow">My Quote</p>
              <h1>{quotation.quoteNumber}</h1>
              <p>{quotation.customer?.company || quotation.customer?.name || 'Customer'} · Version {quotation.version}</p>
            </div>
            <div className="portal-quote-total">
              <span className={`status-badge ${statusClass(quotation.status)}`}>{formatStatus(quotation.status)}</span>
              <strong>{money(quotation.totals.grandTotal, quotation.currencyCode)}</strong>
            </div>
          </section>

          <section className="portal-quote-layout">
            <div className="portal-panel">
              <div className="portal-panel-header">
                <div>
                  <p className="portal-eyebrow">Products</p>
                  <h2>Quotation lines</h2>
                </div>
              </div>
              <div className="portal-table-wrap">
                <table className="df-table portal-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th className="num">Quantity</th>
                      <th className="num">Price</th>
                      <th className="num">Discount</th>
                      <th className="num">Tax</th>
                      <th className="num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotation.lines.map((line) => (
                      <tr key={line.id}>
                        <td>
                          <strong>{lineName(line)}</strong>
                          <small>{line.variant?.sku || line.product?.unit || line.lineType}</small>
                        </td>
                        <td className="num">{line.quantity}</td>
                        <td className="num">{money(line.unitPrice, quotation.currencyCode)}</td>
                        <td className="num">{line.discountPercent}%</td>
                        <td className="num">{money(line.tax, quotation.currencyCode)}</td>
                        <td className="num">{money(line.lineTotal, quotation.currencyCode)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <aside className="portal-panel portal-summary">
              <div className="portal-panel-header">
                <div>
                  <p className="portal-eyebrow">Summary</p>
                  <h2>Total</h2>
                </div>
              </div>
              <dl className="portal-total-list">
                <div><dt>Subtotal</dt><dd>{money(quotation.totals.subtotal, quotation.currencyCode)}</dd></div>
                <div><dt>Discount</dt><dd>{money(quotation.totals.totalDiscount, quotation.currencyCode)}</dd></div>
                <div><dt>Tax</dt><dd>{money(quotation.totals.tax, quotation.currencyCode)}</dd></div>
                <div className="total"><dt>Grand total</dt><dd>{money(quotation.totals.grandTotal, quotation.currencyCode)}</dd></div>
              </dl>
              <div className="portal-actions">
                <button onClick={confirmQuotation} disabled={!canConfirm} className="btn btn-primary btn-full">
                  Confirm quotation
                </button>
                <button onClick={() => setRequestOpen(true)} className="btn btn-secondary btn-full">
                  Request changes
                </button>
                <button onClick={() => setDiscountOpen(true)} className="btn btn-ghost btn-full">
                  Propose discount
                </button>
              </div>
            </aside>
          </section>

          <section id="messages" className="portal-panel">
            <div className="portal-panel-header">
              <div>
                <p className="portal-eyebrow">Messages</p>
                <h2>Negotiation thread</h2>
              </div>
              <button onClick={() => setRequestOpen(true)} className="btn btn-secondary">
                <MessageSquare size={14} />
                New message
              </button>
            </div>
            {messages.length === 0 ? (
              <div className="portal-empty">
                <FileText size={26} />
                <strong>No messages yet</strong>
                <span>Questions and requested changes will appear here.</span>
              </div>
            ) : (
              <div className="portal-message-list">
                {messages.map((item) => (
                  <div key={item.id} className="portal-message">
                    <div>
                      <strong>{item.sender?.name || formatStatus(item.sender?.role || 'Customer')}</strong>
                      <span>{formatStatus(item.messageType)} · Version {item.quotationVersion}</span>
                    </div>
                    <p>{item.message}</p>
                    {item.proposedValue && (
                      <small>{Object.entries(item.proposedValue).map(([key, value]) => `${formatStatus(key)}: ${String(value)}`).join(' · ')}</small>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section id="profile" className="portal-panel portal-profile">
            <p className="portal-eyebrow">Profile</p>
            <h2>{quotation.customer?.company || quotation.customer?.name || 'Customer'}</h2>
            <span>{quotation.customer?.email || 'Email not returned'}</span>
          </section>
        </>
      )}

      {requestOpen && quotation && (
        <div className="df-modal-overlay" onClick={() => setRequestOpen(false)}>
          <form onSubmit={submitChangeRequest} className="df-modal df-modal-wide" onClick={(event) => event.stopPropagation()}>
            <div className="df-modal-header portal-modal-header">
              <div>
                <h2 className="df-modal-title">Request changes</h2>
                <p>Send a question, comment, quantity change, or price change to your sales rep.</p>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRequestOpen(false)}>
                <X size={14} />
              </button>
            </div>
            <div className="df-modal-body">
              <div className="portal-form-grid">
                <div className="df-field">
                  <label className="df-label">Request type</label>
                  <select value={messageType} onChange={(event) => setMessageType(event.target.value)} className="df-select">
                    {messageTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                  </select>
                </div>
                <div className="df-field">
                  <label className="df-label">Line</label>
                  <select value={quotationLineId} onChange={(event) => setQuotationLineId(event.target.value)} className="df-select">
                    <option value="">Entire quotation</option>
                    {quotation.lines.map((line) => <option key={line.id} value={line.id}>{lineName(line)}</option>)}
                  </select>
                </div>
              </div>
              {['COUNTER_DISCOUNT', 'QUANTITY_CHANGE', 'PRICE_CHANGE'].includes(messageType) && (
                <div className="df-field">
                  <label className="df-label">
                    {messageType === 'COUNTER_DISCOUNT' ? 'Proposed discount %' : messageType === 'QUANTITY_CHANGE' ? 'Proposed quantity' : 'Proposed unit price'}
                  </label>
                  <input value={proposedValue} onChange={(event) => setProposedValue(event.target.value)} className="df-input" type="number" step="0.01" required />
                </div>
              )}
              {selectedLine && (
                <div className="portal-current-line">
                  Current: {lineName(selectedLine)} · {selectedLine.quantity} units · {selectedLine.discountPercent}% discount · {money(selectedLine.lineTotal, quotation.currencyCode)}
                </div>
              )}
              <div className="df-field">
                <label className="df-label">Message</label>
                <textarea value={message} onChange={(event) => setMessage(event.target.value)} className="df-input portal-textarea" required />
              </div>
            </div>
            <div className="df-modal-footer">
              <button type="button" onClick={() => setRequestOpen(false)} className="btn btn-ghost">Cancel</button>
              <button type="submit" className="btn btn-primary">
                <Send size={14} />
                Submit request
              </button>
            </div>
          </form>
        </div>
      )}

      {discountOpen && quotation && (
        <div className="df-modal-overlay" onClick={() => setDiscountOpen(false)}>
          <form onSubmit={submitDiscountProposal} className="df-modal" onClick={(event) => event.stopPropagation()}>
            <div className="df-modal-header portal-modal-header">
              <div>
                <h2 className="df-modal-title">Propose discount</h2>
                <p>Request a larger discount without changing the accepted quote directly.</p>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDiscountOpen(false)}>
                <X size={14} />
              </button>
            </div>
            <div className="df-modal-body">
              <div className="df-field">
                <label className="df-label">Scope</label>
                <select value={discountScope} onChange={(event) => setDiscountScope(event.target.value as 'QUOTE' | 'LINE')} className="df-select">
                  <option value="QUOTE">Entire quotation</option>
                  <option value="LINE">Specific line</option>
                </select>
              </div>
              {discountScope === 'LINE' && (
                <div className="df-field">
                  <label className="df-label">Line</label>
                  <select value={discountLineId} onChange={(event) => setDiscountLineId(event.target.value)} className="df-select" required>
                    <option value="">Select line</option>
                    {quotation.lines.map((line) => <option key={line.id} value={line.id}>{lineName(line)}</option>)}
                  </select>
                </div>
              )}
              <div className="df-field">
                <label className="df-label">Proposed discount %</label>
                <input value={discountPercent} onChange={(event) => setDiscountPercent(event.target.value)} className="df-input" type="number" min="0" max="100" step="0.01" required />
              </div>
              <div className="df-field">
                <label className="df-label">Message</label>
                <textarea value={discountMessage} onChange={(event) => setDiscountMessage(event.target.value)} className="df-input portal-textarea" required />
              </div>
            </div>
            <div className="df-modal-footer">
              <button type="button" onClick={() => setDiscountOpen(false)} className="btn btn-ghost">Cancel</button>
              <button type="submit" className="btn btn-primary">Submit proposal</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
