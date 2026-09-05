import type React from 'react';
import {
  Activity,
  AlertTriangle,
  BadgePercent,
  BarChart2,
  Boxes,
  CheckSquare,
  Columns3,
  CreditCard,
  Database,
  FileCheck,
  FileText,
  LayoutDashboard,
  ListFilter,
  MessageSquare,
  Package,
  Receipt,
  RefreshCw,
  Sparkles,
  Tag,
  Truck,
  UserPlus,
  Users,
  Warehouse,
} from 'lucide-react';

export type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

const size = 15;

const ITEM = {
  overview: { label: 'Overview', href: '/', icon: <LayoutDashboard size={size} /> },
  pipeline: { label: 'Pipeline', href: '/sales/pipeline', icon: <Columns3 size={size} /> },
  quotations: { label: 'Quotations', href: '/sales/quotations', icon: <FileText size={size} /> },
  negotiations: { label: 'Negotiations', href: '/sales/negotiations', icon: <MessageSquare size={size} /> },
  approvals: { label: 'Approvals', href: '/sales/approvals', icon: <CheckSquare size={size} /> },
  teamDeals: { label: 'Team Deals', href: '/sales/team-deals', icon: <Columns3 size={size} /> },
  customers: { label: 'Customers', href: '/admin/customers', icon: <Users size={size} /> },
  products: { label: 'Products', href: '/admin/products', icon: <Package size={size} /> },
  pricing: { label: 'Pricing', href: '/admin/price-lists', icon: <BadgePercent size={size} /> },
  fulfillment: { label: 'Fulfillment', href: '/operations/fulfillment', icon: <Truck size={size} /> },
  backorders: { label: 'Backorders', href: '/operations/backorders', icon: <AlertTriangle size={size} /> },
  warehouses: { label: 'Warehouses', href: '/admin/warehouses', icon: <Warehouse size={size} /> },
  inventory: { label: 'Inventory', href: '/admin/inventory', icon: <Boxes size={size} /> },
  subscriptionPlans: { label: 'Subscription Plans', href: '/admin/subscription-plans', icon: <RefreshCw size={size} /> },
  subscriptions: { label: 'Subscriptions', href: '/finance/subscriptions', icon: <RefreshCw size={size} /> },
  invoices: { label: 'Invoices', href: '/finance/invoices', icon: <Receipt size={size} /> },
  payments: { label: 'Payments', href: '/finance/payments', icon: <CreditCard size={size} /> },
  creditNotes: { label: 'Credit Notes', href: '/finance/credit-notes', icon: <CreditCard size={size} /> },
  customerTiers: { label: 'Customer Tiers', href: '/admin/customer-tiers', icon: <Tag size={size} /> },
  categories: { label: 'Categories', href: '/admin/categories', icon: <ListFilter size={size} /> },
  discountRules: { label: 'Discount Rules', href: '/admin/discount-rules', icon: <BadgePercent size={size} /> },
  approvalRules: { label: 'Approval Rules', href: '/admin/approval-rules', icon: <FileCheck size={size} /> },
  upsellRules: { label: 'Upsell Rules', href: '/admin/upsell-rules', icon: <Sparkles size={size} /> },
  internalUsers: { label: 'Internal Users', href: '/admin/users', icon: <UserPlus size={size} /> },
  dealHealth: { label: 'Deal Health', href: '/management/deal-health', icon: <Activity size={size} /> },
  reports: { label: 'Reports', href: '/management/reports', icon: <BarChart2 size={size} /> },
  systemStatus: { label: 'System Status', href: '/admin/system-status', icon: <Database size={size} /> },
} satisfies Record<string, NavItem>;

/**
 * One navigation source of truth for every internal role.
 *
 * Each role only gets the areas it actually works on day to day, cross-checked
 * against the requireRoles() guards on each module's routes. Backend setup
 * areas stay with Admin because the PRD assigns backend configuration and
 * platform-wide analytics to that role.
 */
const NAV_BY_ROLE: Record<string, NavGroup[]> = {
  SALES_REP: [
    { label: 'Workspace', items: [ITEM.overview, ITEM.pipeline, ITEM.quotations, ITEM.customers, ITEM.negotiations] },
  ],
  SALES_MANAGER: [
    { label: 'Workspace', items: [ITEM.overview, ITEM.approvals, ITEM.teamDeals, ITEM.dealHealth] },
  ],
  FINANCE: [
    { label: 'Workspace', items: [ITEM.overview, ITEM.approvals, ITEM.fulfillment, ITEM.subscriptions, ITEM.invoices, ITEM.payments] },
  ],
  ADMIN: [
    { label: 'Overview', items: [ITEM.overview] },
    { label: 'Sales', items: [ITEM.customers, ITEM.products, ITEM.pricing] },
    { label: 'Operations', items: [ITEM.warehouses, ITEM.inventory, ITEM.subscriptionPlans] },
    { label: 'Governance', items: [ITEM.discountRules, ITEM.approvalRules, ITEM.internalUsers] },
    { label: 'Insights', items: [ITEM.reports, ITEM.dealHealth] },
  ],
};

export function getNavigation(role: string): NavGroup[] {
  return NAV_BY_ROLE[role] ?? NAV_BY_ROLE.SALES_REP;
}

export function isActivePath(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

export function findActiveLabel(groups: NavGroup[], pathname: string) {
  for (const group of groups) {
    for (const item of group.items) {
      if (isActivePath(pathname, item.href)) return item.label;
    }
  }
  return null;
}
