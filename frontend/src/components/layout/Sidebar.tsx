'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  CheckSquare,
  Users,
  Package,
  Boxes,
  Warehouse,
  Truck,
  AlertTriangle,
  CreditCard,
  Receipt,
  DollarSign,
  FileCheck,
  BarChart2,
  Activity,
  Settings,
  Tag,
  BadgePercent,
  ListFilter,
  Database,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/lib/useAuth';

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  /** Roles allowed to see this item. Omit to allow every internal role. */
  roles?: string[];
};

type NavGroup = {
  label: string;
  items: NavItem[];
  collapsible?: boolean;
};

// Mirrors the backend's requireRoles() guards on each route (see each
// module's *.routes.js) so a role never sees a nav link that 403s on click.
const navGroups: NavGroup[] = [
  {
    label: 'Workspace',
    items: [
      { label: 'Overview', href: '/', icon: <LayoutDashboard size={14} /> },
      { label: 'Quotations', href: '/sales/quotations', icon: <FileText size={14} /> },
      { label: 'Approvals', href: '/sales/approvals', icon: <CheckSquare size={14} />, roles: ['SALES_MANAGER', 'FINANCE', 'ADMIN'] },
    ],
  },
  {
    label: 'Sales',
    items: [
      { label: 'Customers', href: '/admin/customers', icon: <Users size={14} />, roles: ['SALES_REP', 'SALES_MANAGER', 'ADMIN'] },
      { label: 'Products', href: '/admin/products', icon: <Package size={14} /> },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Fulfillment', href: '/operations/fulfillment', icon: <Truck size={14} /> },
      { label: 'Backorders', href: '/operations/backorders', icon: <AlertTriangle size={14} /> },
      { label: 'Warehouses', href: '/admin/warehouses', icon: <Warehouse size={14} /> },
      { label: 'Inventory', href: '/admin/inventory', icon: <Boxes size={14} /> },
    ],
  },
  {
    label: 'Finance',
    items: [
      { label: 'Subscriptions', href: '/finance/subscriptions', icon: <RefreshCw size={14} /> },
      { label: 'Invoices', href: '/finance/invoices', icon: <Receipt size={14} /> },
      { label: 'Payments', href: '/finance/payments', icon: <DollarSign size={14} /> },
      { label: 'Credit Notes', href: '/finance/credit-notes', icon: <CreditCard size={14} /> },
    ],
  },
  {
    label: 'Insights',
    items: [
      { label: 'Deal Health', href: '/management/deal-health', icon: <Activity size={14} /> },
      { label: 'Reports', href: '/management/reports', icon: <BarChart2 size={14} /> },
    ],
  },
  {
    label: 'System',
    collapsible: true,
    items: [
      { label: 'Customer Tiers', href: '/admin/customer-tiers', icon: <Tag size={14} />, roles: ['SALES_MANAGER', 'ADMIN'] },
      { label: 'Categories', href: '/admin/categories', icon: <ListFilter size={14} /> },
      { label: 'Price Lists', href: '/admin/price-lists', icon: <BadgePercent size={14} /> },
      { label: 'Discount Rules', href: '/admin/discount-rules', icon: <BadgePercent size={14} />, roles: ['SALES_MANAGER', 'ADMIN'] },
      { label: 'Approval Rules', href: '/admin/approval-rules', icon: <FileCheck size={14} />, roles: ['SALES_MANAGER', 'ADMIN'] },
      { label: 'Sub. Plans', href: '/admin/subscription-plans', icon: <RefreshCw size={14} /> },
      { label: 'System Status', href: '/admin/system-status', icon: <Database size={14} /> },
    ],
  },
];

function SidebarLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const isActive =
    item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(item.href + '/');

  return (
    <Link
      href={item.href}
      className={`sidebar-link ${isActive ? 'active' : ''}`}
    >
      <span style={{ opacity: isActive ? 1 : 0.6, flexShrink: 0 }}>{item.icon}</span>
      <span>{item.label}</span>
    </Link>
  );
}

function SidebarGroup({ group, role }: { group: NavGroup; role: string | undefined }) {
  const pathname = usePathname();
  const items = group.items.filter((item) => !item.roles || (role && item.roles.includes(role)));
  const hasActive = items.some((item) =>
    item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
  );
  const [open, setOpen] = useState(!group.collapsible || hasActive);

  if (items.length === 0) return null;

  return (
    <div>
      {group.collapsible ? (
        <button
          onClick={() => setOpen(!open)}
          className="sidebar-group-label w-full flex items-center justify-between pr-4 cursor-pointer hover:text-zinc-400 transition-colors"
          style={{ background: 'none', border: 'none' }}
        >
          <span>{group.label}</span>
          <ChevronDown
            size={10}
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }}
          />
        </button>
      ) : (
        <div className="sidebar-group-label">{group.label}</div>
      )}
      {open && (
        <nav>
          {items.map((item) => (
            <SidebarLink key={item.href} item={item} />
          ))}
        </nav>
      )}
    </div>
  );
}

export function Sidebar() {
  const { user } = useAuth();

  return (
    <aside
      style={{
        width: 224,
        minWidth: 224,
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--sidebar-border)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
        flexShrink: 0,
      }}
    >
      {/* Brand */}
      <Link
        href="/"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '16px 16px 12px',
          textDecoration: 'none',
          borderBottom: '1px solid var(--sidebar-border)',
          marginBottom: 4,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 26,
            height: 26,
            background: 'var(--accent)',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <span style={{ color: '#fff', fontSize: 12, fontWeight: 700, letterSpacing: '-0.02em' }}>D</span>
        </div>
        <div>
          <div style={{ color: '#FAFAFA', fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.2 }}>
            DealFlow360
          </div>
          <div style={{ color: 'var(--sidebar-muted)', fontSize: 10, lineHeight: 1.2 }}>Sales Operations</div>
        </div>
      </Link>

      {/* Navigation */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {navGroups.map((group) => (
          <SidebarGroup key={group.label} group={group} role={user?.role} />
        ))}
      </div>
    </aside>
  );
}
