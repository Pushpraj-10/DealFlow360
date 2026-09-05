'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiClientError } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle,
  Mail,
  Phone,
  Trash2,
} from 'lucide-react';
import { getStatusClass } from '@/lib/salesRep';

type Tier = { _id: string; name: string; defaultMaxDiscountPercent?: number };
type Customer = {
  _id: string;
  name: string;
  company: string;
  email: string;
  phone?: string | null;
  contactPerson?: string | null;
  tierId: { _id: string; name: string; defaultMaxDiscountPercent?: number } | string;
  status: string;
  createdAt?: string;
};

const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'ARCHIVED'];

function currentTierId(customer: Customer) {
  return typeof customer.tierId === 'object' ? customer.tierId._id : customer.tierId;
}

function tierName(customer: Customer) {
  return typeof customer.tierId === 'object' ? customer.tierId.name : 'No tier';
}

function tierDiscount(customer: Customer) {
  return typeof customer.tierId === 'object' && customer.tierId.defaultMaxDiscountPercent !== undefined
    ? `${customer.tierId.defaultMaxDiscountPercent}%`
    : '—';
}

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const customerId = params.id;
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [form, setForm] = useState({ tierId: '', status: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [customerData, tiersData] = await Promise.all([
        api.get<{ customer: Customer }>(`/customers/${customerId}`),
        isAdmin ? api.get<{ tiers: Tier[] }>('/customer-tiers') : Promise.resolve({ tiers: [] as Tier[] }),
      ]);
      setCustomer(customerData.customer);
      setTiers(tiersData.tiers);
      setForm({ tierId: currentTierId(customerData.customer), status: customerData.customer.status });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load customer');
    } finally {
      setLoading(false);
    }
  }, [customerId, isAdmin]);

  useEffect(() => {
    queueMicrotask(() => {
      load();
    });
  }, [load]);

  const hasChanges = !!customer && (form.tierId !== currentTierId(customer) || form.status !== customer.status);

  const handleSave = async () => {
    if (!customer) return;
    setError(null);
    setInfo(null);
    setSaving(true);
    try {
      const data = await api.patch<{ customer: Customer }>(`/customers/${customerId}`, {
        tierId: form.tierId,
        status: form.status,
      });
      setCustomer(data.customer);
      setForm({ tierId: currentTierId(data.customer), status: data.customer.status });
      setInfo('Customer updated successfully.');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to update customer');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setError(null);
    setDeleting(true);
    try {
      await api.del(`/customers/${customerId}`);
      router.push('/admin/customers');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to delete customer');
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  return (
    <div className="manager-page">
      <Link href="/admin/customers" className="manager-back-link">
        <ArrowLeft size={14} />
        Customers
      </Link>

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

      {loading || !customer ? (
        <div className="manager-detail-shell">
          <div className="manager-panel"><div className="skeleton" style={{ height: 220 }} /></div>
          <div className="manager-panel"><div className="skeleton" style={{ height: 220 }} /></div>
        </div>
      ) : (
        <>
          <section className="manager-approval-hero">
            <div>
              <p className="sales-eyebrow">Customer</p>
              <h1>{customer.company || customer.name}</h1>
              <span>{customer.name} · {customer.email}</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className={`status-badge ${getStatusClass(customer.status)}`}>{customer.status}</span>
            </div>
          </section>

          <div className="manager-detail-shell">
            <main className="manager-detail-main">
              <section className="manager-panel">
                <div className="manager-panel-header">
                  <h2>Contact</h2>
                </div>
                <div className="manager-commercial-grid">
                  <div><span><Mail size={12} /> Email</span><strong style={{ fontSize: 14 }}>{customer.email}</strong></div>
                  <div><span><Phone size={12} /> Phone</span><strong style={{ fontSize: 14 }}>{customer.phone || '—'}</strong></div>
                  <div><span><Building2 size={12} /> Company</span><strong style={{ fontSize: 14 }}>{customer.company}</strong></div>
                  <div><span>Contact person</span><strong style={{ fontSize: 14 }}>{customer.contactPerson || '—'}</strong></div>
                </div>
              </section>

              <section className="manager-panel">
                <div className="manager-panel-header">
                  <h2>Commercial</h2>
                </div>
                <div className="manager-commercial-grid">
                  <div><span>Tier</span><strong>{tierName(customer)}</strong></div>
                  <div><span>Max discount</span><strong>{tierDiscount(customer)}</strong></div>
                  <div><span>Status</span><strong>{customer.status}</strong></div>
                  <div><span>Customer since</span><strong style={{ fontSize: 14 }}>{customer.createdAt ? new Date(customer.createdAt).toLocaleDateString() : '—'}</strong></div>
                </div>
              </section>
            </main>

            <aside className="manager-detail-side">
              {isAdmin && (
                <section className="manager-panel manager-action-panel">
                  <div>
                    <p className="sales-eyebrow">Admin controls</p>
                    <h2>Tier &amp; status</h2>
                    <p>Changes apply immediately to pricing and workflow eligibility.</p>
                  </div>
                  <div className="df-field">
                    <label className="df-label">Customer tier</label>
                    <select
                      className="df-select"
                      value={form.tierId}
                      onChange={(e) => setForm({ ...form, tierId: e.target.value })}
                    >
                      {tiers.map((t) => (
                        <option key={t._id} value={t._id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="df-field" style={{ marginBottom: 0 }}>
                    <label className="df-label">Status</label>
                    <select
                      className="df-select"
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value })}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <button className="btn btn-primary btn-full" disabled={!hasChanges || saving} onClick={handleSave}>
                    {saving ? 'Saving...' : 'Save changes'}
                  </button>
                </section>
              )}

              {isAdmin && (
                <section className="manager-panel manager-action-panel">
                  <div>
                    <p className="sales-eyebrow">Danger zone</p>
                    <h2>Delete customer</h2>
                    <p>Archives the record. It's removed from active workflows but kept for history.</p>
                  </div>
                  {confirmingDelete ? (
                    <>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        Are you sure? This can't be undone from here.
                      </span>
                      <button className="btn btn-ghost btn-full" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
                        Cancel
                      </button>
                      <button className="btn btn-danger btn-full" onClick={handleDelete} disabled={deleting}>
                        {deleting ? 'Deleting...' : 'Yes, delete customer'}
                      </button>
                    </>
                  ) : (
                    <button className="btn btn-danger btn-full" onClick={() => setConfirmingDelete(true)}>
                      <Trash2 size={14} />
                      Delete customer
                    </button>
                  )}
                </section>
              )}
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
