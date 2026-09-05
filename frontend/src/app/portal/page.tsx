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
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          Your Quotations
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0, 1].map((i) => (
            <div key={i} className="skeleton" style={{ height: 64, borderRadius: 'var(--radius-md)' }} />
          ))}
        </div>
      )}

      {quotations && quotations.length === 0 && (
        <div
          style={{
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '40px 24px',
            textAlign: 'center',
            color: 'var(--text-tertiary)',
          }}
        >
          <FileText size={22} style={{ marginBottom: 10, opacity: 0.5 }} />
          <p style={{ fontSize: 13 }}>No quotations have been shared with you yet.</p>
        </div>
      )}

      {quotations && quotations.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {quotations.map((q) => (
            <button
              key={q.id}
              onClick={() => router.push(`/portal/quotation/${q.id}`)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#fff',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 18px',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <FileText size={16} color="var(--accent)" />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                    {q.quoteNumber}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    Updated {new Date(q.updatedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {q.currencyCode} {q.grandTotal?.toFixed(2)}
                </span>
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
