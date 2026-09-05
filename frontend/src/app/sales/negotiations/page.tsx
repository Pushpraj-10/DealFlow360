'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import {
  AlertCircle,
  CheckCircle,
  MessageSquare,
  Search,
  XCircle,
} from 'lucide-react';
import {
  formatStatus,
  getActivityTime,
  getCustomerName,
  getStatusClass,
  money,
  normalizeQuotationCard,
  timeAgo,
  type Negotiation,
  type NegotiationMessage,
  type NegotiationWorkItem,
  type QuotationListItem,
} from '@/lib/salesRep';

function describeProposedValue(message?: NegotiationMessage) {
  if (!message?.proposedValue) return 'No structured proposal';
  const value = message.proposedValue;
  if ('discountPercent' in value) return `${value.scope || 'QUOTE'} discount ${value.discountPercent}%`;
  if ('quantity' in value) return `Quantity ${value.quantity}`;
  if ('unitPrice' in value) return `Unit price ${money(Number(value.unitPrice))}`;
  return JSON.stringify(value);
}

function affectedLine(item: NegotiationWorkItem) {
  const message = item.negotiation.messages?.find((entry) => entry.quotationLineId);
  const request = item.negotiation.requests?.find((entry) => entry.quotationLineId);
  return message?.quotationLineId || request?.quotationLineId || 'Entire quotation';
}

