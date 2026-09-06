'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiClientError } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { AlertCircle, Check, History, Inbox, UserPlus, X } from 'lucide-react';

type Reviewer = { _id: string; fullName: string; email: string } | null;

type SignupRequest = {
  id: string;
  fullName: string;
  email: string;
  proposedRole: string;
  proposedTeam: string | null;
  customerName: string | null;
  customerCompany: string | null;
  customerPhone: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedById: Reviewer;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
};

type CustomerTier = {
  _id: string;
  name: string;
  defaultMaxDiscountPercent?: number;
};

function formatRole(role: string) {
  return role.replace(/_/g, ' ');
}

export default function UsersPage() {
  const { user } = useAuth();
  // Mirrors the backend's requireRoles(ADMIN) guard on /users and
  // /users/signup-requests: only an admin reviews requests or sees accounts.
  const isAdmin = user?.role === 'ADMIN';
  const [pendingRequests, setPendingRequests] = useState<SignupRequest[]>([]);
  const [customerTiers, setCustomerTiers] = useState<CustomerTier[]>([]);
  const [customerTierByRequest, setCustomerTierByRequest] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingOnId, setActingOnId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<SignupRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = () => {
    api
      .get<{ requests: SignupRequest[] }>('/users/signup-requests?status=PENDING')
      .then((d) => {
        setPendingRequests(d.requests);
        setCustomerTierByRequest((current) => {
          const next = {...current};
          for (const request of d.requests) {
            if (request.proposedRole === 'CUSTOMER' && !next[request.id] && customerTiers[0]?._id) {
              next[request.id] = customerTiers[0]._id;
            }
          }
          return next;
        });
      })
      .catch((err) => setError(err instanceof ApiClientError ? err.message : 'Failed to load signup requests'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    api.get<{ tiers: CustomerTier[] }>('/customer-tiers')
      .then((d) => setCustomerTiers(d.tiers))
      .catch(() => {});
  }, []);

  useEffect(load, [customerTiers]);

  const handleApprove = async (request: SignupRequest) => {
    setError(null);
    setActingOnId(request.id);
    try {
      const payload = request.proposedRole === 'CUSTOMER'
        ? { customerTierId: customerTierByRequest[request.id] }
        : undefined;

      if (request.proposedRole === 'CUSTOMER' && !payload?.customerTierId) {
        throw new Error('Choose a customer tier before approving this customer.');
      }

      await api.post(`/users/signup-requests/${request.id}/approve`, payload);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve request');
    } finally {
      setActingOnId(null);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTarget) return;
    setError(null);
    setActingOnId(rejectTarget.id);
    try {
      await api.post(`/users/signup-requests/${rejectTarget.id}/reject`, { reason: rejectReason || undefined });
      setRejectTarget(null);
      setRejectReason('');
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to reject request');
    } finally {
      setActingOnId(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="admin-page users-page">
        <div className="admin-page-header users-page__header">
          <div>
            <p className="admin-eyebrow">Governance</p>
            <h1>Internal Users</h1>
          </div>
        </div>
        <div className="df-alert df-alert-error">
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>Only admins can review signup requests or view internal user accounts.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page users-page">
      <div className="admin-page-header users-page__header">
        <div>
          <p className="admin-eyebrow">Governance</p>
          <h1>Access Requests</h1>
          <p>Anyone can request an account and propose a role. Customer approvals also create the customer record.</p>
        </div>
        <Link href="/admin/users/history" className="btn btn-ghost">
          <History size={14} />
          Request History
        </Link>
      </div>

      {error && (
        <div className="df-alert df-alert-error">
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      <div className="admin-panel users-page__panel">
        <div className="admin-panel-header">
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600 }}>
            <Inbox size={14} color="var(--accent)" />
            Pending signup requests
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{pendingRequests.length} waiting</span>
        </div>
        {loading ? (
          <div style={{ padding: '18px' }}>
            <div className="skeleton" style={{ height: 16, marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 16, width: '80%' }} />
          </div>
        ) : pendingRequests.length === 0 ? (
          <div className="df-empty">
            <UserPlus size={28} style={{ margin: '0 auto 10px', color: 'var(--text-tertiary)' }} />
            <div className="df-empty-title">No pending requests</div>
            <div className="df-empty-desc">New access requests submitted from the sign-in page will show up here.</div>
          </div>
        ) : (
          <table className="df-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Proposed role</th>
                <th>Team / customer</th>
                <th>Tier</th>
                <th>Requested</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pendingRequests.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 500 }}>{r.fullName}</td>
                  <td>{r.email}</td>
                  <td>{formatRole(r.proposedRole)}</td>
                  <td>
                    {r.proposedRole === 'CUSTOMER' ? (
                      <div style={{ display: 'grid', gap: 3 }}>
                        <strong style={{ fontSize: 12 }}>{r.customerCompany || 'Customer company missing'}</strong>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {r.customerName || r.fullName}{r.customerPhone ? ` · ${r.customerPhone}` : ''}
                        </span>
                      </div>
                    ) : (
                      r.proposedTeam || '—'
                    )}
                  </td>
                  <td>
                    {r.proposedRole === 'CUSTOMER' ? (
                      <select
                        className="df-select"
                        style={{ minWidth: 150 }}
                        value={customerTierByRequest[r.id] || ''}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setCustomerTierByRequest((current) => ({ ...current, [r.id]: e.target.value }))}
                      >
                        <option value="">Select tier</option>
                        {customerTiers.map((tier) => (
                          <option key={tier._id} value={tier._id}>
                            {tier.name}
                            {tier.defaultMaxDiscountPercent !== undefined ? ` · ${tier.defaultMaxDiscountPercent}%` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td className="num">
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-success btn-sm"
                        disabled={actingOnId === r.id}
                        onClick={() => handleApprove(r)}
                      >
                        <Check size={13} />
                        Approve
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        disabled={actingOnId === r.id}
                        onClick={() => setRejectTarget(r)}
                      >
                        <X size={13} />
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {rejectTarget && (
        <div className="df-modal-overlay" onClick={() => setRejectTarget(null)}>
          <form onSubmit={handleReject} className="df-modal" onClick={(e) => e.stopPropagation()}>
            <div className="df-modal-header ops-modal-header">
              <div>
                <h2 className="df-modal-title">Reject request</h2>
                <p>{rejectTarget.fullName} · {rejectTarget.email}</p>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRejectTarget(null)}>
                <X size={14} />
              </button>
            </div>
            <div className="df-modal-body">
              <div className="df-field" style={{ marginBottom: 0 }}>
                <label className="df-label">Reason (optional)</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="df-input"
                  rows={3}
                  placeholder="Let them know why, if you want to."
                />
              </div>
            </div>
            <div className="df-modal-footer">
              <button type="button" onClick={() => setRejectTarget(null)} className="btn btn-ghost">Cancel</button>
              <button type="submit" className="btn btn-danger" disabled={actingOnId === rejectTarget.id}>
                Reject request
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
