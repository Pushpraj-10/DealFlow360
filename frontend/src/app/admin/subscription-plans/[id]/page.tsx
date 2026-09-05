'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiClientError } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { AlertCircle, ArrowLeft, CheckCircle, Trash2 } from 'lucide-react';

type Plan = {
  _id: string;
  name: string;
  cycle: string;
  proration_policy: string;
  cancellation_policy: string;
  active: boolean;
  created_at?: string;
};

type FormState = {
  name: string;
  cycle: string;
  cancellation_policy: string;
};

function formFromPlan(plan: Plan): FormState {
  return {
    name: plan.name,
    cycle: plan.cycle,
    cancellation_policy: plan.cancellation_policy,
  };
}

export default function SubscriptionPlanDetailPage() {
  const params = useParams<{ id: string }>();
  const planId = params.id;
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [plan, setPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
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
      const data = await api.get<Plan>(`/subscription-plans/${planId}`);
      setPlan(data);
      setForm(formFromPlan(data));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load subscription plan');
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    queueMicrotask(() => {
      load();
    });
  }, [load]);

  const hasChanges = !!plan && !!form &&
    (form.name !== plan.name || form.cycle !== plan.cycle || form.cancellation_policy !== plan.cancellation_policy);

  const handleSave = async () => {
    if (!plan || !form) return;
    setError(null);
    setInfo(null);
    setSaving(true);
    try {
      const data = await api.patch<Plan>(`/subscription-plans/${planId}`, form);
      setPlan(data);
      setForm(formFromPlan(data));
      setInfo('Subscription plan updated successfully.');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to update subscription plan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setError(null);
    setDeleting(true);
    try {
      await api.del(`/subscription-plans/${planId}`);
      router.push('/admin/subscription-plans');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to delete subscription plan');
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  return (
    <div className="manager-page">
      <Link href="/admin/subscription-plans" className="manager-back-link">
        <ArrowLeft size={14} />
        Subscription Plans
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

      {loading || !plan || !form ? (
        <div className="manager-detail-shell">
          <div className="manager-panel"><div className="skeleton" style={{ height: 220 }} /></div>
          <div className="manager-panel"><div className="skeleton" style={{ height: 220 }} /></div>
        </div>
      ) : (
        <>
          <section className="manager-approval-hero">
            <div>
              <p className="sales-eyebrow">Subscription Plan</p>
              <h1>{plan.name}</h1>
              <span style={{ textTransform: 'capitalize' }}>{plan.cycle} billing</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className={`status-badge ${plan.active ? 'status-active' : 'status-cancelled'}`}>
                {plan.active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </section>

          <div className="manager-detail-shell">
            <main className="manager-detail-main">
              <section className="manager-panel">
                <div className="manager-panel-header">
                  <h2>Policy</h2>
                </div>
                <div className="manager-commercial-grid">
                  <div><span>Billing cycle</span><strong style={{ fontSize: 14, textTransform: 'capitalize' }}>{plan.cycle}</strong></div>
                  <div><span>Proration policy</span><strong style={{ fontSize: 14 }}>{plan.proration_policy?.replace(/_/g, ' ')}</strong></div>
                  <div><span>Cancellation policy</span><strong style={{ fontSize: 14 }}>{plan.cancellation_policy?.replace(/_/g, ' ')}</strong></div>
                  <div><span>Created</span><strong style={{ fontSize: 14 }}>{plan.created_at ? new Date(plan.created_at).toLocaleDateString() : '—'}</strong></div>
                </div>
              </section>
            </main>

            <aside className="manager-detail-side">
              {isAdmin && (
                <section className="manager-panel manager-action-panel">
                  <div>
                    <p className="sales-eyebrow">Admin controls</p>
                    <h2>Edit plan</h2>
                    <p>Changes apply to new billing cycles and modifications going forward.</p>
                  </div>
                  <div className="df-field">
                    <label className="df-label">Plan name</label>
                    <input
                      className="df-input"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>
                  <div className="df-field">
                    <label className="df-label">Billing cycle</label>
                    <select
                      className="df-select"
                      value={form.cycle}
                      onChange={(e) => setForm({ ...form, cycle: e.target.value })}
                    >
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                  <div className="df-field" style={{ marginBottom: 0 }}>
                    <label className="df-label">Cancellation policy</label>
                    <select
                      className="df-select"
                      value={form.cancellation_policy}
                      onChange={(e) => setForm({ ...form, cancellation_policy: e.target.value })}
                    >
                      <option value="none">None</option>
                      <option value="credit_remaining">Credit Remaining</option>
                      <option value="full_refund">Full Refund</option>
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
                    <h2>Delete plan</h2>
                    <p>Deactivates the plan. Existing subscriptions keep running; it just stops appearing for new ones.</p>
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
                        {deleting ? 'Deleting...' : 'Yes, delete plan'}
                      </button>
                    </>
                  ) : (
                    <button className="btn btn-danger btn-full" onClick={() => setConfirmingDelete(true)} disabled={!plan.active}>
                      <Trash2 size={14} />
                      {plan.active ? 'Delete plan' : 'Already deactivated'}
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
