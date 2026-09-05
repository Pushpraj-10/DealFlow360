'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';

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
    api
      .get<{ rules: Rule[] }>('/approvals/rules')
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
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Approval Rules</h1>
        <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded shadow text-sm">
          + Add Rule
        </button>
      </div>

      {error && <div className="mb-4 px-3 py-2 bg-red-50 text-red-700 text-sm rounded border border-red-200">{error}</div>}

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-gray-600">
              <th className="pb-2">Name</th>
              <th className="pb-2">Risk Range</th>
              <th className="pb-2">Severity</th>
              <th className="pb-2">Required Roles</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r._id} className="border-b">
                <td className="py-3 font-medium">{r.name}</td>
                <td className="py-3">
                  {r.minRiskScore} - {r.maxRiskScore}
                </td>
                <td className="py-3">{r.severity}</td>
                <td className="py-3">{r.requiredApprovalRoles.join(', ') || 'None'}</td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-gray-500">
                  No approval rules yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <form onSubmit={handleCreate} className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h2 className="text-xl font-bold mb-4">Add Approval Rule</h2>
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="w-full border rounded px-3 py-2" />
            </div>
            <div className="mb-3 flex gap-2">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Min Risk</label>
                <input type="number" value={form.minRiskScore} onChange={(e) => setForm({ ...form, minRiskScore: e.target.value })} className="w-full border rounded px-3 py-2" />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Max Risk</label>
                <input type="number" value={form.maxRiskScore} onChange={(e) => setForm({ ...form, maxRiskScore: e.target.value })} className="w-full border rounded px-3 py-2" />
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Severity</label>
              <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} className="w-full border rounded px-3 py-2">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium mb-1">Required Approval Roles</label>
              {ROLES.map((role) => (
                <label key={role} className="flex items-center gap-2 text-sm mb-1">
                  <input type="checkbox" checked={form.requiredApprovalRoles.includes(role)} onChange={() => toggleRole(role)} />
                  {role}
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                Create
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
