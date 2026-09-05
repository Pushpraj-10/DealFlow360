'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiClientError } from '@/lib/api';
import {
  AlertCircle,
  Columns3,
  Search,
} from 'lucide-react';
import {
  formatStatus,
  getActivityTime,
  getCustomerName,
  getRiskClass,
  money,
  normalizeQuotationCard,
  timeAgo,
  type PipelineStage,
} from '@/lib/salesRep';

export default function SalesPipelinePage() {
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.get<{ stages: PipelineStage[] }>('/quotations/pipeline');
        if (!mounted) return;
        setStages(
          data.stages
            .map((stage) => ({ ...stage, cards: stage.cards.map(normalizeQuotationCard) }))
            .filter((stage) => stage.cards.length > 0)
        );
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof ApiClientError ? err.message : 'Failed to load pipeline');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const normalizedSearch = search.trim().toLowerCase();
  const visibleStages = stages
    .map((stage) => ({
      ...stage,
      cards: stage.cards.filter((card) => {
        if (!normalizedSearch) return true;
        return [
          card.quoteNumber,
          card.status,
          getCustomerName(card.customer),
          card.riskSeverity,
          card.approvalStatus,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch));
      }),
    }))
    .filter((stage) => stage.cards.length > 0);

  return (
    <div className="sales-page sales-pipeline-page">
      <div className="sales-page-heading">
        <div>
          <p className="sales-eyebrow">Pipeline</p>
          <h1>My Pipeline</h1>
          <p>Compact deal stages from your current quotations.</p>
        </div>
        <div className="sales-filter-control">
          <Search size={15} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search quotes or customers"
          />
        </div>
      </div>

      {error && (
        <div className="df-alert df-alert-error">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="sales-kanban">
          {[1, 2, 3].map((column) => (
            <section key={column} className="sales-kanban-column">
              <div className="skeleton" style={{ width: 120, height: 16 }} />
              <div className="skeleton" style={{ height: 112, borderRadius: 'var(--radius-md)' }} />
              <div className="skeleton" style={{ height: 112, borderRadius: 'var(--radius-md)' }} />
            </section>
          ))}
        </div>
      ) : visibleStages.length === 0 ? (
        <div className="sales-empty-state">
          <Columns3 size={30} />
          <strong>No pipeline cards found</strong>
          <span>{search ? 'Try a different search.' : 'Create a quotation to start building your pipeline.'}</span>
        </div>
      ) : (
        <div className="sales-kanban">
          {visibleStages.map((stage) => (
            <section key={stage.status} className="sales-kanban-column">
              <div className="sales-kanban-header">
                <span>{formatStatus(stage.status)}</span>
                <strong>{stage.cards.length}</strong>
              </div>
              <div className="sales-kanban-cards">
                {stage.cards.map((card) => (
                  <Link key={card.id} href={`/sales/quotations?quote=${card.id}`} className="sales-deal-card">
                    <span className="sales-deal-customer">{getCustomerName(card.customer)}</span>
                    <span className="sales-deal-quote">{card.quoteNumber}</span>
                    <strong>{money(card.total)}</strong>
                    <span className="sales-deal-meta">
                      <span className={`risk-dot ${getRiskClass(card.riskSeverity)}`} />
                      {card.riskSeverity || 'No risk'}
                    </span>
                    <span className="sales-deal-updated">{timeAgo(getActivityTime(card))}</span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
