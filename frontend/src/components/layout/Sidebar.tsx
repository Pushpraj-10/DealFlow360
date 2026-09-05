'use client';

import type React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  BadgePercent,
  BarChart2,
  Boxes,
  CheckSquare,
  CreditCard,
  Database,
  FileCheck,
  FileText,
  LayoutDashboard,
  ListFilter,
  Package,
  Receipt,
  RefreshCw,
  Tag,
  Truck,
  Users,
  Warehouse,
} from 'lucide-react';

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

// Admin sees every module - this is the union of everything verified
// accessible to ADMIN across the backend's requireRoles() guards.
const adminNavGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ label: 'Overview', href: '/', icon: <LayoutDashboard size={15} /> }],
  },
  {
    label: 'Workspace',
    items: [
      { label: 'Quotations', href: '/sales/quotations', icon: <FileText size={15} /> },
      { label: 'Approvals', href: '/sales/approvals', icon: <CheckSquare size={15} /> },
    ],
  },
  {
    label: 'Sales',
    items: [
      { label: 'Customers', href: '/admin/customers', icon: <Users size={15} /> },
      { label: 'Products', href: '/admin/products', icon: <Package size={15} /> },
      { label: 'Pricing', href: '/admin/price-lists', icon: <BadgePercent size={15} /> },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Fulfillment', href: '/operations/fulfillment', icon: <Truck size={15} /> },
      { label: 'Backorders', href: '/operations/backorders', icon: <AlertTriangle size={15} /> },
      { label: 'Warehouses', href: '/admin/warehouses', icon: <Warehouse size={15} /> },
      { label: 'Inventory', href: '/admin/inventory', icon: <Boxes size={15} /> },
      { label: 'Subscription Plans', href: '/admin/subscription-plans', icon: <RefreshCw size={15} /> },
    ],
  },
  {
    label: 'Finance',
    items: [
      { label: 'Subscriptions', href: '/finance/subscriptions', icon: <RefreshCw size={15} /> },
      { label: 'Invoices', href: '/finance/invoices', icon: <Receipt size={15} /> },
      { label: 'Payments', href: '/finance/payments', icon: <CreditCard size={15} /> },
      { label: 'Credit Notes', href: '/finance/credit-notes', icon: <CreditCard size={15} /> },
    ],
  },
  {
    label: 'Governance',
    items: [
      { label: 'Customer Tiers', href: '/admin/customer-tiers', icon: <Tag size={15} /> },
      { label: 'Categories', href: '/admin/categories', icon: <ListFilter size={15} /> },
      { label: 'Discount Rules', href: '/admin/discount-rules', icon: <BadgePercent size={15} /> },
      { label: 'Approval Rules', href: '/admin/approval-rules', icon: <FileCheck size={15} /> },
    ],
  },
  {
    label: 'Insights',
    items: [
      { label: 'Reports', href: '/management/reports', icon: <BarChart2 size={15} /> },
      { label: 'Deal Health', href: '/management/deal-health', icon: <Activity size={15} /> },
      { label: 'System Status', href: '/admin/system-status', icon: <Database size={15} /> },
    ],
  },
];

function isActivePath(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const isActive = isActivePath(pathname, item.href);

  return (
    <Link href={item.href} className={`admin-sidebar-link ${isActive ? 'active' : ''}`}>
      <span className="admin-sidebar-link-icon">{item.icon}</span>
      <span>{item.label}</span>
    </Link>
  );
}

export function Sidebar() {
  return (
    <aside className="admin-sidebar">
      <Link href="/" className="admin-sidebar-brand">
        <span className="df-brand-mark">D</span>
        <span>
          <span className="admin-sidebar-title">DealFlow360</span>
          <span className="admin-sidebar-subtitle">Admin workspace</span>
        </span>
      </Link>

      <div className="admin-sidebar-scroll">
        {adminNavGroups.map((group) => (
          <section key={group.label} className="admin-sidebar-group">
            <div className="admin-sidebar-group-label">{group.label}</div>
            <nav aria-label={group.label}>
              {group.items.map((item) => (
                <SidebarLink key={item.href} item={item} />
              ))}
            </nav>
          </section>
        ))}
      </div>
    </aside>
  );
}
