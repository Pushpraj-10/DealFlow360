'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import { AlertCircle, Plus, FileCheck } from 'lucide-react';

type Rule = {
  _id: string;
  name: string;
  minRiskScore: number;
  maxRiskScore: number;
  severity: string;
  requiredApprovalRoles: string[];
  isActive: boolean;
};

const ROLES = ['SALES_MANAGER', 'FINANCE', 'ADMIN'];

function getSeverityClass(s: string) {
  if (s === 'HIGH') return 'risk-high';
  if (s === 'MEDIUM') return 'risk-medium';
  if (s === 'LOW') return 'risk-low';
  return 'risk-none';
}

export default function ApprovalRulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: '',
    minRiskScore: '0',
    maxRiskScore: '100',
    severity: 'MEDIUM',
    requiredApprovalRoles: [] as string[],
  });

  const load = () => {
    api.get<{ rules: Rule[] }>('/approvals/rules')
      .then((d) => setRules(d.rules))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : 'Failed to load approval rules'));
  };

  useEffect(load, []);

  const toggleRole = (role: string) => {
    setForm((f) => ({
      ...f,
      requiredApprovalRoles: f.requiredApprovalRoles.includes(role)
        ? f.requiredApprovalRoles.filter((r) => r !== role)
        : [...f.requiredApprovalRoles, role],
    }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/approvals/rules', {
        ...form,
        minRiskScore: Number(form.minRiskScore),
        maxRiskScore: Number(form.maxRiskScore),
      });
      setShowModal(false);
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to create rule');
    }
  };

  return (
    <div className="df-page">
      <div className="df-page-header">
        <div>
          <h1 className="df-page-title">Approval Rules</h1>
          <p className="df-page-subtitle">Define which risk bands require approval and who approves them</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus size={13} />
          Add Rule
        </button>
      </div>

      {error && (
        <div className="df-alert df-alert-error">
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      <div className="df-card">
        {rules.length === 0 ? (
          <div className="df-empty">
            <FileCheck size={28} style={{ margin: '0 auto 10px', color: 'var(--text-tertiary)' }} />
            <div className="df-empty-title">No approval rules</div>
            <div className="df-empty-desc">Rules map risk score ranges to required approvers.</div>
          </div>
        ) : (
          <table className="df-table">
            <thead>
              <tr>
                <th>Rule Name</th>
                <th>Risk Range</th>
                <th>Severity</th>
                <th>Required Approvers</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r._id}>
                  <td style={{ fontWeight: 500 }}>{r.name}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>
                    {r.minRiskScore} – {r.maxRiskScore}
                  </td>
                  <td>
                    <span className={`risk-badge ${getSeverityClass(r.severity)}`}>{r.severity}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {r.requiredApprovalRoles.length === 0 ? (
                        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>None</span>
                      ) : (
                        r.requiredApprovalRoles.map((role) => (
                          <span key={role} style={{ fontSize: 11, background: 'var(--surface-02)', border: '1px solid var(--border)', padding: '2px 7px', borderRadius: 99, color: 'var(--text-secondary)' }}>
                            {role.replace('_', ' ')}
                          </span>
                        ))
                      )}
                    </div>
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
            <div className="df-modal-header" style={{ marginBottom: 4 }}>
              <h2 className="df-modal-title">Add Approval Rule</h2>
            </div>
            <div className="df-modal-body">
              <div className="df-field">
                <label className="df-label">Rule name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="df-input" placeholder="e.g. High Risk Escalation" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="df-field">
                  <label className="df-label">Min risk score</label>
                  <input type="number" value={form.minRiskScore} onChange={(e) => setForm({ ...form, minRiskScore: e.target.value })} className="df-input" />
                </div>
                <div className="df-field">
                  <label className="df-label">Max risk score</label>
                  <input type="number" value={form.maxRiskScore} onChange={(e) => setForm({ ...form, maxRiskScore: e.target.value })} className="df-input" />
                </div>
              </div>
              <div className="df-field">
                <label className="df-label">Severity</label>
                <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} className="df-select">
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </div>
              <div className="df-field" style={{ marginBottom: 0 }}>
                <label className="df-label">Required approval roles</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {ROLES.map((role) => (
                    <label key={role} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                      <input type="checkbox" checked={form.requiredApprovalRoles.includes(role)} onChange={() => toggleRole(role)} />
                      <span style={{ color: 'var(--text-primary)' }}>{role.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="df-modal-footer">
              <button type="button" onClick={() => setShowModal(false)} className="btn btn-ghost">Cancel</button>
              <button type="submit" className="btn btn-primary">Create Rule</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
