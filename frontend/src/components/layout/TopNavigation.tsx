'use client';

import type React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  BadgePercent,
  BarChart2,
  Bell,
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
  Tag,
  Truck,
  Users,
  Warehouse,
} from 'lucide-react';
import type { CurrentUser } from '@/lib/api';
import { UserMenu } from './UserMenu';

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
};

// Mirrors the backend's requireRoles() guards on each module's *.routes.js
// so a role never sees a nav link that 403s on click. Verified end-to-end
// per role via a full Playwright sweep.
const navByRole: Record<string, NavItem[]> = {
  SALES_REP: [
    { label: 'Overview', href: '/', icon: <LayoutDashboard size={15} /> },
    { label: 'Pipeline', href: '/sales/pipeline', icon: <Columns3 size={15} /> },
    { label: 'Quotations', href: '/sales/quotations', icon: <FileText size={15} /> },
    { label: 'Negotiations', href: '/sales/negotiations', icon: <MessageSquare size={15} /> },
    { label: 'Customers', href: '/admin/customers', icon: <Users size={15} /> },
    { label: 'Products', href: '/admin/products', icon: <Package size={15} /> },
    { label: 'Fulfillment', href: '/operations/fulfillment', icon: <Truck size={15} /> },
    { label: 'Backorders', href: '/operations/backorders', icon: <AlertTriangle size={15} /> },
    { label: 'Warehouses', href: '/admin/warehouses', icon: <Warehouse size={15} /> },
    { label: 'Inventory', href: '/admin/inventory', icon: <Boxes size={15} /> },
    { label: 'Subscriptions', href: '/finance/subscriptions', icon: <RefreshCw size={15} /> },
    { label: 'Invoices', href: '/finance/invoices', icon: <Receipt size={15} /> },
    { label: 'Payments', href: '/finance/payments', icon: <CreditCard size={15} /> },
    { label: 'Credit Notes', href: '/finance/credit-notes', icon: <CreditCard size={15} /> },
    { label: 'Deal Health', href: '/management/deal-health', icon: <Activity size={15} /> },
    { label: 'Reports', href: '/management/reports', icon: <BarChart2 size={15} /> },
    { label: 'Categories', href: '/admin/categories', icon: <ListFilter size={15} /> },
    { label: 'Pricing', href: '/admin/price-lists', icon: <BadgePercent size={15} /> },
    { label: 'Sub. Plans', href: '/admin/subscription-plans', icon: <RefreshCw size={15} /> },
    { label: 'System Status', href: '/admin/system-status', icon: <Database size={15} /> },
  ],
  SALES_MANAGER: [
    { label: 'Overview', href: '/', icon: <LayoutDashboard size={15} /> },
    { label: 'Quotations', href: '/sales/quotations', icon: <FileText size={15} /> },
    { label: 'Approvals', href: '/sales/approvals', icon: <CheckSquare size={15} /> },
    { label: 'Customers', href: '/admin/customers', icon: <Users size={15} /> },
    { label: 'Products', href: '/admin/products', icon: <Package size={15} /> },
    { label: 'Fulfillment', href: '/operations/fulfillment', icon: <Truck size={15} /> },
    { label: 'Backorders', href: '/operations/backorders', icon: <AlertTriangle size={15} /> },
    { label: 'Warehouses', href: '/admin/warehouses', icon: <Warehouse size={15} /> },
    { label: 'Inventory', href: '/admin/inventory', icon: <Boxes size={15} /> },
    { label: 'Subscriptions', href: '/finance/subscriptions', icon: <RefreshCw size={15} /> },
    { label: 'Invoices', href: '/finance/invoices', icon: <Receipt size={15} /> },
    { label: 'Payments', href: '/finance/payments', icon: <CreditCard size={15} /> },
    { label: 'Credit Notes', href: '/finance/credit-notes', icon: <CreditCard size={15} /> },
    { label: 'Deal Health', href: '/management/deal-health', icon: <Activity size={15} /> },
    { label: 'Reports', href: '/management/reports', icon: <BarChart2 size={15} /> },
    { label: 'Customer Tiers', href: '/admin/customer-tiers', icon: <Tag size={15} /> },
    { label: 'Categories', href: '/admin/categories', icon: <ListFilter size={15} /> },
    { label: 'Pricing', href: '/admin/price-lists', icon: <BadgePercent size={15} /> },
    { label: 'Discount Rules', href: '/admin/discount-rules', icon: <BadgePercent size={15} /> },
    { label: 'Approval Rules', href: '/admin/approval-rules', icon: <FileCheck size={15} /> },
    { label: 'Sub. Plans', href: '/admin/subscription-plans', icon: <RefreshCw size={15} /> },
    { label: 'System Status', href: '/admin/system-status', icon: <Database size={15} /> },
  ],
  FINANCE: [
    { label: 'Overview', href: '/', icon: <LayoutDashboard size={15} /> },
    { label: 'Quotations', href: '/sales/quotations', icon: <FileText size={15} /> },
    { label: 'Approvals', href: '/sales/approvals', icon: <CheckSquare size={15} /> },
    { label: 'Products', href: '/admin/products', icon: <Package size={15} /> },
    { label: 'Fulfillment', href: '/operations/fulfillment', icon: <Truck size={15} /> },
    { label: 'Backorders', href: '/operations/backorders', icon: <AlertTriangle size={15} /> },
    { label: 'Warehouses', href: '/admin/warehouses', icon: <Warehouse size={15} /> },
    { label: 'Inventory', href: '/admin/inventory', icon: <Boxes size={15} /> },
    { label: 'Subscriptions', href: '/finance/subscriptions', icon: <RefreshCw size={15} /> },
    { label: 'Invoices', href: '/finance/invoices', icon: <Receipt size={15} /> },
    { label: 'Payments', href: '/finance/payments', icon: <CreditCard size={15} /> },
    { label: 'Credit Notes', href: '/finance/credit-notes', icon: <CreditCard size={15} /> },
    { label: 'Deal Health', href: '/management/deal-health', icon: <Activity size={15} /> },
    { label: 'Reports', href: '/management/reports', icon: <BarChart2 size={15} /> },
    { label: 'Categories', href: '/admin/categories', icon: <ListFilter size={15} /> },
    { label: 'Pricing', href: '/admin/price-lists', icon: <BadgePercent size={15} /> },
    { label: 'Sub. Plans', href: '/admin/subscription-plans', icon: <RefreshCw size={15} /> },
    { label: 'System Status', href: '/admin/system-status', icon: <Database size={15} /> },
  ],
};