export default function NegotiationsPage() {
  const [quotations, setQuotations] = useState<QuotationListItem[]>([]);
  const [items, setItems] = useState<NegotiationWorkItem[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [reasonById, setReasonById] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const quoteData = await api.get<{ quotations: QuotationListItem[] }>('/quotations');
      const normalizedQuotes = quoteData.quotations.map(normalizeQuotationCard);
      const negotiationResults = await Promise.allSettled(
        normalizedQuotes.map(async (quotation) => {
          const data = await api.get<{ negotiations: Negotiation[] }>(`/negotiations/quotations/${quotation.id}`);
          return data.negotiations.map((negotiation) => ({ quotation, negotiation }));
        })
      );
      setQuotations(normalizedQuotes);
      setItems(negotiationResults.flatMap((result) => (result.status === 'fulfilled' ? result.value : [])));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load negotiations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      load();
    });
  }, []);

  const decide = async (id: string, decision: 'accept' | 'reject') => {
    setError(null);
    setInfo(null);
    setActingOn(id);
    try {
      const data = await api.post<{ quotation?: { currentVersion?: number; status?: string }; approvalDecision?: { approvalRequired?: boolean } }>(
        `/negotiations/${id}/${decision}`,
        { reason: reasonById[id] || '' }
      );
      if (decision === 'accept') {
        const version = data.quotation?.currentVersion ? ` Version ${data.quotation.currentVersion} created.` : '';
        const approval = data.approvalDecision?.approvalRequired ? ' Reapproval is required.' : ' No reapproval is required.';
        setInfo(`Negotiation accepted.${version}${approval}`);
      } else {
        setInfo('Negotiation rejected.');
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Negotiation action failed');
    } finally {
      setActingOn(null);
    }
  };

  const visibleItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => {
      const latestMessage = item.negotiation.messages?.[item.negotiation.messages.length - 1];
      return [
        getCustomerName(item.quotation.customer),
        item.quotation.quoteNumber,
        item.negotiation.status,
        latestMessage?.message,
        describeProposedValue(latestMessage),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [items, search]);

  const submittedCount = items.filter((item) => item.negotiation.status === 'SUBMITTED').length;
  const quotedValue = quotations.reduce((sum, quotation) => sum + Number(quotation.total || 0), 0);

  return (
    <div className="sales-page">
      <div className="sales-page-heading">
        <div>
          <p className="sales-eyebrow">Negotiations</p>
          <h1>Commercial negotiation workspace</h1>
          <p>Review customer requested term changes against the current quotation context.</p>
        </div>
        <div className="sales-filter-control">
          <Search size={15} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search negotiations" />
        </div>
      </div>

      {error && (
        <div className="df-alert df-alert-error">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}
      {info && (
        <div className="df-alert df-alert-success">
          <CheckCircle size={14} />
          <span>{info}</span>
        </div>
      )}

      <section className="sales-negotiation-summary">
        <div>
          <span>Waiting on sales</span>
          <strong>{loading ? '...' : submittedCount}</strong>
        </div>
        <div>
          <span>Total quoted value in scope</span>
          <strong>{loading ? '...' : money(quotedValue)}</strong>
        </div>
        <div>
          <span>Negotiation records</span>
          <strong>{loading ? '...' : items.length}</strong>
        </div>
      </section>

      {loading ? (
        <div className="sales-negotiation-list">
          {[1, 2, 3].map((item) => (
            <div key={item} className="sales-negotiation-card">
              <div className="skeleton" style={{ width: 180, height: 16 }} />
              <div className="skeleton" style={{ width: '70%', height: 12 }} />
              <div className="skeleton" style={{ width: '45%', height: 12 }} />
            </div>
          ))}
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="sales-empty-state">
          <MessageSquare size={30} />
          <strong>No negotiations found</strong>
          <span>{search ? 'Try a different search.' : 'Customer negotiation requests will appear here.'}</span>
        </div>
      ) : (
        <div className="sales-negotiation-list">
          {visibleItems.map((item) => {
            const latestMessage = item.negotiation.messages?.[item.negotiation.messages.length - 1];
            const isSubmitted = item.negotiation.status === 'SUBMITTED';
            const isActing = actingOn === item.negotiation._id;
            return (
              <article key={item.negotiation._id} className="sales-negotiation-card">
                <div className="sales-negotiation-main">
                  <div>
                    <span className="sales-negotiation-label">Customer</span>
                    <strong>{getCustomerName(item.quotation.customer)}</strong>
                  </div>
                  <div>
                    <span className="sales-negotiation-label">Quotation</span>
                    <strong>{item.quotation.quoteNumber}</strong>
                  </div>
                  <div>
                    <span className="sales-negotiation-label">Affected line</span>
                    <strong>{affectedLine(item)}</strong>
                  </div>
                  <div>
                    <span className="sales-negotiation-label">Status</span>
                    <span className={`status-badge ${getStatusClass(item.negotiation.status)}`}>{formatStatus(item.negotiation.status)}</span>
                  </div>
                </div>

                <div className="sales-negotiation-terms">
                  <div>
                    <span>Current terms</span>
                    <strong>{money(item.quotation.total)}</strong>
                    <small>{formatStatus(item.quotation.status)} - {timeAgo(getActivityTime(item.quotation))}</small>
                  </div>
                  <div>
                    <span>Requested terms</span>
                    <strong>{describeProposedValue(latestMessage)}</strong>
                    <small>Version {item.negotiation.quotationVersion}</small>
                  </div>
                </div>

                <div className="sales-negotiation-message">
                  <span>Message</span>
                  <p>{latestMessage?.message || item.negotiation.requests?.[0]?.comment || 'No message provided.'}</p>
                </div>

                {isSubmitted && (
                  <div className="sales-negotiation-actions">
                    <input
                      className="df-input"
                      value={reasonById[item.negotiation._id] || ''}
                      onChange={(event) => setReasonById({ ...reasonById, [item.negotiation._id]: event.target.value })}
                      placeholder="Reason or internal note"
                    />
                    <button className="btn btn-success" disabled={isActing} onClick={() => decide(item.negotiation._id, 'accept')}>
                      <CheckCircle size={13} />
                      Accept
                    </button>
                    <button className="btn btn-danger" disabled={isActing} onClick={() => decide(item.negotiation._id, 'reject')}>
                      <XCircle size={13} />
                      Reject
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
