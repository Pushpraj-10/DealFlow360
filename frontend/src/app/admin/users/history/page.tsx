'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiClientError } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { AlertCircle, ArrowLeft, ChevronLeft, ChevronRight, Search } from 'lucide-react';

type Reviewer = { _id: string; fullName: string; email: string } | null;

type DirectoryRow = {
  fullName: string;
  email: string;
  role: string;
  accountStatus: string | null;
  lastRequestStatus: string | null;
  lastRequestAt: string | null;
  reviewedBy: Reviewer;
  reviewNote: string | null;
};

type Pagination = { page: number; limit: number; total: number; totalPages: number };

const PAGE_SIZE = 8;
const INTERNAL_ROLES = ['SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN'];
const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Account active' },
  { value: 'DISABLED', label: 'Account disabled' },
  { value: 'APPROVED', label: 'Request approved' },
  { value: 'REJECTED', label: 'Request rejected' },
];

function formatRole(role: string) {
  return role.replace(/_/g, ' ');
}

function accountStatusClass(status: string | null) {
  if (status === 'ACTIVE') return 'status-active';
  if (status === 'DISABLED') return 'status-draft';
  return '';
}

function requestStatusClass(status: string | null) {
  if (status === 'APPROVED') return 'status-active';
  if (status === 'REJECTED') return 'status-rejected';
  return '';
}

export default function UserHistoryPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [rows, setRows] = useState<DirectoryRow[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (search.trim()) params.set('search', search.trim());
    if (role) params.set('role', role);
    if (status) params.set('status', status);

    const handle = setTimeout(() => {
      api
        .get<{ rows: DirectoryRow[]; pagination: Pagination }>(`/users/directory?${params.toString()}`)
        .then((d) => {
          setRows(d.rows);
          setPagination(d.pagination);
        })
        .catch((err) => setError(err instanceof ApiClientError ? err.message : 'Failed to load user history'))
        .finally(() => setLoading(false));
    }, search ? 300 : 0);

    return () => clearTimeout(handle);
  }, [search, role, status, page]);

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
          <p>Every internal account and signup request, merged one row per person.</p>
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
          <span style={{ fontSize: 13, fontWeight: 600 }}>People</span>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{pagination?.total ?? 0} total</span>
        </div>
        <div style={{ display: 'flex', gap: 10, padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
          <div className="sales-filter-control" style={{ flex: 1 }}>
            <Search size={14} />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search name or email"
            />
          </div>
          <select
            className="df-select"
            style={{ maxWidth: 160 }}
            value={role}
            onChange={(e) => { setRole(e.target.value); setPage(1); }}
          >
            <option value="">All roles</option>
            {INTERNAL_ROLES.map((r) => (
              <option key={r} value={r}>{formatRole(r)}</option>
            ))}
          </select>
          <select
            className="df-select"
            style={{ maxWidth: 180 }}
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div style={{ padding: '18px' }}>
            <div className="skeleton" style={{ height: 16, marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 16, width: '80%' }} />
          </div>
        ) : rows.length === 0 ? (
          <div className="df-empty">
            <div className="df-empty-title">No one matches this filter</div>
          </div>
        ) : (
          <>
            <table className="df-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Account</th>
                  <th>Last request</th>
                  <th>Reviewed by</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.email}>
                    <td style={{ fontWeight: 500 }}>{r.fullName}</td>
                    <td>{r.email}</td>
                    <td>{formatRole(r.role)}</td>
                    <td>
                      {r.accountStatus ? (
                        <span className={`status-badge ${accountStatusClass(r.accountStatus)}`}>{r.accountStatus}</span>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No account</span>
                      )}
                    </td>
                    <td>
                      {r.lastRequestStatus ? (
                        <span className={`status-badge ${requestStatusClass(r.lastRequestStatus)}`}>{r.lastRequestStatus}</span>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>—</span>
                      )}
                    </td>
                    <td>{r.reviewedBy?.fullName || '—'}</td>
                    <td style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{r.reviewNote || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pagination && pagination.totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, padding: '12px 18px', borderTop: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Page {pagination.page} of {pagination.totalPages}</span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={pagination.page <= 1}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={13} />
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={pagination.page >= pagination.totalPages}
                  aria-label="Next page"
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
