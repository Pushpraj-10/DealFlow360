'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const STUB_MODULES: { label: string; path: string }[] = [
  { label: 'Negotiations', path: '/negotiations' },
  { label: 'Recommendations', path: '/recommendations' },
  { label: 'Risk Engine', path: '/risk-engine' },
  { label: 'Quotation Lines (module status)', path: '/quotation-lines' },
  { label: 'Audit Logs (module status)', path: '/audit-logs' },
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
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">System Status</h1>
      <p className="text-sm text-gray-500 mb-6">
        These backend modules currently only expose a &quot;module ready&quot; status endpoint - the underlying
        business logic (co-purchase recommendations, blended risk scoring detail, live negotiation threads, per-quote
        audit trail view, per-line reporting) hasn&apos;t been built yet. No UI is built against them beyond this
        status check, to avoid presenting functionality that doesn&apos;t exist.
      </p>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-gray-600">
              <th className="pb-2">Module</th>
              <th className="pb-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {STUB_MODULES.map((m) => {
              const result = results[m.path];
              return (
                <tr key={m.path} className="border-b">
                  <td className="py-3 font-medium">{m.label}</td>
                  <td className="py-3">
                    {!result && <span className="text-gray-400">Checking...</span>}
                    {result === 'error' && <span className="text-red-600">Unreachable</span>}
                    {result && result !== 'error' && (
                      <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">Stub ready (no business logic yet)</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
