'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, ApiClientError } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { AlertCircle, ArrowLeft, ChevronLeft, ChevronRight, Search, Users as UsersIcon } from 'lucide-react';

type Reviewer = { _id: string; fullName: string; email: string } | null;

type SignupRequest = {
  id: string;
  fullName: string;
  email: string;
  proposedRole: string;
  proposedTeam: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedById: Reviewer;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
};

type InternalUser = {
  _id: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
};

const PAGE_SIZE = 8;
const INTERNAL_ROLES = ['SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN'];

function formatRole(role: string) {
  return role.replace(/_/g, ' ');
}

function statusClass(status: string) {
  if (status === 'APPROVED') return 'status-active';
  if (status === 'REJECTED') return 'status-rejected';
  return 'status-pending';
}

function Pager({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, padding: '12px 18px', borderTop: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Page {page} of {totalPages}</span>
      <button className="btn btn-ghost btn-sm" onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
        <ChevronLeft size={13} />
      </button>
      <button className="btn btn-ghost btn-sm" onClick={() => onChange(page + 1)} disabled={page >= totalPages} aria-label="Next page">
        <ChevronRight size={13} />
      </button>
    </div>
  );
}

export default function UserHistoryPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [requests, setRequests] = useState<SignupRequest[]>([]);
  const [users, setUsers] = useState<InternalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [requestSearch, setRequestSearch] = useState('');
  const [requestStatusFilter, setRequestStatusFilter] = useState('ALL');
  const [requestPage, setRequestPage] = useState(1);

  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('ALL');
  const [userPage, setUserPage] = useState(1);

  useEffect(() => {
    Promise.all([
      api.get<{ requests: SignupRequest[] }>('/users/signup-requests'),
      api.get<{ users: InternalUser[] }>('/users'),
    ])
      .then(([requestsData, usersData]) => {
        setRequests(requestsData.requests.filter((r) => r.status !== 'PENDING'));
        setUsers(usersData.users);
      })
      .catch((err) => setError(err instanceof ApiClientError ? err.message : 'Failed to load history'))
      .finally(() => setLoading(false));
  }, []);

  const filteredRequests = useMemo(() => {
    const term = requestSearch.trim().toLowerCase();
    return requests.filter((r) => {
      const matchesStatus = requestStatusFilter === 'ALL' || r.status === requestStatusFilter;
      const matchesSearch = !term || [r.fullName, r.email].some((v) => v.toLowerCase().includes(term));
      return matchesStatus && matchesSearch;
    });
  }, [requests, requestSearch, requestStatusFilter]);

  const filteredUsers = useMemo(() => {
    const term = userSearch.trim().toLowerCase();
    return users.filter((u) => {
      const matchesRole = userRoleFilter === 'ALL' || u.role === userRoleFilter;
      const matchesSearch = !term || [u.fullName, u.email].some((v) => v.toLowerCase().includes(term));
      return matchesRole && matchesSearch;
    });
  }, [users, userSearch, userRoleFilter]);

  const requestTotalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));
  const userTotalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const requestPageClamped = Math.min(requestPage, requestTotalPages);
  const userPageClamped = Math.min(userPage, userTotalPages);
  const pagedRequests = filteredRequests.slice((requestPageClamped - 1) * PAGE_SIZE, requestPageClamped * PAGE_SIZE);
  const pagedUsers = filteredUsers.slice((userPageClamped - 1) * PAGE_SIZE, userPageClamped * PAGE_SIZE);

  if (!isAdmin) {
    return (
      <div className="admin-page users-page">
        <div className="df-alert df-alert-error">
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>Only admins can view this page.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page users-page">
      <Link href="/admin/users" className="manager-back-link">
        <ArrowLeft size={14} />
        Internal Users
      </Link>

      <div className="admin-page-header users-page__header">
        <div>
          <p className="admin-eyebrow">Governance</p>
          <h1>Request History</h1>
          <p>Reviewed signup requests and every active internal account.</p>
        </div>
      </div>

      {error && (
        <div className="df-alert df-alert-error">
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      <div className="admin-panel users-page__panel">
        <div className="admin-panel-header">
          <span style={{ fontSize: 13, fontWeight: 600 }}>Reviewed requests</span>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{filteredRequests.length} of {requests.length}</span>
        </div>
        <div style={{ display: 'flex', gap: 10, padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
          <div className="sales-filter-control" style={{ flex: 1 }}>
            <Search size={14} />
            <input
              value={requestSearch}
              onChange={(e) => { setRequestSearch(e.target.value); setRequestPage(1); }}
              placeholder="Search name or email"
            />
          </div>
          <select
            className="df-select"
            style={{ maxWidth: 160 }}
            value={requestStatusFilter}
            onChange={(e) => { setRequestStatusFilter(e.target.value); setRequestPage(1); }}
          >
            <option value="ALL">All statuses</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
        {loading ? (
          <div style={{ padding: '18px' }}>
            <div className="skeleton" style={{ height: 16, marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 16, width: '80%' }} />
          </div>
        ) : pagedRequests.length === 0 ? (
          <div className="df-empty">
            <div className="df-empty-title">No reviewed requests match this filter</div>
          </div>
        ) : (
          <>
            <table className="df-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Proposed role</th>
                  <th>Status</th>
                  <th>Reviewed by</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {pagedRequests.map((r) => (
                  <tr key={r.id}>
                    <td>{r.fullName}</td>
                    <td>{r.email}</td>
                    <td>{formatRole(r.proposedRole)}</td>
                    <td>
                      <span className={`status-badge ${statusClass(r.status)}`}>{r.status}</span>
                    </td>
                    <td>{r.reviewedById?.fullName || '—'}</td>
                    <td style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{r.reviewNote || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pager page={requestPageClamped} totalPages={requestTotalPages} onChange={setRequestPage} />
          </>
        )}
      </div>

      <div className="admin-panel users-page__panel" style={{ marginTop: 18 }}>
        <div className="admin-panel-header">
          <span style={{ fontSize: 13, fontWeight: 600 }}>Active accounts</span>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{filteredUsers.length} of {users.length}</span>
        </div>
        <div style={{ display: 'flex', gap: 10, padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
          <div className="sales-filter-control" style={{ flex: 1 }}>
            <Search size={14} />
            <input
              value={userSearch}
              onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }}
              placeholder="Search name or email"
            />
          </div>
          <select
            className="df-select"
            style={{ maxWidth: 160 }}
            value={userRoleFilter}
            onChange={(e) => { setUserRoleFilter(e.target.value); setUserPage(1); }}
          >
            <option value="ALL">All roles</option>
            {INTERNAL_ROLES.map((role) => (
              <option key={role} value={role}>{formatRole(role)}</option>
            ))}
          </select>
        </div>
        {loading ? (
          <div style={{ padding: '18px' }}>
            <div className="skeleton" style={{ height: 16, marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 16, width: '60%' }} />
          </div>
        ) : pagedUsers.length === 0 ? (
          <div className="df-empty">
            <UsersIcon size={28} style={{ margin: '0 auto 10px', color: 'var(--text-tertiary)' }} />
            <div className="df-empty-title">No accounts match this filter</div>
          </div>
        ) : (
          <>
            <table className="df-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pagedUsers.map((u) => (
                  <tr key={u._id}>
                    <td style={{ fontWeight: 500 }}>{u.fullName}</td>
                    <td>{u.email}</td>
                    <td>{formatRole(u.role)}</td>
                    <td>
                      <span className={`status-badge ${u.status === 'ACTIVE' ? 'status-active' : 'status-draft'}`}>
                        {u.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pager page={userPageClamped} totalPages={userTotalPages} onChange={setUserPage} />
          </>
        )}
      </div>
    </div>
  );
}
