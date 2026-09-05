'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import { AlertCircle, CheckCircle, Plus, AlertTriangle, ChevronRight, FileText } from 'lucide-react';

type Customer = { _id: string; name: string; company: string };
type Product = { _id: string; name: string };
// Shape returned by GET /quotations (list endpoint) - a lighter DTO than the
// raw Mongoose document returned by the create/detail/submit endpoints below.
type QuotationListItem = {
  id: string;
  quoteNumber: string;
  status: string;
  total: number;
  riskSeverity: string;
  customer: { id: string; name: string; company: string } | null;
};
// Shape returned by POST /quotations, GET /quotations/:id, POST .../submit -
// a raw Mongoose document (real _id).
type QuotationDoc = { _id: string };
type QuotationLine = { _id: string; productId: { name: string } | string; quantity: number; unitPrice: number; discountPercent: number; lineTotal: number; is_violation: boolean };

function getStatusClass(status: string): string {
  const s = status?.toLowerCase() ?? '';
  if (s === 'draft') return 'status-draft';
  if (s.includes('pending') || s.includes('approval')) return 'status-pending';
  if (s === 'approved') return 'status-approved';
  if (s === 'rejected') return 'status-rejected';
  if (s === 'negotiating' || s === 'sent') return 'status-negotiating';
  if (s === 'confirmed') return 'status-confirmed';
  return 'status-draft';
}

