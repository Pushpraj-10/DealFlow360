'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Activity, AlertCircle, AlertTriangle, Send, TrendingDown, Zap } from 'lucide-react';
import { api, ApiClientError } from '@/lib/api';

type Alert = {
  _id: string;
  type: 'STALLED' | 'DISCOUNT_ANOMALY' | 'DELIVERY_SLIPPAGE';
  severity: string;
  status: string;
  quotation_id: string;
  details: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
};

const alertTypeConfig = {
  STALLED: {
    label: 'Stalled deal',
    issue: 'No recent activity',
    icon: <TrendingDown size={13} />,
  },
  DISCOUNT_ANOMALY: {
    label: 'Discount anomaly',
    issue: 'Discount pattern needs review',
    icon: <AlertTriangle size={13} />,
  },
  DELIVERY_SLIPPAGE: {
    label: 'Delivery slippage',
    issue: 'Delivery date may be at risk',
    icon: <Zap size={13} />,
  },
};

function getSeverityClass(severity: string): string {
  const s = severity?.toLowerCase() ?? '';
  if (s === 'high' || s === 'critical') return 'risk-high';
  if (s === 'medium') return 'risk-medium';
  if (s === 'low') return 'risk-low';
  return 'risk-none';
}

function timeAgo(value: string | null | undefined, now: number) {
  if (!value) return 'Not returned';
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 'Not returned';
  const minutes = Math.max(0, Math.round((now - timestamp) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function detailsText(details: Record<string, unknown>) {
  const entries = Object.entries(details || {});
  if (!entries.length) return 'No additional context returned';
  return entries.map(([key, value]) => `${key.replace(/_/g, ' ')}: ${String(value)}`).join(' · ');
}

export default function DealHealthPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loadedAt] = useState(() => Date.now());

  const load = () => {
    const params = new URLSearchParams();
    if (typeFilter) params.set('type', typeFilter);
    if (severityFilter) params.set('severity', severityFilter);
    if (statusFilter) params.set('status', statusFilter);

    api
      .get<Alert[]>(`/deal-health${params.toString() ? `?${params}` : ''}`)
      .then(setAlerts)
      .catch((err) =>
        setError(err instanceof ApiClientError ? err.message : 'Failed to load alerts')
      );
  };

  useEffect(load, [typeFilter, severityFilter, statusFilter]);

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

  const sortedAlerts = useMemo(() => {
    const rank: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return [...alerts].sort((a, b) => (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3));
  }, [alerts]);

  return (
    <div className="health-page">
      <div className="health-header">
        <div>
          <p className="admin-eyebrow">Insights</p>
          <h1>Deal Health</h1>
          <p>{alerts.length} deal{alerts.length === 1 ? '' : 's'} need attention</p>
        </div>
      </div>

      {error && (
        <div className="df-alert df-alert-error">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      <div className="health-toolbar">
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="df-select">
          <option value="">All issues</option>
          <option value="STALLED">Stalled</option>
          <option value="DISCOUNT_ANOMALY">Discount anomaly</option>
          <option value="DELIVERY_SLIPPAGE">Delivery slippage</option>
        </select>
        <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)} className="df-select">
          <option value="">All severity</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="df-select">
          <option value="">Open and acknowledged</option>
          <option value="OPEN">Open</option>
          <option value="ACKNOWLEDGED">Acknowledged</option>
          <option value="RESOLVED">Resolved</option>
          <option value="DISMISSED">Dismissed</option>
        </select>
      </div>

      <section className="health-panel">
        <div className="health-panel-header">
          <div>
            <p className="admin-eyebrow">Action Center</p>
            <h2>Prioritized alerts</h2>
          </div>
          <span>{sortedAlerts.length} total</span>
        </div>

        {sortedAlerts.length === 0 ? (
          <div className="df-empty">
            <Activity size={28} />
            <div className="df-empty-title">No active deal risks</div>
            <div className="df-empty-desc">Alerts appear here when deals stall or anomalies are detected.</div>
          </div>
        ) : (
          <div className="health-table-wrap">
            <table className="df-table health-table">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Customer / Deal</th>
                  <th>Issue</th>
                  <th>Time</th>
                  <th>Current action/status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedAlerts.map((alert) => {
                  const config = alertTypeConfig[alert.type] || { label: alert.type, issue: alert.type, icon: null };
                  return (
                    <tr key={alert._id} className={`health-row ${alert.severity.toLowerCase()}`}>
                      <td>
                        <span className={`risk-badge ${getSeverityClass(alert.severity)}`}>{alert.severity}</span>
                      </td>
                      <td>
                        <strong>Deal ...{alert.quotation_id.slice(-6)}</strong>
                        <small>Customer not returned</small>
                      </td>
                      <td>
                        <span className="health-issue">
                          {config.icon}
                          <strong>{config.label}</strong>
                        </span>
                        <small>{detailsText(alert.details)}</small>
                      </td>
                      <td>{timeAgo(alert.updated_at || alert.created_at, loadedAt)}</td>
                      <td>
                        <span className={`status-badge ${alert.status === 'ACKNOWLEDGED' ? 'status-pending' : 'status-info'}`}>
                          {alert.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="num">
                        <div className="health-actions">
                          <button onClick={() => handleAction(alert._id, 'nudge')} className="btn btn-sm btn-secondary">
                            <Send size={12} />
                            Nudge
                          </button>
                          <button onClick={() => handleAction(alert._id, 'escalate')} className="btn btn-sm btn-warning">
                            Escalate
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
