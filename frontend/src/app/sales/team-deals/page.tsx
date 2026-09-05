'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, ApiClientError } from '@/lib/api';
import { AlertCircle, Search, Users } from 'lucide-react';
import {
  formatStatus,
  getActivityTime,
  getCustomerName,
  getRiskClass,
  getStatusClass,
  money,
  normalizeQuotationCard,
  timeAgo,
  type QuotationListItem,
} from '@/lib/salesRep';

export default function TeamDealsPage() {
  const [quotations, setQuotations] = useState<QuotationListItem[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.get<{ quotations: QuotationListItem[] }>('/quotations');
        if (!mounted) return;
        setQuotations(data.quotations.map(normalizeQuotationCard));
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof ApiClientError ? err.message : 'Failed to load team deals');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const statuses = Array.from(new Set(quotations.map((quotation) => quotation.status))).filter(Boolean);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return quotations.filter((quotation) => {
      const matchesStatus = !statusFilter || quotation.status === statusFilter;
      const matchesSearch =
        !term ||
        [
          getCustomerName(quotation.customer),
          quotation.quoteNumber,
          quotation.owner?.fullName,
          quotation.riskSeverity,
          quotation.status,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      return matchesStatus && matchesSearch;
    });
  }, [quotations, search, statusFilter]);

  const totalValue = filtered.reduce((sum, quotation) => sum + Number(quotation.total || 0), 0);

  return (
    <div className="manager-page">
      <div className="manager-page-heading">
        <div>
          <p className="sales-eyebrow">Team Deals</p>
          <h1>Manager deal visibility</h1>
          <p>Customer, rep, stage, risk, and activity across accessible quotations.</p>
        </div>
      </div>

      {error && (
        <div className="df-alert df-alert-error">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      <section className="manager-secondary-strip">
        <div>
          <span>Visible deals</span>
          <strong>{loading ? '...' : filtered.length}</strong>
        </div>
        <div>
          <span>Total value</span>
          <strong>{loading ? '...' : money(totalValue)}</strong>
        </div>
        <div>
          <span>High risk</span>
          <strong>{loading ? '...' : filtered.filter((quote) => quote.riskSeverity === 'HIGH').length}</strong>
        </div>
      </section>

      <section className="manager-panel">
        <div className="manager-queue-toolbar">
          <div className="sales-filter-control">
            <Search size={15} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer, quote, or rep" />
          </div>
          <select className="df-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All stages</option>
            {statuses.map((status) => (
              <option key={status} value={status}>{formatStatus(status)}</option>
            ))}
          </select>
        </div>

        <div className="manager-table-wrap">
          <table className="df-table manager-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Quote</th>
                <th>Rep</th>
                <th className="num">Amount</th>
                <th>Stage</th>
                <th>Risk</th>
                <th>Last Activity</th>
              </tr>
            </thead>
            <tbody>
              {loading && [1, 2, 3].map((row) => (
                <tr key={row}><td colSpan={7}><div className="skeleton" style={{ height: 18 }} /></td></tr>
              ))}
              {!loading && filtered.map((quotation) => (
                <tr key={quotation.id} className={quotation.riskSeverity === 'HIGH' ? 'high-risk-row' : ''}>
                  <td>{getCustomerName(quotation.customer)}</td>
                  <td><Link className="manager-quote-link" href={`/sales/quotations?quote=${quotation.id}`}>{quotation.quoteNumber}</Link></td>
                  <td>{quotation.owner?.fullName || 'Unassigned'}</td>
                  <td className="num">{money(quotation.total)}</td>
                  <td><span className={`status-badge ${getStatusClass(quotation.status)}`}>{formatStatus(quotation.status)}</span></td>
                  <td>
                    <span className="sales-risk-inline">
                      <span className={`risk-dot ${getRiskClass(quotation.riskSeverity)}`} />
                      {quotation.riskSeverity || 'None'}
                    </span>
                  </td>
                  <td>{timeAgo(getActivityTime(quotation))}</td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="sales-empty-state manager-empty">
                      <Users size={30} />
                      <strong>No team deals found</strong>
                      <span>Try a different filter.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
