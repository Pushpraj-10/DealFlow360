export type QuotationCustomer = {
  id?: string;
  _id?: string;
  name?: string;
  company?: string;
};

export type QuotationOwner = {
  id?: string;
  _id?: string;
  fullName?: string;
  email?: string;
};

export type LastActivity = {
  action?: string;
  actorRole?: string | null;
  timestamp?: string;
};

export type QuotationListItem = {
  id: string;
  _id?: string;
  quotationId?: string;
  quoteNumber: string;
  status: string;
  total?: number;
  amount?: number;
  grandTotal?: number;
  currentVersion?: number;
  confirmedVersion?: number;
  approvalStatus?: string;
  approvalState?: string;
  riskSeverity?: string;
  customer: QuotationCustomer | null;
  owner?: QuotationOwner | null;
  createdAt?: string;
  updatedAt?: string;
  lastActivity?: LastActivity | null;
};

export type PipelineStage = {
  status: string;
  title: string;
  count: number;
  cards: QuotationListItem[];
};

export type NegotiationMessage = {
  _id: string;
  quotationLineId?: string | null;
  messageType: string;
  message: string;
  proposedValue?: Record<string, unknown> | null;
  senderRole?: string;
  createdAt?: string;
};

export type Negotiation = {
  _id: string;
  status: string;
  quotationVersion: number;
  requests?: {
    quotationLineId?: string | null;
    comment?: string | null;
    requestedDiscountPercent?: number | null;
    requestedDeliveryDate?: string | null;
  }[];
  messages?: NegotiationMessage[];
  createdAt?: string;
  updatedAt?: string;
};

export type NegotiationWorkItem = {
  quotation: QuotationListItem;
  negotiation: Negotiation;
};

export function money(value?: number | null, currency = 'USD') {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatStatus(status?: string | null) {
  return status ? status.replace(/_/g, ' ') : 'Unknown';
}

export function getStatusClass(status?: string | null): string {
  const s = status?.toLowerCase() ?? '';
  if (s === 'draft') return 'status-draft';
  if (s.includes('pending') || s.includes('approval')) return 'status-pending';
  if (s === 'approved') return 'status-approved';
  if (s === 'rejected') return 'status-rejected';
  if (s.includes('negotiat') || s === 'sent_to_customer' || s === 'ready_for_customer') return 'status-negotiating';
  if (s === 'confirmed') return 'status-confirmed';
  return 'status-draft';
}

export function getRiskClass(risk?: string | null): string {
  const r = risk?.toLowerCase() ?? '';
  if (r === 'high') return 'risk-high';
  if (r === 'medium') return 'risk-medium';
  if (r === 'low') return 'risk-low';
  return 'risk-none';
}

export function getCustomerName(customer?: QuotationCustomer | null) {
  return customer?.company || customer?.name || 'Unassigned customer';
}

export function getActivityTime(quotation: QuotationListItem) {
  return quotation.lastActivity?.timestamp || quotation.updatedAt || quotation.createdAt || null;
}

export function timeAgo(timestamp?: string | null) {
  if (!timestamp) return 'No activity yet';

  const then = new Date(timestamp).getTime();
  if (Number.isNaN(then)) return 'No activity yet';

  const seconds = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return 'Updated just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Updated ${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `Updated ${days}d ago`;

  return `Updated ${new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

export function normalizeQuotationCard(card: QuotationListItem): QuotationListItem {
  return {
    ...card,
    id: String(card.id || card.quotationId || ''),
    total: card.total ?? card.amount ?? 0,
    approvalStatus: card.approvalStatus ?? card.approvalState,
  } as QuotationListItem;
}

export function isAttentionStatus(status?: string) {
  return ['PENDING_APPROVAL', 'RETURNED_FOR_REVISION', 'UNDER_NEGOTIATION', 'REAPPROVAL_REQUIRED'].includes(status || '');
}

export function isOpenDeal(status?: string) {
  return !['CONFIRMED', 'REJECTED', 'EXPIRED', 'CANCELLED'].includes(status || '');
}
