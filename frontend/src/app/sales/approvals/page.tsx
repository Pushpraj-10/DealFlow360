'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';

type ApprovalRequest = {
  _id: string;
  quotationId: { _id: string; quoteNumber: string } | string;
  riskLevel: string;
  riskScore: number;
  totalExcessDiscountExposure: number;
  status: string;
};

export default function ApprovalsPage() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reasonById, setReasonById] = useState<Record<string, string>>({});

  const load = () => {
    api
      .get<{ approvalRequests: ApprovalRequest[] }>('/approvals/pending')
      .then((d) => setRequests(d.approvalRequests))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : 'Failed to load pending approvals'));
  };

  useEffect(load, []);

  const decide = async (id: string, decision: 'approve' | 'reject' | 'return') => {
    setError(null);
    try {
      await api.post(`/approvals/requests/${id}/${decision}`, { reason: reasonById[id] || '' });
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Decision failed');
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Pending Approvals</h1>
      <p className="text-sm text-gray-500 mb-6">Only visible to Sales Manager / Finance / Admin roles.</p>

      {error && <div className="mb-4 px-3 py-2 bg-red-50 text-red-700 text-sm rounded border border-red-200">{error}</div>}

      <div className="space-y-4">
        {requests.map((req) => (
          <div key={req._id} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h2 className="font-semibold text-blue-600">{typeof req.quotationId === 'object' ? req.quotationId.quoteNumber : req.quotationId}</h2>
                <p className="text-sm text-gray-500">
                  Risk: <span className="font-medium">{req.riskLevel}</span> (score {req.riskScore}) - excess discount exposure $
                  {req.totalExcessDiscountExposure?.toFixed?.(2) ?? 0}
                </p>
              </div>
            </div>
            <input
              value={reasonById[req._id] || ''}
              onChange={(e) => setReasonById({ ...reasonById, [req._id]: e.target.value })}
              placeholder="Reason (optional for approve, recommended for reject/return)"
              className="w-full border rounded px-3 py-2 text-sm mb-3"
            />
            <div className="flex gap-2">
              <button onClick={() => decide(req._id, 'approve')} className="px-3 py-1 bg-green-600 text-white rounded text-sm">
                Approve
              </button>
              <button onClick={() => decide(req._id, 'return')} className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded text-sm">
                Return for Revision
              </button>
              <button onClick={() => decide(req._id, 'reject')} className="px-3 py-1 bg-red-100 text-red-800 rounded text-sm">
                Reject
              </button>
            </div>
          </div>
        ))}
        {requests.length === 0 && <p className="text-gray-500">No pending approvals.</p>}
      </div>
    </div>
  );
}