function isActivePath(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

export function getNavigationForRole(role: string) {
  return navByRole[role] ?? navByRole.SALES_REP;
}

export function TopNavigation({
  user,
  onLogout,
  mobileOpen,
  onMobileClose,
}: {
  user: CurrentUser;
  onLogout: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const pathname = usePathname();
  const items = getNavigationForRole(user.role);

  return (
    <>
      <header className="top-navigation">
        <div className="top-navigation-inner">
          <Link href="/" className="top-navigation-brand">
            <span className="df-brand-mark">D</span>
            <span>DealFlow360</span>
          </Link>

          <nav className="top-navigation-links" aria-label="Primary navigation">
            {items.map((item) => {
              const isActive = isActivePath(pathname, item.href);
              return (
                <Link key={item.href} href={item.href} className={`top-navigation-link ${isActive ? 'active' : ''}`}>
                  <span>{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="top-navigation-actions">
            <button className="icon-button" title="Notifications" aria-label="Notifications">
              <Bell size={16} />
            </button>
            <UserMenu user={user} onLogout={onLogout} />
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div className="mobile-nav-panel">
          <div className="mobile-nav-card">
            <nav aria-label="Mobile navigation">
              {items.map((item) => {
                const isActive = isActivePath(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`mobile-nav-link ${isActive ? 'active' : ''}`}
                    onClick={onMobileClose}
                  >
                    <span>{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
