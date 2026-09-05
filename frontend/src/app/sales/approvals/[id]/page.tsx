'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, ApiClientError } from '@/lib/api';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Circle,
  Clock3,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import {
  approvalAmount,
  approvalQuoteId,
  approvalQuoteNumber,
  approvalRiskClass,
  approvalStatusClass,
  normalizeApprovalStatus,
  requestedByName,
  reviewerName,
  type ApprovalRequest,
  type AuditLog,
  type QuotationLine,
  type RiskResult,
} from '@/lib/manager';
import { formatStatus, getCustomerName, money, timeAgo } from '@/lib/salesRep';

type QuotationDetail = {
  quotation: {
    _id: string;
    quoteNumber: string;
    status: string;
    approvalStatus?: string;
    customerId?: { name?: string; company?: string; email?: string } | string | null;
    ownerId?: { fullName?: string; email?: string } | string | null;
    salesRepId?: { fullName?: string; email?: string } | string | null;
    grandTotal?: number;
    subtotal?: number;
    totalDiscount?: number;
    tax?: number;
    currentVersion?: number;
  };
  lines: QuotationLine[];
};

function productName(line: QuotationLine) {
  return typeof line.productId === 'object' && line.productId ? line.productId.name || 'Product' : 'Product';
}

function stepIcon(status: string) {
  if (status === 'APPROVED') return <CheckCircle size={15} />;
  if (status === 'REJECTED') return <XCircle size={15} />;
  if (status === 'RETURNED') return <RotateCcw size={15} />;
  if (status === 'ACTIVE') return <Clock3 size={15} />;
  return <Circle size={15} />;
}

