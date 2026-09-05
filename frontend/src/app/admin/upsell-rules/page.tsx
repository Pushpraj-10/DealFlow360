'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { AlertCircle, Plus, Sparkles, X } from 'lucide-react';

type ProductRef = { _id: string; name: string; productType?: string; billingType?: string };
type UpsellRule = {
  _id: string;
  sourceProductId: ProductRef;
  suggestedProductIds: ProductRef[];
  coPurchaseScore: number;
  promotionBoost: number;
  minimumRequiredMarginPercent: number;
  isActive: boolean;
};

const emptyForm = {
  sourceProductId: '',
  suggestedProductIds: [] as string[],
  coPurchaseScore: '50',
  promotionBoost: '0',
  minimumRequiredMarginPercent: '0',
};

export default function UpsellRulesPage() {
  const { user } = useAuth();
  // Mirrors the backend's requireRoles() guards on /recommendations/upsell-rules:
  // Sales Manager and Admin configure pairings/promotions/margin thresholds (PRD A6).
  const canManage = user?.role === 'ADMIN' || user?.role === 'SALES_MANAGER';
  const [rules, setRules] = useState<UpsellRule[]>([]);
  const [products, setProducts] = useState<ProductRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [savingRuleId, setSavingRuleId] = useState<string | null>(null);

  const load = () => {
    api
      .get<{ rules: UpsellRule[] }>('/recommendations/upsell-rules')
      .then((d) => setRules(d.rules))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : 'Failed to load upsell rules'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    api.get<{ products: ProductRef[] }>('/products').then((d) => setProducts(d.products)).catch(() => {});
  }, []);

  const toggleSuggested = (productId: string) => {
    setForm((f) => ({
      ...f,
      suggestedProductIds: f.suggestedProductIds.includes(productId)
        ? f.suggestedProductIds.filter((id) => id !== productId)
        : [...f.suggestedProductIds, productId],
    }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/recommendations/upsell-rules', {
        sourceProductId: form.sourceProductId,
        suggestedProductIds: form.suggestedProductIds,
        coPurchaseScore: Number(form.coPurchaseScore),
        promotionBoost: Number(form.promotionBoost),
        minimumRequiredMarginPercent: Number(form.minimumRequiredMarginPercent),
      });
      setShowModal(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to create upsell rule');
    }
  };

  const handleDeactivate = async (ruleId: string) => {
    setError(null);
    setSavingRuleId(ruleId);
    try {
      await api.del(`/recommendations/upsell-rules/${ruleId}`);
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to deactivate rule');
    } finally {
      setSavingRuleId(null);
    }
  };

  const eligibleSuggestions = products.filter((p) => p._id !== form.sourceProductId);

  return (
    <div className="admin-page upsell-rules-page">
      <div className="admin-page-header upsell-rules-page__header">
        <div>
          <p className="admin-eyebrow">Governance</p>
          <h1>Upsell &amp; Cross-Sell Rules</h1>
          <p>Define product pairings, promoted suggestions, and minimum margin thresholds for the quotation builder's recommendation panel.</p>
        </div>
        {canManage && (
          <button onClick={() => setShowModal(true)} className="btn btn-primary">
            <Plus size={13} />
            Add Rule
          </button>
        )}
      </div>

      {error && (
        <div className="df-alert df-alert-error">
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      <div className="admin-panel upsell-rules-page__panel">
        {loading ? (
          <div style={{ padding: '18px' }}>
            <div className="skeleton" style={{ height: 16, marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 16, width: '80%', marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 16, width: '60%' }} />
          </div>
        ) : rules.length === 0 ? (
          <div className="df-empty">
            <Sparkles size={28} style={{ margin: '0 auto 10px', color: 'var(--text-tertiary)' }} />
            <div className="df-empty-title">No upsell rules configured</div>
            <div className="df-empty-desc">Pairings you define here appear as suggestions in the quotation builder.</div>
          </div>
        ) : (
          <table className="df-table">
            <thead>
              <tr>
                <th>Source product</th>
                <th>Suggested products</th>
                <th className="num">Co-purchase score</th>
                <th className="num">Promotion boost</th>
                <th className="num">Min margin %</th>
                <th>Status</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule._id}>
                  <td style={{ fontWeight: 500 }}>{rule.sourceProductId?.name || 'Product'}</td>
                  <td>{rule.suggestedProductIds.map((p) => p.name).join(', ')}</td>
                  <td className="num">{rule.coPurchaseScore}</td>
                  <td className="num">
                    {rule.promotionBoost > 0 ? (
                      <span className="quotation-upsell-promo-tag">Promoted +{rule.promotionBoost}</span>
                    ) : (
                      rule.promotionBoost
                    )}
                  </td>
                  <td className="num">{rule.minimumRequiredMarginPercent}%</td>
                  <td>
                    <span className={`status-badge ${rule.isActive ? 'status-active' : 'status-draft'}`}>
                      {rule.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {canManage && (
                    <td className="num">
                      {rule.isActive && (
                        <button
                          className="btn btn-ghost btn-sm"
                          disabled={savingRuleId === rule._id}
                          onClick={() => handleDeactivate(rule._id)}
                        >
                          Deactivate
                        </button>
                      )}
                    </td>
                  )}
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
              <h2 className="df-modal-title">Add Upsell Rule</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>
                <X size={14} />
              </button>
            </div>
            <div className="df-modal-body">
              <div className="df-field">
                <label className="df-label">Source product</label>
                <select
                  value={form.sourceProductId}
                  onChange={(e) => setForm({ ...form, sourceProductId: e.target.value, suggestedProductIds: [] })}
                  required
                  className="df-select"
                >
                  <option value="">Choose product...</option>
                  {products.map((p) => (
                    <option key={p._id} value={p._id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="df-field" style={{ marginBottom: 0 }}>
                <label className="df-label">Suggested products</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                  {eligibleSuggestions.length === 0 ? (
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Choose a source product first.</span>
                  ) : (
                    eligibleSuggestions.map((p) => (
                      <label key={p._id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                        <input type="checkbox" checked={form.suggestedProductIds.includes(p._id)} onChange={() => toggleSuggested(p._id)} />
                        <span style={{ color: 'var(--text-primary)' }}>{p.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 14 }}>
                <div className="df-field">
                  <label className="df-label">Co-purchase score</label>
                  <input
                    type="number"
                    min={0}
                    value={form.coPurchaseScore}
                    onChange={(e) => setForm({ ...form, coPurchaseScore: e.target.value })}
                    className="df-input"
                  />
                </div>
                <div className="df-field">
                  <label className="df-label">Promotion boost</label>
                  <input
                    type="number"
                    min={0}
                    value={form.promotionBoost}
                    onChange={(e) => setForm({ ...form, promotionBoost: e.target.value })}
                    className="df-input"
                  />
                </div>
                <div className="df-field">
                  <label className="df-label">Min margin %</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={form.minimumRequiredMarginPercent}
                    onChange={(e) => setForm({ ...form, minimumRequiredMarginPercent: e.target.value })}
                    className="df-input"
                  />
                </div>
              </div>
            </div>
            <div className="df-modal-footer">
              <button type="button" onClick={() => setShowModal(false)} className="btn btn-ghost">Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={!form.sourceProductId || form.suggestedProductIds.length === 0}>
                Create Rule
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
