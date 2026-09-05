'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import {
  AlertCircle,
  Building2,
  Mail,
  Plus,
  Search,
  Users,
} from 'lucide-react';
import {
  getActivityTime,
  getStatusClass,
  money,
  normalizeQuotationCard,
  timeAgo,
  type QuotationListItem,
} from '@/lib/salesRep';

type Tier = { _id: string; name: string; defaultMaxDiscountPercent?: number };
type Customer = {
  _id: string;
  name: string;
  company: string;
  email: string;
  tierId: { _id: string; name: string; defaultMaxDiscountPercent?: number } | string;
  status: string;
  phone?: string | null;
  contactPerson?: string | null;
};

function tierName(customer: Customer) {
  return typeof customer.tierId === 'object' ? customer.tierId.name : customer.tierId || 'No tier';
}

function tierDiscount(customer: Customer) {
  return typeof customer.tierId === 'object' && customer.tierId.defaultMaxDiscountPercent !== undefined
    ? `${customer.tierId.defaultMaxDiscountPercent}% default max discount`
    : 'Commercial tier configured';
}

export default function CustomersPage() {
  const { user } = useAuth();
  const canCreate = user?.role === 'ADMIN';
  const isSalesRep = user?.role === 'SALES_REP';
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [quotations, setQuotations] = useState<QuotationListItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', company: '', email: '', tierId: '' });

  const load = () => {
    api
      .get<{ customers: Customer[] }>('/customers')
      .then((d) => {
        setCustomers(d.customers);
        setSelectedCustomerId((current) => current || d.customers[0]?._id || null);
      })
      .catch((err) => setError(err instanceof ApiClientError ? err.message : 'Failed to load customers'))
      .finally(() => setLoading(false));
    if (canCreate) {
      api.get<{ tiers: Tier[] }>('/customer-tiers').then((d) => setTiers(d.tiers)).catch(() => {});
    }
    api.get<{ quotations: QuotationListItem[] }>('/quotations').then((d) => setQuotations(d.quotations.map(normalizeQuotationCard))).catch(() => {});
  };

  useEffect(load, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/customers', form);
      setShowModal(false);
      setForm({ name: '', company: '', email: '', tierId: '' });
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to create customer');
    }
  };

  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter((customer) =>
      [customer.name, customer.company, customer.email, tierName(customer)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [customers, search]);

  const quotationByCustomer = useMemo(() => {
    const map = new Map<string, QuotationListItem[]>();
    for (const quotation of quotations) {
      const customerId = quotation.customer?.id || quotation.customer?._id;
      if (!customerId) continue;
      map.set(customerId, [...(map.get(customerId) || []), quotation]);
    }
    return map;
  }, [quotations]);

  const selectedCustomer = filteredCustomers.find((customer) => customer._id === selectedCustomerId) || filteredCustomers[0] || null;
  const selectedQuotes = selectedCustomer ? quotationByCustomer.get(selectedCustomer._id) || [] : [];
  const activeQuoteCount = selectedQuotes.filter((quote) => !['CONFIRMED', 'REJECTED', 'EXPIRED', 'CANCELLED'].includes(quote.status)).length;
  const lastActivity = selectedQuotes
    .map((quote) => getActivityTime(quote))
    .filter(Boolean)
    .sort((a, b) => new Date(String(b)).getTime() - new Date(String(a)).getTime())[0];

  if (!isSalesRep) {
    return (
      <div className="df-page customers-page">
        <div className="df-page-header customers-page__header">
          <div>
            <h1 className="df-page-title">Customers</h1>
            <p className="df-page-subtitle">{customers.length} customer{customers.length !== 1 ? 's' : ''} in your workspace</p>
          </div>
          {canCreate && (
            <button onClick={() => setShowModal(true)} className="btn btn-primary">
              <Plus size={13} />
              Add Customer
            </button>
          )}
        </div>
        {error && (
          <div className="df-alert df-alert-error">
            <AlertCircle size={14} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}
        <div className="df-card customers-page__panel">
          {loading ? (
            <div style={{ padding: '18px' }}>
              <div className="skeleton" style={{ height: 16, marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 16, width: '80%', marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 16, width: '60%' }} />
            </div>
          ) : customers.length === 0 ? (
            <div className="df-empty">
              <Users size={28} style={{ margin: '0 auto 10px', color: 'var(--text-tertiary)' }} />
              <div className="df-empty-title">No customers yet</div>
              <div className="df-empty-desc">
                {canCreate ? 'Add your first customer to start building your pipeline.' : 'No customers have been added yet.'}
              </div>
            </div>
          ) : (
            <table className="df-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Company</th>
                  <th>Tier</th>
                  <th>Email</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c._id}>
                    <td style={{ fontWeight: 500 }}>{c.name}</td>
                    <td>{c.company}</td>
                    <td>
                      <span className="sales-tier-pill">{tierName(c)}</span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{c.email}</td>
                    <td>
                      <span className={`status-badge ${getStatusClass(c.status)}`}>{c.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {showModal && (
          <CustomerModal
            form={form}
            tiers={tiers}
            onClose={() => setShowModal(false)}
            onSubmit={handleCreate}
            onChange={setForm}
          />
        )}
      </div>
    );
  }

  return (
    <div className="sales-page crm-workspace-page">
      <div className="sales-page-heading crm-workspace-page__header">
        <div>
          <p className="sales-eyebrow">Customers</p>
          <h1>CRM workspace</h1>
          <p>Accounts, commercial context, and active quotation work.</p>
        </div>
        <div className="sales-filter-control">
          <Search size={15} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customers" />
        </div>
      </div>

      {error && (
        <div className="df-alert df-alert-error">
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      <div className="sales-crm-layout">
        <section className="sales-crm-list crm-workspace-page__list">
          {loading ? (
            <div style={{ padding: '18px' }}>
              <div className="skeleton" style={{ height: 44, marginBottom: 10, borderRadius: 'var(--radius-md)' }} />
              <div className="skeleton" style={{ height: 44, marginBottom: 10, borderRadius: 'var(--radius-md)' }} />
              <div className="skeleton" style={{ height: 44, borderRadius: 'var(--radius-md)' }} />
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="sales-empty-state">
              <Users size={30} />
              <strong>No customers found</strong>
              <span>Try a different search.</span>
            </div>
          ) : (
            filteredCustomers.map((customer) => {
              const customerQuotes = quotationByCustomer.get(customer._id) || [];
              const totalValue = customerQuotes.reduce((sum, quote) => sum + Number(quote.total || 0), 0);
              return (
                <button
                  key={customer._id}
                  className={`sales-customer-row ${selectedCustomer?._id === customer._id ? 'selected' : ''}`}
                  onClick={() => setSelectedCustomerId(customer._id)}
                >
                  <span>
                    <strong>{customer.company || customer.name}</strong>
                    <small>{customer.name}</small>
                  </span>
                  <span className="sales-tier-pill">{tierName(customer)}</span>
                  <span>{customerQuotes.length} quote{customerQuotes.length === 1 ? '' : 's'}</span>
                  <em>{money(totalValue)}</em>
                </button>
              );
            })
          )}
        </section>

        <section className="sales-customer-detail crm-workspace-page__detail">
          {loading ? (
            <div style={{ padding: '18px' }}>
              <div className="skeleton" style={{ height: 16, marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 16, width: '80%' }} />
            </div>
          ) : !selectedCustomer ? (
            <div className="sales-empty-state">
              <Building2 size={30} />
              <strong>Select a customer</strong>
              <span>Choose an account to review commercial context.</span>
            </div>
          ) : (
            <>
              <div className="sales-customer-identity">
                <span className="sales-customer-avatar">{(selectedCustomer.company || selectedCustomer.name).slice(0, 1)}</span>
                <span>
                  <h2>{selectedCustomer.company || selectedCustomer.name}</h2>
                  <p>{selectedCustomer.name}</p>
                </span>
              </div>

              <div className="sales-customer-context">
                <div>
                  <span>Tier</span>
                  <strong>{tierName(selectedCustomer)}</strong>
                  <small>{tierDiscount(selectedCustomer)}</small>
                </div>
                <div>
                  <span>Active quotations</span>
                  <strong>{activeQuoteCount}</strong>
                  <small>{selectedQuotes.length} total related record{selectedQuotes.length === 1 ? '' : 's'}</small>
                </div>
                <div>
                  <span>Last activity</span>
                  <strong>{timeAgo(lastActivity)}</strong>
                  <small>{selectedCustomer.status || 'No status'}</small>
                </div>
              </div>

              <div className="sales-detail-section">
                <h3>Contact</h3>
                <p><Mail size={14} /> {selectedCustomer.email}</p>
                {selectedCustomer.phone && <p>{selectedCustomer.phone}</p>}
              </div>

              <div className="sales-detail-section">
                <h3>Active quotations</h3>
                {selectedQuotes.length === 0 ? (
                  <div className="sales-empty-line">No quotation records for this customer.</div>
                ) : (
                  <div className="sales-related-list">
                    {selectedQuotes.slice(0, 6).map((quote) => (
                      <div key={quote.id}>
                        <span>
                          <strong>{quote.quoteNumber}</strong>
                          <small>{timeAgo(getActivityTime(quote))}</small>
                        </span>
                        <span className={`status-badge ${getStatusClass(quote.status)}`}>{quote.status.replace(/_/g, ' ')}</span>
                        <em>{money(quote.total)}</em>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function CustomerModal({
  form,
  tiers,
  onClose,
  onSubmit,
  onChange,
}: {
  form: { name: string; company: string; email: string; tierId: string };
  tiers: Tier[];
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  onChange: (form: { name: string; company: string; email: string; tierId: string }) => void;
}) {
  return (
    <div className="df-modal-overlay" onClick={onClose}>
      <form onSubmit={onSubmit} className="df-modal" onClick={(e) => e.stopPropagation()}>
        <div className="df-modal-header" style={{ marginBottom: 4 }}>
          <h2 className="df-modal-title">Add Customer</h2>
        </div>
        <div className="df-modal-body">
          <div className="df-field">
            <label className="df-label">Full name</label>
            <input value={form.name} onChange={(e) => onChange({ ...form, name: e.target.value })} required className="df-input" placeholder="Jane Smith" />
          </div>
          <div className="df-field">
            <label className="df-label">Company</label>
            <input value={form.company} onChange={(e) => onChange({ ...form, company: e.target.value })} required className="df-input" placeholder="Acme Corp" />
          </div>
          <div className="df-field">
            <label className="df-label">Email address</label>
            <input type="email" value={form.email} onChange={(e) => onChange({ ...form, email: e.target.value })} required className="df-input" placeholder="jane@acme.com" />
          </div>
          <div className="df-field" style={{ marginBottom: 0 }}>
            <label className="df-label">Customer tier</label>
            <select value={form.tierId} onChange={(e) => onChange({ ...form, tierId: e.target.value })} required className="df-select">
              <option value="">Select tier...</option>
              {tiers.map((t) => (
                <option key={t._id} value={t._id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="df-modal-footer">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button type="submit" className="btn btn-primary">Create Customer</button>
        </div>
      </form>
    </div>
  );
}