export default function ApprovalDetailPage() {
  const params = useParams<{ id: string }>();
  const approvalId = params.id;
  const [approval, setApproval] = useState<ApprovalRequest | null>(null);
  const [quotationDetail, setQuotationDetail] = useState<QuotationDetail | null>(null);
  const [risk, setRisk] = useState<RiskResult | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const approvalData = await api.get<{ approvalRequest: ApprovalRequest }>(`/approvals/requests/${approvalId}`);
      const request = approvalData.approvalRequest;
      const quotationId = approvalQuoteId(request);
      const [detailData, riskData, auditData] = await Promise.all([
        api.get<QuotationDetail>(`/quotations/${quotationId}`),
        api.get<{ risk: RiskResult }>(`/quotations/${quotationId}/risk`),
        api.get<{ auditLogs: AuditLog[] }>(`/audit-logs/quotations/${quotationId}`),
      ]);
      setApproval(request);
      setQuotationDetail(detailData);
      setRisk(riskData.risk);
      setAuditLogs(auditData.auditLogs);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load approval detail');
    } finally {
      setLoading(false);
    }
  }, [approvalId]);

  useEffect(() => {
    queueMicrotask(() => {
      load();
    });
  }, [load]);

  const decide = async (decision: 'approve' | 'reject' | 'return') => {
    setError(null);
    setInfo(null);
    setActing(true);
    try {
      await api.post(`/approvals/requests/${approvalId}/${decision}`, { reason });
      setInfo(`Approval ${decision === 'return' ? 'returned for revision' : `${decision}d`}.`);
      setReason('');
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Decision failed');
    } finally {
      setActing(false);
    }
  };

  const quote = quotationDetail?.quotation;
  const customer = typeof quote?.customerId === 'object' ? quote.customerId : null;
  const salesRep = typeof quote?.salesRepId === 'object' ? quote.salesRepId : typeof quote?.ownerId === 'object' ? quote.ownerId : null;
  const violationLines = quotationDetail?.lines.filter((line) => line.is_violation) || [];
  const activeStep = approval?.steps?.find((step) => step.status === 'ACTIVE');

  return (
    <div className="manager-page">
      <Link href="/sales/approvals" className="manager-back-link">
        <ArrowLeft size={14} />
        Approval queue
      </Link>

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

      {loading || !approval ? (
        <div className="manager-detail-shell">
          <div className="manager-panel"><div className="skeleton" style={{ height: 220 }} /></div>
          <div className="manager-panel"><div className="skeleton" style={{ height: 220 }} /></div>
        </div>
      ) : (
        <>
          <section className="manager-approval-hero">
            <div>
              <p className="sales-eyebrow">Approval Detail</p>
              <h1>{approvalQuoteNumber(approval)} · {customer ? getCustomerName(customer) : 'Customer'}</h1>
              <span>{salesRep?.fullName ? `Requested by ${salesRep.fullName}` : `Requested by ${requestedByName(approval)}`}</span>
            </div>
            <div className="manager-approval-amount">
              <strong>{quote?.grandTotal !== undefined ? money(quote.grandTotal) : approvalAmount(approval)}</strong>
              <span className={`risk-badge ${approvalRiskClass(approval.riskLevel)}`}>{approval.riskLevel} Risk</span>
            </div>
          </section>

          <div className="manager-detail-shell">
            <main className="manager-detail-main">
              <section className="manager-panel">
                <div className="manager-panel-header">
                  <div>
                    <p className="sales-eyebrow">What is the deal?</p>
                    <h2>Commercial summary</h2>
                  </div>
                  <span className={`status-badge ${approvalStatusClass(approval.status)}`}>{normalizeApprovalStatus(approval.status)}</span>
                </div>
                <div className="manager-commercial-grid">
                  <div><span>Subtotal</span><strong>{money(quote?.subtotal)}</strong></div>
                  <div><span>Discount</span><strong>{money(quote?.totalDiscount)}</strong></div>
                  <div><span>Tax</span><strong>{money(quote?.tax)}</strong></div>
                  <div><span>Version</span><strong>{quote?.currentVersion || approval.quotationVersion}</strong></div>
                </div>
              </section>

              <section className="manager-panel">
                <div className="manager-panel-header">
                  <div>
                    <p className="sales-eyebrow">Why approval is required</p>
                    <h2>Discount policy comparison</h2>
                  </div>
                </div>
                {violationLines.length === 0 ? (
                  <div className="sales-empty-line">No line-level discount violation was returned for this quotation.</div>
                ) : (
                  <div className="manager-violation-list">
                    {violationLines.map((line) => (
                      <div key={line._id}>
                        <strong>{productName(line)}</strong>
                        <dl>
                          <div><dt>Discount</dt><dd>{line.discountPercent ?? line.actual_discount ?? 0}%</dd></div>
                          <div><dt>Policy limit</dt><dd>{line.allowed_discount ?? line.allowedDiscountPercent ?? 0}%</dd></div>
                          <div><dt>Difference</dt><dd>+{line.excess_discount ?? 0}%</dd></div>
                        </dl>
                      </div>
                    ))}
                  </div>
                )}
                {risk?.explanation && <p className="manager-risk-explanation">{risk.explanation}</p>}
              </section>

              <section className="manager-panel">
                <div className="manager-panel-header">
                  <div>
                    <p className="sales-eyebrow">Commercial impact</p>
                    <h2>Risk breakdown</h2>
                  </div>
                  <strong className="manager-risk-score">{risk?.totalRiskScore ?? approval.riskScore}</strong>
                </div>
                <div className="manager-table-wrap">
                  <table className="df-table manager-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th className="num">Actual</th>
                        <th className="num">Allowed</th>
                        <th className="num">Excess</th>
                        <th className="num">Weighted</th>
                        <th className="num">Exposure</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(risk?.lines || []).map((line) => (
                        <tr key={line.lineId} className={line.isViolation ? 'high-risk-row' : ''}>
                          <td>{line.productName}</td>
                          <td className="num">{line.actualDiscount}%</td>
                          <td className="num">{line.allowedDiscount}%</td>
                          <td className="num">{line.excessDiscount}%</td>
                          <td className="num">{line.weightedContribution}</td>
                          <td className="num">{money(line.exposureAmount)}</td>
                        </tr>
                      ))}
                      {(!risk?.lines || risk.lines.length === 0) && (
                        <tr><td colSpan={6}><div className="sales-empty-line">No risk line breakdown available.</div></td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="manager-panel">
                <div className="manager-panel-header">
                  <div>
                    <p className="sales-eyebrow">Audit history</p>
                    <h2>Chronological events</h2>
                  </div>
                </div>
                <div className="manager-audit-list">
                  {auditLogs.map((log) => (
                    <div key={log._id}>
                      <span>{typeof log.actorId === 'object' && log.actorId ? log.actorId.fullName || log.actorId.email : log.actorRole || 'System'}</span>
                      <strong>{formatStatus(log.action)}</strong>
                      <em>{timeAgo(log.createdAt)}</em>
                      {log.reason && <small>{log.reason}</small>}
                    </div>
                  ))}
                  {auditLogs.length === 0 && <div className="sales-empty-line">No audit events were returned for this quotation.</div>}
                </div>
              </section>
            </main>

            <aside className="manager-detail-side">
              <section className="manager-panel">
                <div className="manager-panel-header">
                  <div>
                    <p className="sales-eyebrow">Who must approve?</p>
                    <h2>Approval progress</h2>
                  </div>
                </div>
                <div className="manager-approval-timeline">
                  <div className="complete">
                    <span><CheckCircle size={15} /></span>
                    <strong>Submitted</strong>
                    <small>{requestedByName(approval)} · {timeAgo(approval.createdAt)}</small>
                  </div>
                  {(approval.steps || []).sort((a, b) => a.sequence - b.sequence).map((step) => (
                    <div key={step._id || `${step.sequence}-${step.requiredRole}`} className={step.status.toLowerCase()}>
                      <span>{stepIcon(step.status)}</span>
                      <strong>{formatStatus(step.requiredRole)}</strong>
                      <small>
                        {step.status === 'ACTIVE'
                          ? 'Awaiting your decision'
                          : step.decisionAt
                            ? `${reviewerName(step)} · ${timeAgo(step.decisionAt)}`
                            : step.status === 'PENDING'
                              ? 'Required after prior approval'
                              : normalizeApprovalStatus(step.status)}
                      </small>
                    </div>
                  ))}
                  <div className={quote?.status === 'CONFIRMED' ? 'complete' : ''}>
                    <span>{quote?.status === 'CONFIRMED' ? <CheckCircle size={15} /> : <Circle size={15} />}</span>
                    <strong>Confirmed</strong>
                    <small>{quote?.status === 'CONFIRMED' ? 'Customer confirmed' : 'After approvals and customer action'}</small>
                  </div>
                </div>
              </section>

              <section className="manager-panel manager-action-panel">
                <div>
                  <p className="sales-eyebrow">What action should I take?</p>
                  <h2>Decision</h2>
                  <p>{activeStep ? `${formatStatus(activeStep.requiredRole)} is the active approval step.` : 'No active step was returned.'}</p>
                </div>
                <textarea
                  className="df-input"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Reason required for reject or return"
                  rows={4}
                />
                <button className="btn btn-primary btn-full" disabled={acting} onClick={() => decide('approve')}>
                  <CheckCircle size={14} />
                  Approve
                </button>
                <button className="btn btn-warning btn-full" disabled={acting} onClick={() => decide('return')}>
                  <RotateCcw size={14} />
                  Return for Revision
                </button>
                <button className="btn btn-danger btn-full" disabled={acting} onClick={() => decide('reject')}>
                  <XCircle size={14} />
                  Reject
                </button>
              </section>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
