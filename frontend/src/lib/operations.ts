export type CustomerRef = string | { _id?: string; name?: string; company?: string; email?: string };

export type QuotationRef =
  | string
  | {
      _id?: string;
      quoteNumber?: string;
      quote_number?: string;
      customer?: CustomerRef;
      customerId?: CustomerRef;
      customer_id?: CustomerRef;
    };

export type Fulfillment = {
  _id: string;
  quotation_id: QuotationRef;
  status: string;
  created_at?: string;
  updated_at?: string;
};

export type Allocation = {
  _id: string;
  warehouse_id: string;
  allocated_qty: number;
  shipped_qty: number;
  status: string;
  quote_line_id?: {
    _id: string;
    productId?: { name?: string };
    variantId?: { sku?: string };
    quantity?: number;
  };
};

export type Backorder = {
  _id: string;
  fulfillment_id?: string | { _id?: string };
  quote_line_id?: string;
  qty: number;
  status: string;
  created_at?: string;
  updated_at?: string;
};

export type FulfillmentDetail = {
  fulfillment: Fulfillment;
  allocations: Allocation[];
  backorders: Backorder[];
};

export type Order = {
  _id: string;
  orderNumber: string;
  quotationId?: QuotationRef;
  quotationVersion: number;
  customerId?: CustomerRef;
  fulfillmentId?: Fulfillment | string | null;
  status: string;
  fulfillmentStatus?: string | null;
  billingStatus?: string | null;
  grandTotal: number;
  currencyCode?: string;
  flow?: {
    lastFailedStage?: string | null;
    lastError?: string | null;
    updatedAt?: string | null;
  };
  createdAt?: string;
  updatedAt?: string;
};

export type OrderLine = {
  _id: string;
  quotationLineId?: string | { _id?: string };
  productId?: string | { name?: string };
  variantId?: string | { sku?: string; name?: string };
  lineType: 'ONE_TIME' | 'RECURRING';
  requestedQty: number;
  allocatedQty: number;
  backorderQty: number;
  shippedQty: number;
  invoicedQty: number;
  lineTotal: number;
  status: string;
};

export type OrderDetail = {
  order: Order;
  lines: OrderLine[];
};

export type Warehouse = { _id: string; name: string };

export type Subscription = {
  _id: string;
  customer_id: CustomerRef;
  plan_id: { _id: string; name: string; cycle: string; interval?: string } | string;
  status: string;
  qty: number;
  recurring_unit_price_cents: number;
  next_bill_date: string;
  current_period_start?: string;
  current_period_end?: string;
};

export type Invoice = {
  _id: string;
  invoice_no: string;
  customer_id?: CustomerRef;
  quotation_id?: QuotationRef;
  order_id?: string | { _id?: string; order_no?: string };
  subscription_id?: string | { _id?: string };
  source_type?: string;
  type?: string;
  status: string;
  due_date: string;
  total_cents: number;
  paid_amount_cents: number;
  created_at?: string;
  updated_at?: string;
};

export type Payment = {
  _id: string;
  invoice_id: string;
  amount_cents: number;
  paid_at: string;
  method: string;
  reference?: string;
};

export function moneyCents(cents?: number | null) {
  return `$${((Number(cents) || 0) / 100).toFixed(2)}`;
}

