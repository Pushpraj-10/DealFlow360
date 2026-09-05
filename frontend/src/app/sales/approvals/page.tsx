'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, ApiClientError } from '@/lib/api';
import {
  AlertCircle,
  CheckCircle,
  CheckSquare,
  Eye,
  RotateCcw,
  Search,
  XCircle,
} from 'lucide-react';
import {
  approvalAmount,
  approvalCustomer,
  approvalQuoteNumber,
  approvalRiskClass,
  approvalStatusClass,
  approvalUpdated,
  isHighRisk,
  normalizeApprovalStatus,
  requestedByName,
  type ApprovalRequest,
} from '@/lib/manager';
import { formatStatus } from '@/lib/salesRep';
import { TableSkeletonRows } from '@/components/ui/primitives';

export default function ApprovalsPage() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [reasonById, setReasonById] = useState<Record<string, string>>({});
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('');

  const load = () => {
    api
      .get<{ approvalRequests: ApprovalRequest[] }>('/approvals/pending')
      .then((d) => setRequests(d.approvalRequests))
      .catch((err) =>
        setError(err instanceof ApiClientError ? err.message : 'Failed to load pending approvals')
      )
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const decide = async (id: string, decision: 'approve' | 'reject' | 'return') => {
    setError(null);
    setInfo(null);
    setActingOn(id);
    try {
      await api.post(`/approvals/requests/${id}/${decision}`, { reason: reasonById[id] || '' });
      setInfo(`Approval ${decision === 'return' ? 'returned for revision' : `${decision}d`}.`);
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Decision failed');
    } finally {
      setActingOn(null);
    }
  };

  const visibleRequests = useMemo(() => {
    const term = search.trim().toLowerCase();
    return requests.filter((request) => {
      const matchesRisk = !riskFilter || request.riskLevel === riskFilter;
      const matchesSearch =
        !term ||
        [
          approvalCustomer(request),
          approvalQuoteNumber(request),
          request.riskLevel,
          requestedByName(request),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      return matchesRisk && matchesSearch;
    });
  }, [requests, riskFilter, search]);

  const riskOptions = Array.from(new Set(requests.map((request) => request.riskLevel))).filter(Boolean);

  return (
    <div className="manager-page approval-queue-page">
      <div className="manager-page-heading approval-queue-page__header">
        <div>
          <p className="sales-eyebrow">Approvals</p>
          <h1>Approval Queue</h1>
          <p>{requests.length} active decision{requests.length === 1 ? '' : 's'} assigned to your role.</p>
        </div>
      </div>

      {error && (
        <div className="df-alert df-alert-error">
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}
      {info && (
        <div className="df-alert df-alert-success">
          <CheckCircle size={14} style={{ flexShrink: 0 }} />
          <span>{info}</span>
        </div>
      )}

      <section className="manager-panel">
        <div className="manager-queue-toolbar">
          <div className="sales-filter-control">
            <Search size={15} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search approvals" />
          </div>
          <select className="df-select" value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}>
            <option value="">All risk levels</option>
            {riskOptions.map((risk) => (
              <option key={risk} value={risk}>{formatStatus(risk)}</option>
            ))}
          </select>
        </div>

        <div className="manager-table-wrap">
          <table className="df-table manager-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Quote</th>
                <th className="num">Amount</th>
                <th>Risk</th>
                <th>Status</th>
                <th>Requested By</th>
                <th>Waiting / Updated</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {loading && <TableSkeletonRows columns={8} />}
              {!loading && visibleRequests.map((req) => {
                const isActing = actingOn === req._id;

                return (
                  <tr key={req._id} className={isHighRisk(req) ? 'high-risk-row' : ''}>
                    <td>{approvalCustomer(req)}</td>
                    <td>
                      <Link href={`/sales/approvals/${req._id}`} className="manager-quote-link">
                        {approvalQuoteNumber(req)}
                      </Link>
                    </td>
                    <td className="num">{approvalAmount(req)}</td>
                    <td>
                      <span className="sales-risk-inline">
                        <span className={`risk-dot ${approvalRiskClass(req.riskLevel)}`} />
                        {req.riskLevel}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${approvalStatusClass(req.status)}`}>
                        {normalizeApprovalStatus(req.status)}
                      </span>
                    </td>
                    <td>{requestedByName(req)}</td>
                    <td>{approvalUpdated(req)}</td>
                    <td>
                      <div className="manager-decision-cell">
                        <input
                          value={reasonById[req._id] || ''}
                          onChange={(e) => setReasonById({ ...reasonById, [req._id]: e.target.value })}
                          placeholder="Reason"
                          className="df-input"
                        />
                        <button onClick={() => decide(req._id, 'approve')} disabled={isActing} className="btn btn-success btn-sm">
                          <CheckCircle size={13} />
                          Approve
                        </button>
                        <button onClick={() => decide(req._id, 'return')} disabled={isActing} className="btn btn-warning btn-sm">
                          <RotateCcw size={13} />
                          Return
                        </button>
                        <button onClick={() => decide(req._id, 'reject')} disabled={isActing} className="btn btn-danger btn-sm">
                          <XCircle size={13} />
                          Reject
                        </button>
                        <Link href={`/sales/approvals/${req._id}`} className="btn btn-ghost btn-sm">
                          <Eye size={13} />
                          Detail
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && visibleRequests.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <div className="sales-empty-state manager-empty">
                      <CheckSquare size={30} />
                      <strong>No approvals found</strong>
                      <span>{requests.length === 0 ? 'No pending approvals are assigned to you.' : 'Try a different filter.'}</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
