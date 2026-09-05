'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import { AlertCircle, Activity, AlertTriangle, TrendingDown, Zap } from 'lucide-react';

type Alert = {
  _id: string;
  type: 'STALLED' | 'DISCOUNT_ANOMALY' | 'DELIVERY_SLIPPAGE';
  severity: string;
  status: string;
  quotation_id: string;
  details: Record<string, unknown>;
};

const alertTypeConfig = {
  STALLED: {
    label: 'Stalled Deal',
    icon: <TrendingDown size={13} />,
    class: 'risk-high',
  },
  DISCOUNT_ANOMALY: {
    label: 'Discount Anomaly',
    icon: <AlertTriangle size={13} />,
    class: 'risk-medium',
  },
  DELIVERY_SLIPPAGE: {
    label: 'Delivery Slippage',
    icon: <Zap size={13} />,
    class: 'risk-medium',
  },
};

function getSeverityClass(severity: string): string {
  const s = severity?.toLowerCase() ?? '';
  if (s === 'high' || s === 'critical') return 'risk-high';
  if (s === 'medium') return 'risk-medium';
  if (s === 'low') return 'risk-low';
  return 'risk-none';
}

export default function DealHealthPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    api
      .get<Alert[]>('/deal-health')
      .then(setAlerts)
      .catch((err) =>
        setError(err instanceof ApiClientError ? err.message : 'Failed to load alerts')
      );
  };

  useEffect(load, []);

  const handleAction = async (id: string, action: 'nudge' | 'escalate') => {
    try {
      await api.post(
        `/deal-health/${id}/${action}`,
        action === 'nudge'
          ? { message: 'Please follow up' }
          : { reason: 'Escalated from dashboard' }
      );
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Action failed');
    }
  };

  const counts = {
    STALLED: alerts.filter((a) => a.type === 'STALLED').length,
    DISCOUNT_ANOMALY: alerts.filter((a) => a.type === 'DISCOUNT_ANOMALY').length,
    DELIVERY_SLIPPAGE: alerts.filter((a) => a.type === 'DELIVERY_SLIPPAGE').length,
  };

  return (
    <div className="df-page">
      <div className="df-page-header">
        <div>
          <h1 className="df-page-title">Deal Health</h1>
          <p className="df-page-subtitle">
            {alerts.length > 0
              ? `${alerts.length} active alert${alerts.length !== 1 ? 's' : ''} require attention`
              : 'Operational intelligence across your pipeline'}
          </p>
        </div>
      </div>

      {error && (
        <div className="df-alert df-alert-error">
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { key: 'STALLED' as const, label: 'Stalled Deals', color: 'var(--red)' },
          { key: 'DISCOUNT_ANOMALY' as const, label: 'Discount Anomalies', color: 'var(--amber)' },
          { key: 'DELIVERY_SLIPPAGE' as const, label: 'Delivery Slippages', color: 'var(--amber)' },
        ].map(({ key, label, color }) => (
          <div
            key={key}
            className="df-metric"
            style={{
              borderColor: counts[key] > 0 ? (key === 'STALLED' ? 'var(--red-muted)' : 'var(--amber-muted)') : 'var(--border)',
            }}
          >
            <div className="df-metric-label">{label}</div>
            <div
              className="df-metric-value text-num"
              style={{ color: counts[key] > 0 ? color : 'var(--text-primary)' }}
            >
              {counts[key]}
            </div>
            <div className="df-metric-sub">
              {counts[key] === 0 ? 'no active alerts' : `active alert${counts[key] !== 1 ? 's' : ''}`}
            </div>
          </div>
        ))}
      </div>

      {/* Alerts table */}
      <div className="df-card">
        <div className="df-card-header">
          <span style={{ fontSize: 13, fontWeight: 600 }}>Active Alerts</span>
          {alerts.length > 0 && (
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{alerts.length} total</span>
          )}
        </div>
        {alerts.length === 0 ? (
          <div className="df-empty">
            <Activity size={28} style={{ margin: '0 auto 10px', color: 'var(--text-tertiary)' }} />
            <div className="df-empty-title">No active deal risks</div>
            <div className="df-empty-desc">Your pipeline is healthy. Alerts appear here when deals stall or anomalies are detected.</div>
          </div>
        ) : (
          <table className="df-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Quotation</th>
                <th>Severity</th>
                <th>Details</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => {
                const config = alertTypeConfig[a.type] || { label: a.type, icon: null, class: 'risk-none' };
                return (
                  <tr key={a._id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className={`risk-badge ${config.class}`} style={{ gap: 5 }}>
                          {config.icon}
                          {config.label}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--accent)' }}>
                        …{a.quotation_id.slice(-6)}
                      </span>
                    </td>
                    <td>
                      <span className={`risk-badge ${getSeverityClass(a.severity)}`}>
                        {a.severity}
                      </span>
                    </td>
                    <td style={{ maxWidth: 280 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {Object.entries(a.details)
                          .map(([k, v]) => `${k}: ${String(v)}`)
                          .join(' · ')}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleAction(a._id, 'nudge')}
                          className="btn btn-sm"
                          style={{ background: 'var(--blue-light)', color: 'var(--blue)', border: '1px solid var(--blue-muted)' }}
                        >
                          Nudge Rep
                        </button>
                        <button
                          onClick={() => handleAction(a._id, 'escalate')}
                          className="btn btn-sm btn-warning"
                        >
                          Escalate
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