function getRiskClass(risk: string): string {
  const r = risk?.toLowerCase() ?? '';
  if (r === 'high') return 'risk-high';
  if (r === 'medium') return 'risk-medium';
  if (r === 'low') return 'risk-low';
  return 'risk-none';
}

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<QuotationListItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [newCustomerId, setNewCustomerId] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lines, setLines] = useState<QuotationLine[]>([]);
  const [lineForm, setLineForm] = useState({ productId: '', quantity: '1', discountPercent: '0' });
  const [showNewForm, setShowNewForm] = useState(false);

  const loadQuotations = () => {
    api
      .get<{ quotations: QuotationListItem[] }>('/quotations')
      .then((d) => setQuotations(d.quotations))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : 'Failed to load quotations'));
  };

  useEffect(() => {
    loadQuotations();
    api.get<{ customers: Customer[] }>('/customers').then((d) => setCustomers(d.customers)).catch(() => {});
    api.get<{ products: Product[] }>('/products').then((d) => setProducts(d.products)).catch(() => {});
  }, []);

  const loadLines = (id: string) => {
    api
      .get<{ lines: QuotationLine[] }>(`/quotations/${id}`)
      .then((d) => setLines(d.lines))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : 'Failed to load quotation lines'));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const data = await api.post<{ quotation: QuotationDoc }>('/quotations', { customerId: newCustomerId });
      setNewCustomerId('');
      setShowNewForm(false);
      loadQuotations();
      setSelectedId(data.quotation._id);
      setLines([]);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to create quotation');
    }
  };

  const handleAddLine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setError(null);
    try {
      const data = await api.post<{ lines: QuotationLine[] }>(`/quotations/${selectedId}/lines`, {
        productId: lineForm.productId,
        quantity: Number(lineForm.quantity),
        discountPercent: Number(lineForm.discountPercent),
      });
      setLines(data.lines);
      loadQuotations();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to add line');
    }
  };

  const handleSubmit = async () => {
    if (!selectedId) return;
    setError(null);
    setInfo(null);
    try {
      const data = await api.post<{ approval: { approvalRequired: boolean } }>(
        `/quotations/${selectedId}/submit`
      );
      setInfo(
        data.approval.approvalRequired
          ? 'Submitted — routed for approval based on blended discount risk.'
          : 'Submitted — no approval required, ready for the customer.'
      );
      loadQuotations();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to submit quotation');
    }
  };

  const selectedQuotation = quotations.find((q) => q.id === selectedId);
  const grandTotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const hasViolations = lines.some((l) => l.is_violation);

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 52px)', overflow: 'hidden' }}>
      {/* Left sidebar — quotation list */}
      <div
        style={{
          width: 280,
          flexShrink: 0,
          background: 'var(--surface-01)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* List header */}
        <div
          style={{
            padding: '16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Quotations</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
              {quotations.length} total
            </div>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowNewForm(!showNewForm)}
            title="New quotation"
          >
            <Plus size={13} />
            New
          </button>
        </div>

        {/* New quotation form */}
        {showNewForm && (
          <form
            onSubmit={handleCreate}
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--surface-02)',
            }}
          >
            <label className="df-label">Select customer</label>
            <select
              value={newCustomerId}
              onChange={(e) => setNewCustomerId(e.target.value)}
              required
              className="df-select"
              style={{ marginBottom: 8 }}
            >
              <option value="">Choose customer…</option>
              {customers.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.company || c.name}
                </option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="submit" className="btn btn-primary btn-sm" style={{ flex: 1 }}>
                Create Draft
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowNewForm(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Quotation list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {quotations.length === 0 && (
            <div className="df-empty" style={{ padding: '32px 16px' }}>
              <FileText size={28} style={{ margin: '0 auto 10px', color: 'var(--text-tertiary)' }} />
              <div className="df-empty-title">No quotations yet</div>
              <div className="df-empty-desc">Create your first draft to get started.</div>
            </div>
          )}
          {quotations.map((q) => (
            <button
              key={q.id}
              onClick={() => {
                setSelectedId(q.id);
                setLines([]);
                loadLines(q.id);
                setInfo(null);
              }}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
                background: selectedId === q.id ? 'var(--accent-light)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                transition: 'background 100ms',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
              onMouseEnter={(e) => {
                if (selectedId !== q.id)
                  (e.currentTarget as HTMLElement).style.background = 'var(--surface-02)';
              }}
              onMouseLeave={(e) => {
                if (selectedId !== q.id)
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: selectedId === q.id ? 'var(--accent)' : 'var(--text-primary)',
                    fontFamily: 'monospace',
                  }}
                >
                  {q.quoteNumber}
                </span>
                {q.riskSeverity && q.riskSeverity !== 'NONE' && (
                  <span className={`risk-badge ${getRiskClass(q.riskSeverity)}`} style={{ fontSize: 9 }}>
                    {q.riskSeverity}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className={`status-badge ${getStatusClass(q.status)}`}>{q.status}</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                  ${q.total?.toFixed?.(2) ?? '0.00'}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right — quotation builder */}
      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
        {error && (
          <div className="df-alert df-alert-error" style={{ margin: '16px 24px 0', borderRadius: 'var(--radius)' }}>
            <AlertCircle size={14} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}
        {info && (
          <div className="df-alert df-alert-success" style={{ margin: '16px 24px 0', borderRadius: 'var(--radius)' }}>
            <CheckCircle size={14} style={{ flexShrink: 0 }} />
            <span>{info}</span>
          </div>
        )}

        {!selectedId && (
          <div className="df-empty" style={{ paddingTop: 80 }}>
            <ChevronRight size={32} style={{ margin: '0 auto 12px', color: 'var(--text-tertiary)' }} />
            <div className="df-empty-title">Select a quotation</div>
            <div className="df-empty-desc">Choose from the list or create a new draft.</div>
          </div>
        )}

        {selectedId && (
          <div style={{ padding: '24px' }}>
            {/* Quotation header */}
            {selectedQuotation && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 20,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h1
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        fontFamily: 'monospace',
                      }}
                    >
                      {selectedQuotation.quoteNumber}
                    </h1>
                    <span className={`status-badge ${getStatusClass(selectedQuotation.status)}`}>
                      {selectedQuotation.status}
                    </span>
                    {selectedQuotation.riskSeverity && selectedQuotation.riskSeverity !== 'NONE' && (
                      <span className={`risk-badge ${getRiskClass(selectedQuotation.riskSeverity)}`}>
                        {selectedQuotation.riskSeverity} RISK
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                    {selectedQuotation.customer?.company || selectedQuotation.customer?.name || 'Customer'}
                  </div>
                </div>
                <button onClick={handleSubmit} className="btn btn-primary">
                  Submit for Approval
                </button>
              </div>
            )}

            {/* Lines table */}
            <div className="df-card" style={{ marginBottom: 16 }}>
              <div className="df-card-header">
                <span style={{ fontSize: 13, fontWeight: 600 }}>Quotation Lines</span>
                {hasViolations && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: 12,
                      color: 'var(--amber)',
                    }}
                  >
                    <AlertTriangle size={12} />
                    Discount violations present
                  </div>
                )}
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="df-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th style={{ textAlign: 'center' }}>Qty</th>
                      <th style={{ textAlign: 'right' }}>Unit Price</th>
                      <th style={{ textAlign: 'center' }}>Discount %</th>
                      <th style={{ textAlign: 'right' }}>Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l._id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 500 }}>
                              {typeof l.productId === 'object' ? l.productId.name : l.productId}
                            </span>
                            {l.is_violation && (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                  background: 'var(--amber-light)',
                                  color: 'var(--amber)',
                                  border: '1px solid var(--amber-muted)',
                                  borderRadius: 4,
                                  padding: '1px 6px',
                                  fontSize: 10,
                                  fontWeight: 600,
                                }}
                              >
                                <AlertTriangle size={9} />
                                Discount violation
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="num" style={{ textAlign: 'center' }}>{l.quantity}</td>
                        <td className="num" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          ${l.unitPrice.toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            style={{
                              color: l.is_violation ? 'var(--amber)' : 'var(--text-primary)',
                              fontWeight: l.is_violation ? 600 : 400,
                            }}
                          >
                            {l.discountPercent}%
                          </span>
                        </td>
                        <td className="num" style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                          ${l.lineTotal.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    {lines.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-tertiary)', fontSize: 13 }}>
                          No lines added yet — add a product below.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Grand total strip */}
              {lines.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    padding: '12px 16px',
                    borderTop: '1px solid var(--border)',
                    background: 'var(--surface-02)',
                  }}
                >
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                      Grand Total
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                      ${grandTotal.toFixed(2)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Add line form */}
            <div className="df-card">
              <div className="df-card-header">
                <span style={{ fontSize: 13, fontWeight: 600 }}>Add Line Item</span>
              </div>
              <div className="df-card-body">
                <form onSubmit={handleAddLine}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 110px auto', gap: 10, alignItems: 'flex-end' }}>
                    <div>
                      <label className="df-label">Product</label>
                      <select
                        value={lineForm.productId}
                        onChange={(e) => setLineForm({ ...lineForm, productId: e.target.value })}
                        required
                        className="df-select"
                      >
                        <option value="">Select product…</option>
                        {products.map((p) => (
                          <option key={p._id} value={p._id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="df-label">Quantity</label>
                      <input
                        type="number"
                        value={lineForm.quantity}
                        onChange={(e) => setLineForm({ ...lineForm, quantity: e.target.value })}
                        className="df-input"
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="df-label">Discount %</label>
                      <input
                        type="number"
                        value={lineForm.discountPercent}
                        onChange={(e) => setLineForm({ ...lineForm, discountPercent: e.target.value })}
                        className="df-input"
                        min="0"
                        max="100"
                      />
                    </div>
                    <div>
                      <button type="submit" className="btn btn-secondary" style={{ marginTop: 17 }}>
                        <Plus size={13} />
                        Add Line
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
