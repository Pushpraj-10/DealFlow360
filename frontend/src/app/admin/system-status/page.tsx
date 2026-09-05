'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Database, CheckCircle, XCircle, Loader } from 'lucide-react';

const STUB_MODULES: { label: string; path: string; description: string }[] = [
  { label: 'Negotiations', path: '/negotiations', description: 'Customer negotiation thread system' },
  { label: 'Recommendations', path: '/recommendations', description: 'Co-purchase and upsell recommendations' },
  { label: 'Risk Engine', path: '/risk-engine', description: 'Blended discount risk scoring detail' },
  { label: 'Quotation Lines', path: '/quotation-lines', description: 'Per-line reporting and audit trails' },
  { label: 'Audit Logs', path: '/audit-logs', description: 'Per-quote audit trail view' },
];

type Status = { module: string; ready: boolean };

export default function SystemStatusPage() {
  const [results, setResults] = useState<Record<string, Status | 'error'>>({});

  useEffect(() => {
    STUB_MODULES.forEach((m) => {
      api
        .get<Status>(m.path)
        .then((s) => setResults((prev) => ({ ...prev, [m.path]: s })))
        .catch(() => setResults((prev) => ({ ...prev, [m.path]: 'error' })));
    });
  }, []);

  return (
    <div className="admin-page system-status-page">
      <div className="admin-page-header system-status-page__header">
        <div>
          <p className="admin-eyebrow">Overview</p>
          <h1>System Status</h1>
          <p>Backend module availability and stub readiness.</p>
        </div>
      </div>

      <div
        style={{
          background: 'var(--amber-light)',
          border: '1px solid var(--amber-muted)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          marginBottom: 20,
          fontSize: 13,
          color: 'var(--amber)',
          lineHeight: 1.6,
        }}
      >
        These modules expose a &ldquo;ready&rdquo; status endpoint only — the underlying business logic hasn&apos;t been implemented yet. No UI is built against them to avoid presenting non-existent functionality.
      </div>

      <div className="admin-panel">
        <table className="df-table">
          <thead>
            <tr>
              <th>Module</th>
              <th>Description</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {STUB_MODULES.map((m) => {
              const result = results[m.path];
              return (
                <tr key={m.path}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Database size={13} color="var(--text-tertiary)" />
                      <span style={{ fontWeight: 500 }}>{m.label}</span>
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{m.description}</td>
                  <td>
                    {!result && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-tertiary)' }}>
                        <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} />
                        Checking…
                      </span>
                    )}
                    {result === 'error' && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--red)' }}>
                        <XCircle size={12} />
                        Unreachable
                      </span>
                    )}
                    {result && result !== 'error' && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-secondary)' }}>
                        <CheckCircle size={12} color="var(--green)" />
                        Stub ready
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
