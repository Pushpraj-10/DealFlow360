'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, ApiClientError } from '@/lib/api';
import { AlertCircle, FileText } from 'lucide-react';

type PortalQuotation = {
  id: string;
  quoteNumber: string;
  status: string;
  currencyCode: string;
  createdAt: string;
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

export default function PortalQuotationPage() {
  const params = useParams<{ id: string }>();
  const [quotation, setQuotation] = useState<PortalQuotation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ quotation: PortalQuotation }>(`/quotations/portal/${params.id}`)
      .then((d) => setQuotation(d.quotation))
      .catch((err) =>
        setError(err instanceof ApiClientError ? err.message : 'Failed to load quotation')
      );
  }, [params.id]);

  return (
    <div>
      {error && (
        <div className="df-alert df-alert-error" style={{ marginBottom: 20 }}>
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {!quotation && !error && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-tertiary)' }}>
          <div className="skeleton" style={{ width: 200, height: 24, borderRadius: 4, margin: '0 auto 12px' }} />
          <div className="skeleton" style={{ width: 280, height: 16, borderRadius: 3, margin: '0 auto 8px' }} />
          <div className="skeleton" style={{ width: 240, height: 16, borderRadius: 3, margin: '0 auto' }} />
        </div>
      )}

      {quotation && (
        <div>
          {/* Quotation identity */}
          <div
            style={{
              background: '#fff',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '28px 32px',
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <FileText size={18} color="var(--accent)" />
                  <h1
                    style={{
                      fontSize: 20,
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      fontFamily: 'monospace',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {quotation.quoteNumber}
                  </h1>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Prepared by DealFlow360 · {quotation.currencyCode}
                </p>
              </div>
              <span className={`status-badge ${getStatusClass(quotation.status)}`} style={{ fontSize: 12, padding: '4px 12px' }}>
                {quotation.status}
              </span>
            </div>

            {/* Detail grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px 24px',
                paddingTop: 20,
                borderTop: '1px solid var(--border)',
              }}
            >
              {[
                { label: 'Status', value: quotation.status },
                { label: 'Currency', value: quotation.currencyCode },
                { label: 'Created', value: new Date(quotation.createdAt).toLocaleDateString('en-IN', { dateStyle: 'long' }) },
                { label: 'Last updated', value: new Date(quotation.updatedAt).toLocaleDateString('en-IN', { dateStyle: 'long' }) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Note */}
          <div
            style={{
              background: 'var(--surface-02)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 18px',
            }}
          >
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Line-level comments, counter-discount proposals, and one-click confirmation are part
              of the negotiation module, currently in development.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
