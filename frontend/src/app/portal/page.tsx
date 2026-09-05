'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiClientError } from '@/lib/api';
import { AlertCircle, FileText, ChevronRight } from 'lucide-react';

type PortalQuotationSummary = {
  id: string;
  quoteNumber: string;
  status: string;
  grandTotal: number;
  currencyCode: string;
  updatedAt: string;
};

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

export default function PortalHomePage() {
  const router = useRouter();
  const [quotations, setQuotations] = useState<PortalQuotationSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ quotations: PortalQuotationSummary[] }>('/quotations/portal')
      .then((d) => setQuotations(d.quotations))
      .catch((err) =>
        setError(err instanceof ApiClientError ? err.message : 'Failed to load your quotations')
      );
  }, []);

  return (
    <div className="portal-page">
      <div className="portal-home-header">
        <p className="portal-eyebrow">My Quote</p>
        <h1>
          Your Quotations
        </h1>
        <p>
          Quotations shared with you by your DealFlow360 sales rep.
        </p>
      </div>

      {error && (
        <div className="df-alert df-alert-error" style={{ marginBottom: 20 }}>
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {!quotations && !error && (
        <div className="portal-skeleton">
          {[0, 1].map((i) => (
            <div key={i} className="skeleton" />
          ))}
        </div>
      )}

      {quotations && quotations.length === 0 && (
        <div className="portal-empty">
          <FileText size={22} />
          <p style={{ fontSize: 13 }}>No quotations have been shared with you yet.</p>
        </div>
      )}

      {quotations && quotations.length > 0 && (
        <div className="portal-quote-list">
          {quotations.map((q) => (
            <button
              key={q.id}
              onClick={() => router.push(`/portal/quotation/${q.id}`)}
              className="portal-quote-row"
            >
              <div>
                <FileText size={16} color="var(--accent)" />
                <div>
                  <strong>
                    {q.quoteNumber}
                  </strong>
                  <small>
                    Updated {new Date(q.updatedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                  </small>
                </div>
              </div>
              <div>
                <strong>
                  {q.currencyCode} {q.grandTotal?.toFixed(2)}
                </strong>
                <span className={`status-badge ${getStatusClass(q.status)}`} style={{ fontSize: 11, padding: '3px 10px' }}>
                  {q.status.replace(/_/g, ' ')}
                </span>
                <ChevronRight size={14} color="var(--text-tertiary)" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
