'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getNavigation, isActivePath, type NavItem } from './navigation';

function SidebarLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = isActivePath(pathname, item.href);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={item.label}
      aria-current={active ? 'page' : undefined}
      className={`app-sidebar__link${active ? ' app-sidebar__link--active' : ''}`}
    >
      <span className="app-sidebar__icon">{item.icon}</span>
      <span className="app-sidebar__label">{item.label}</span>
    </Link>
  );
}

/**
 * One sidebar for every internal role. Rail mode keeps the same markup and
 * only collapses the labels, so table-heavy pages can reclaim width without a
 * second navigation component.
 */
export function Sidebar({
  role,
  rail = false,
  onNavigate,
}: {
  role: string;
  rail?: boolean;
  onNavigate?: () => void;
}) {
  const groups = getNavigation(role);

  return (
    <aside className={`app-sidebar${rail ? ' app-sidebar--rail' : ''}`} aria-label="Workspace navigation">
      <Link href="/" className="app-sidebar__brand" onClick={onNavigate}>
        <span className="df-brand-mark">D</span>
        <span className="app-sidebar__brand-copy">
          <span className="app-sidebar__brand-name">DealFlow360</span>
          <span className="app-sidebar__brand-sub">Sales operations</span>
        </span>
      </Link>

      <div className="app-sidebar__scroll">
        {groups.map((group) => (
          <section key={group.label} className="app-sidebar__group">
            <div className="app-sidebar__group-label">{group.label}</div>
            <nav aria-label={group.label}>
              {group.items.map((item) => (
                <SidebarLink key={item.href} item={item} onNavigate={onNavigate} />
              ))}
            </nav>
          </section>
        ))}
      </div>
    </aside>
  );
}
