'use client';

import type React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  Bell,
  CheckSquare,
  Columns3,
  CreditCard,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Receipt,
  RefreshCw,
  Truck,
  Users,
} from 'lucide-react';
import type { CurrentUser } from '@/lib/api';
import { UserMenu } from './UserMenu';
import { ThemeToggle } from '../ThemeToggle';

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
};

const navByRole: Record<string, NavItem[]> = {
  SALES_REP: [
    { label: 'Overview', href: '/', icon: <LayoutDashboard size={15} /> },
    { label: 'Pipeline', href: '/sales/pipeline', icon: <Columns3 size={15} /> },
    { label: 'Quotations', href: '/sales/quotations', icon: <FileText size={15} /> },
    { label: 'Customers', href: '/admin/customers', icon: <Users size={15} /> },
    { label: 'Negotiations', href: '/sales/negotiations', icon: <MessageSquare size={15} /> },
  ],
  SALES_MANAGER: [
    { label: 'Overview', href: '/', icon: <LayoutDashboard size={15} /> },
    { label: 'Approvals', href: '/sales/approvals', icon: <CheckSquare size={15} /> },
    { label: 'Team Deals', href: '/sales/team-deals', icon: <Columns3 size={15} /> },
    { label: 'Deal Health', href: '/management/deal-health', icon: <Activity size={15} /> },
  ],
  FINANCE: [
    { label: 'Overview', href: '/', icon: <LayoutDashboard size={15} /> },
    { label: 'Approvals', href: '/sales/approvals', icon: <CheckSquare size={15} /> },
    { label: 'Fulfillment', href: '/operations/fulfillment', icon: <Truck size={15} /> },
    { label: 'Subscriptions', href: '/finance/subscriptions', icon: <RefreshCw size={15} /> },
    { label: 'Invoices', href: '/finance/invoices', icon: <Receipt size={15} /> },
    { label: 'Payments', href: '/finance/payments', icon: <CreditCard size={15} /> },
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
            <ThemeToggle />
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
