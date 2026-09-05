import {
  formatStatus,
  getActivityTime,
  getCustomerName,
  getRiskClass,
  getStatusClass,
  money,
  timeAgo,
  type QuotationListItem,
} from './salesRep';

export type UserRef = {
  _id?: string;
  id?: string;
  fullName?: string;
  email?: string;
  role?: string;
};

export type ApprovalStep = {
  _id?: string;
  sequence: number;
  requiredRole: string;
  role?: string;
  status: string;
  reviewerId?: UserRef | string | null;
  decisionAt?: string | null;
  actedAt?: string | null;
  reason?: string | null;
};

export type ApprovalRequest = {
  _id: string;
  quotationId: QuotationListItem | string;
  quotationVersion: number;
  requestedById?: UserRef | string | null;
  riskLevel: string;
  riskScore: number;
  totalExcessDiscountExposure: number;
  status: string;
  steps?: ApprovalStep[];
  createdAt?: string;
  updatedAt?: string;
};

export type QuotationLine = {
  _id: string;
  productId?: { name?: string; productType?: string; billingType?: string } | string;
  variantId?: { name?: string; sku?: string } | string | null;
  quantity?: number;
  unitPrice?: number;
  discountPercent?: number;
  actual_discount?: number;
  allowed_discount?: number;
  allowedDiscountPercent?: number;
  excess_discount?: number;
  is_violation?: boolean;
  lineTotal?: number;
};

export type RiskLine = {
  lineId: string;
  productName: string;
  actualDiscount: number;
  allowedDiscount: number;
  excessDiscount: number;
  weightedContribution: number;
  exposureAmount: number;
  isViolation: boolean;
};

export type RiskResult = {
  totalRiskScore: number;
  severity: string;
  totalExcessDiscountExposure: number;
  explanation?: string;
  lines?: RiskLine[];
};

export type AuditLog = {
  _id: string;
  actorId?: UserRef | string | null;
  actorRole?: string;
  action: string;
  reason?: string | null;
  createdAt?: string;
};

export function quoteFromApproval(request: ApprovalRequest): QuotationListItem | null {
  return typeof request.quotationId === 'object' ? request.quotationId : null;
}

export function requestedByName(request: ApprovalRequest) {
  return typeof request.requestedById === 'object' && request.requestedById
    ? request.requestedById.fullName || request.requestedById.email || 'Unknown requester'
    : 'Unknown requester';
}

export function reviewerName(step: ApprovalStep) {
  return typeof step.reviewerId === 'object' && step.reviewerId
    ? step.reviewerId.fullName || step.reviewerId.email || step.requiredRole
    : step.requiredRole.replace(/_/g, ' ');
}

export function approvalQuoteId(request: ApprovalRequest) {
  const quote = quoteFromApproval(request);
  return quote?.id || quote?._id || (typeof request.quotationId === 'string' ? request.quotationId : '');
}

export function approvalAmount(request: ApprovalRequest) {
  const quote = quoteFromApproval(request);
  return money(quote?.total || quote?.grandTotal || 0);
}

export function approvalCustomer(request: ApprovalRequest) {
  const quote = quoteFromApproval(request);
  const customer = quote?.customer || (quote as unknown as { customerId?: QuotationListItem['customer'] })?.customerId;
  return getCustomerName(customer || null);
}

export function approvalQuoteNumber(request: ApprovalRequest) {
  return quoteFromApproval(request)?.quoteNumber || 'Quotation';
}

export function approvalUpdated(request: ApprovalRequest) {
  const quote = quoteFromApproval(request);
  return timeAgo(request.updatedAt || getActivityTime(quote as QuotationListItem));
}

export function approvalStatusClass(status?: string) {
  return getStatusClass(status || 'PENDING');
}

export function approvalRiskClass(risk?: string) {
  return getRiskClass(risk || 'NONE');
}

export function normalizeApprovalStatus(status?: string) {
  return formatStatus(status || 'Pending');
}

export function isHighRisk(request: ApprovalRequest) {
  return request.riskLevel === 'HIGH';
}
