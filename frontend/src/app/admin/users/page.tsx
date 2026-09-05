'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { AlertCircle, Plus, UserPlus, X } from 'lucide-react';

type InternalUser = {
  _id: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
};

const INTERNAL_ROLES = [
  { value: 'SALES_REP', label: 'Sales Rep' },
  { value: 'SALES_MANAGER', label: 'Sales Manager' },
  { value: 'FINANCE', label: 'Finance' },
  { value: 'ADMIN', label: 'Admin' },
];

const emptyForm = { fullName: '', email: '', password: '', role: 'SALES_REP' };

export default function UsersPage() {
  const { user } = useAuth();
  // Mirrors the backend's requireRoles(ADMIN) guard on POST/GET /users:
  // internal accounts are provisioned by an admin, not self-registered.
  const isAdmin = user?.role === 'ADMIN';
  const [users, setUsers] = useState<InternalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    api
      .get<{ users: InternalUser[] }>('/users')
      .then((d) => setUsers(d.users))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : 'Failed to load users'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post('/users', form);
      setShowModal(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to create user');
    } finally {
      setSubmitting(false);
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
          <span>Only admins can view or create internal user accounts.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page users-page">
      <div className="admin-page-header users-page__header">
        <div>
          <p className="admin-eyebrow">Governance</p>
          <h1>Internal Users</h1>
          <p>Create and review internal accounts (Sales Rep, Sales Manager, Finance, Admin). Accounts are provisioned by an admin, not self-registered.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus size={13} />
          Add User
        </button>
      </div>

      {error && (
        <div className="df-alert df-alert-error">
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      <div className="admin-panel users-page__panel">
        {loading ? (
          <div style={{ padding: '18px' }}>
            <div className="skeleton" style={{ height: 16, marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 16, width: '80%', marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 16, width: '60%' }} />
          </div>
        ) : users.length === 0 ? (
          <div className="df-empty">
            <UserPlus size={28} style={{ margin: '0 auto 10px', color: 'var(--text-tertiary)' }} />
            <div className="df-empty-title">No internal users yet</div>
            <div className="df-empty-desc">Add the first internal account to get started.</div>
          </div>
        ) : (
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
              {users.map((u) => (
                <tr key={u._id}>
                  <td style={{ fontWeight: 500 }}>{u.fullName}</td>
                  <td>{u.email}</td>
                  <td>{u.role.replace('_', ' ')}</td>
                  <td>
                    <span className={`status-badge ${u.status === 'ACTIVE' ? 'status-active' : 'status-draft'}`}>
                      {u.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="df-modal-overlay" onClick={() => setShowModal(false)}>
          <form onSubmit={handleCreate} className="df-modal" onClick={(e) => e.stopPropagation()}>
            <div className="df-modal-header ops-modal-header">
              <h2 className="df-modal-title">Add Internal User</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>
                <X size={14} />
              </button>
            </div>
            <div className="df-modal-body">
              <div className="df-field">
                <label className="df-label">Full name</label>
                <input
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  required
                  className="df-input"
                  placeholder="Jane Doe"
                />
              </div>
              <div className="df-field">
                <label className="df-label">Email address</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  className="df-input"
                  placeholder="jane@company.com"
                />
              </div>
              <div className="df-field">
                <label className="df-label">Temporary password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  minLength={8}
                  className="df-input"
                  placeholder="At least 8 characters"
                />
              </div>
              <div className="df-field" style={{ marginBottom: 0 }}>
                <label className="df-label">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="df-select"
                >
                  {INTERNAL_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="df-modal-footer">
              <button type="button" onClick={() => setShowModal(false)} className="btn btn-ghost">Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Creating…' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