export function money(value?: number | null, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function formatDate(value?: string | null) {
  if (!value) return 'Not returned';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not returned';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(value?: string | null) {
  if (!value) return 'Not returned';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not returned';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function timeAgo(value?: string | null) {
  if (!value) return 'Not returned';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return 'Not returned';
  const diff = Date.now() - then;
  const mins = Math.max(0, Math.round(diff / 60000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function formatStatus(status?: string | null) {
  return (status || 'UNKNOWN')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function operationsStatusClass(status?: string | null): string {
  const value = (status || '').toUpperCase();
  if (['ACTIVE', 'ALLOCATED', 'SHIPPED', 'FULFILLED', 'PAID', 'COMPLETED'].includes(value)) return 'status-approved';
  if (['PENDING', 'PENDING_REVIEW', 'PARTIALLY_PAID', 'SPLIT_SUGGESTED'].includes(value)) return 'status-pending';
  if (value.includes('BACKORDER') || value.includes('SHORT')) return 'status-returned';
  if (['UNPAID', 'FAILED', 'OVERDUE'].includes(value)) return 'status-unpaid';
  if (['CANCELLED', 'VOIDED'].includes(value)) return 'status-cancelled';
  return 'status-draft';
}

export function customerLabel(customer?: CustomerRef | null) {
  if (!customer) return 'Customer not returned';
  if (typeof customer === 'string') return `...${customer.slice(-8)}`;
  return customer.company || customer.name || customer.email || (customer._id ? `...${customer._id.slice(-8)}` : 'Customer not returned');
}

export function quotationLabel(quotation?: QuotationRef | null) {
  if (!quotation) return 'Quotation not returned';
  if (typeof quotation === 'string') return `...${quotation.slice(-8)}`;
  return quotation.quoteNumber || quotation.quote_number || (quotation._id ? `...${quotation._id.slice(-8)}` : 'Quotation not returned');
}

export function fulfillmentCustomer(fulfillment?: Fulfillment | null) {
  const quote = fulfillment?.quotation_id;
  if (!quote || typeof quote === 'string') return 'Customer not returned';
  return customerLabel(quote.customer || quote.customerId || quote.customer_id);
}

export function orderCustomer(order?: Order | null) {
  return customerLabel(order?.customerId || null);
}

export function orderQuotation(order?: Order | null) {
  return quotationLabel(order?.quotationId || null);
}

export function fulfillmentIdFromOrder(order?: Order | null) {
  if (!order?.fulfillmentId) return null;
  if (typeof order.fulfillmentId === 'string') return order.fulfillmentId;
  return order.fulfillmentId._id;
}

export function orderLineLabel(line: OrderLine) {
  const product = typeof line.productId === 'object' ? line.productId?.name : null;
  const variant = typeof line.variantId === 'object' ? line.variantId?.name || line.variantId?.sku : null;
  return [product, variant].filter(Boolean).join(' · ') || 'Order line';
}

export function sourceLabel(invoice: Invoice) {
  if (invoice.order_id && typeof invoice.order_id === 'object') return invoice.order_id.order_no || `...${invoice.order_id._id?.slice(-8)}`;
  if (typeof invoice.order_id === 'string') return `...${invoice.order_id.slice(-8)}`;
  if (invoice.quotation_id) return quotationLabel(invoice.quotation_id);
  if (invoice.subscription_id) return typeof invoice.subscription_id === 'string' ? `...${invoice.subscription_id.slice(-8)}` : `...${invoice.subscription_id._id?.slice(-8)}`;
  return 'Not returned';
}

export function planName(subscription: Subscription) {
  return typeof subscription.plan_id === 'object' ? subscription.plan_id.name : subscription.plan_id;
}

export function planInterval(subscription: Subscription) {
  return typeof subscription.plan_id === 'object' ? subscription.plan_id.cycle || subscription.plan_id.interval || 'Not returned' : 'Not returned';
}

export function lineLabel(allocation: Allocation) {
  return allocation.quote_line_id?.productId?.name || allocation.quote_line_id?.variantId?.sku || allocation.quote_line_id?._id?.slice(-6) || 'Line not returned';
}

export function remainingQty(allocation: Allocation) {
  return Math.max(0, Number(allocation.allocated_qty || 0) - Number(allocation.shipped_qty || 0));
}

export function isOpenFulfillment(status?: string | null) {
  return !['FULFILLED', 'SHIPPED', 'CANCELLED', 'VOIDED', 'COMPLETED'].includes((status || '').toUpperCase());
}
