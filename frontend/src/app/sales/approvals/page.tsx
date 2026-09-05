'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import { AlertCircle, CheckCircle, XCircle, RotateCcw, CheckSquare } from 'lucide-react';

type ApprovalRequest = {
  _id: string;
  quotationId: { _id: string; quoteNumber: string } | string;
  riskLevel: string;
  riskScore: number;
  totalExcessDiscountExposure: number;
  status: string;
};

function getRiskClass(risk: string): string {
  const r = risk?.toLowerCase() ?? '';
  if (r === 'high') return 'risk-high';
  if (r === 'medium') return 'risk-medium';
  if (r === 'low') return 'risk-low';
  return 'risk-none';
}

export default function ApprovalsPage() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reasonById, setReasonById] = useState<Record<string, string>>({});
  const [actingOn, setActingOn] = useState<string | null>(null);

  const load = () => {
    api
      .get<{ approvalRequests: ApprovalRequest[] }>('/approvals/pending')
      .then((d) => setRequests(d.approvalRequests))
      .catch((err) =>
        setError(err instanceof ApiClientError ? err.message : 'Failed to load pending approvals')
      );
  };

  useEffect(load, []);

  const decide = async (id: string, decision: 'approve' | 'reject' | 'return') => {
    setError(null);
    setActingOn(id);
    try {
      await api.post(`/approvals/requests/${id}/${decision}`, { reason: reasonById[id] || '' });
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Decision failed');
    } finally {
      setActingOn(null);
    }
  };

  return (
    <div className="df-page">
      {/* Page header */}
      <div className="df-page-header">
        <div>
          <h1 className="df-page-title">Approval Queue</h1>
          <p className="df-page-subtitle">
            {requests.length > 0
              ? `${requests.length} request${requests.length !== 1 ? 's' : ''} awaiting your decision`
              : 'Visible to Sales Manager, Finance, and Admin roles'}
          </p>
        </div>
      </div>

      {error && (
        <div className="df-alert df-alert-error">
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Empty state */}
      {requests.length === 0 && !error && (
        <div className="df-empty" style={{ paddingTop: 80 }}>
          <CheckSquare size={36} className="df-empty-icon" />
          <div className="df-empty-title">You're all caught up</div>
          <div className="df-empty-desc">No pending approvals at this time.</div>
        </div>
      )}

      {/* Approval queue */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {requests.map((req, idx) => {
          const quoteNumber =
            typeof req.quotationId === 'object' ? req.quotationId.quoteNumber : req.quotationId;
          const isActing = actingOn === req._id;

          return (
            <div
              key={req._id}
              style={{
                background: 'var(--surface-01)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '20px 24px',
                marginBottom: 10,
                opacity: isActing ? 0.6 : 1,
                transition: 'opacity 200ms',
              }}
            >
              {/* Header row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  marginBottom: 14,
                  gap: 16,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        fontFamily: 'monospace',
                      }}
                    >
                      {quoteNumber}
                    </span>
                    <span className={`risk-badge ${getRiskClass(req.riskLevel)}`}>{req.riskLevel}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 20, fontSize: 12, color: 'var(--text-secondary)' }}>
                    <span>
                      Risk score:{' '}
                      <strong style={{ color: 'var(--text-primary)' }}>{req.riskScore}</strong>
                    </span>
                    <span>
                      Excess discount exposure:{' '}
                      <strong
                        style={{
                          color:
                            req.totalExcessDiscountExposure > 0 ? 'var(--amber)' : 'var(--text-primary)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        ${req.totalExcessDiscountExposure?.toFixed?.(2) ?? '0.00'}
                      </strong>
                    </span>
                  </div>
                </div>

                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--text-tertiary)',
                    background: 'var(--surface-02)',
                    padding: '2px 8px',
                    borderRadius: 99,
                    whiteSpace: 'nowrap',
                  }}
                >
                  #{idx + 1}
                </span>
              </div>

              {/* Reason input */}
              <div style={{ marginBottom: 14 }}>
                <label className="df-label">Reason / note</label>
                <input
                  value={reasonById[req._id] || ''}
                  onChange={(e) =>
                    setReasonById({ ...reasonById, [req._id]: e.target.value })
                  }
                  placeholder="Optional for approve — recommended for reject or return"
                  className="df-input"
                />
              </div>

              {/* Action buttons */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <button
                  onClick={() => decide(req._id, 'approve')}
                  disabled={isActing}
                  className="btn btn-success"
                  style={{ gap: 6 }}
                >
                  <CheckCircle size={13} />
                  Approve
                </button>
                <button
                  onClick={() => decide(req._id, 'return')}
                  disabled={isActing}
                  className="btn btn-warning"
                  style={{ gap: 6 }}
                >
                  <RotateCcw size={13} />
                  Return for Revision
                </button>
                <div style={{ flex: 1 }} />
                <button
                  onClick={() => decide(req._id, 'reject')}
                  disabled={isActing}
                  className="btn btn-danger"
                  style={{ gap: 6 }}
                >
                  <XCircle size={13} />
                  Reject
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
