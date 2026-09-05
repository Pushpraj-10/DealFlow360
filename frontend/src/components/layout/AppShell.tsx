'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { UserMenu } from './UserMenu';
import { findActiveLabel, getNavigation } from './navigation';
import { useAuth } from '@/lib/useAuth';
import { Bell, Menu, MessageSquare, PanelLeft, Quote, UserRound, X } from 'lucide-react';

// Rendered without the app shell and reachable while signed out.
const PUBLIC_ROUTES = ['/login', '/landing'];
const RAIL_STORAGE_KEY = 'dealflow360_sidebar_rail';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, loading } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [rail, setRail] = useState(false);
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  useEffect(() => {
    try {
      setRail(window.localStorage.getItem(RAIL_STORAGE_KEY) === '1');
    } catch {
      // Storage can be unavailable in private windows; the default is fine.
    }
  }, []);

  const toggleRail = () => {
    setRail((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(RAIL_STORAGE_KEY, next ? '1' : '0');
      } catch {
        // Ignore: collapsing still works for this session.
      }
      return next;
    });
  };

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (loading || isPublicRoute) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role === 'CUSTOMER' && !pathname.startsWith('/portal')) {
      router.replace('/portal');
      return;
    }
    if (user.role !== 'CUSTOMER' && pathname.startsWith('/portal')) {
      router.replace('/');
    }
  }, [loading, user, pathname, router, isPublicRoute]);

  // Login and landing pages render bare, with no internal shell.
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Portal pages keep their own customer-facing layout.
  if (pathname.startsWith('/portal')) {
    return (
      <div className="portal-shell">
        <header className="portal-header">
          <a href="/portal" className="portal-brand">
            <span className="df-brand-mark">D</span>
            <span>DealFlow360</span>
          </a>
          <nav className="portal-nav" aria-label="Customer portal navigation">
            <a className={pathname === '/portal' ? 'active' : ''} href="/portal">
              <Quote size={14} />
              My Quote
            </a>
            <a
              className={pathname.includes('/quotation') ? 'active' : ''}
              href={pathname.startsWith('/portal/quotation') ? `${pathname}#messages` : '/portal'}
            >
              <MessageSquare size={14} />
              Messages
            </a>
            <a href={pathname.startsWith('/portal/quotation') ? `${pathname}#profile` : '/portal'}>
              <UserRound size={14} />
              Profile
            </a>
          </nav>
          {user && <UserMenu user={user} onLogout={logout} />}
        </header>
        <main className="portal-main">{children}</main>
      </div>
    );
  }

  if (loading || !user) {
    return (
      <div className="app-boot">
        <div className="app-boot__mark">
          <span>D</span>
        </div>
        <div className="app-boot__bar">
          <div />
        </div>
      </div>
    );
  }

  const activeLabel = findActiveLabel(getNavigation(user.role), pathname);

  return (
    <div className={`app-shell${rail ? ' app-shell--rail' : ''}`}>
      <div className="app-shell__sidebar">
        <Sidebar role={user.role} rail={rail} />
      </div>

      {drawerOpen && (
        <div className="app-drawer" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="app-drawer__scrim" onClick={() => setDrawerOpen(false)} />
          <div className="app-drawer__panel">
            <button
              className="icon-button app-drawer__close"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close navigation"
            >
              <X size={16} />
            </button>
            <Sidebar role={user.role} onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="app-shell__main">
        <header className="app-topbar">
          <button
            className="icon-button app-topbar__drawer-trigger"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={17} />
          </button>
          <button
            className="icon-button app-topbar__rail-trigger"
            onClick={toggleRail}
            aria-pressed={rail}
            title={rail ? 'Expand navigation' : 'Collapse navigation'}
            aria-label={rail ? 'Expand navigation' : 'Collapse navigation'}
          >
            <PanelLeft size={16} />
          </button>
          {activeLabel && <span className="app-topbar__context">{activeLabel}</span>}
          <div className="app-topbar__actions">
            <button className="icon-button" title="Notifications" aria-label="Notifications">
              <Bell size={16} />
            </button>
            <UserMenu user={user} onLogout={logout} />
          </div>
        </header>
        <main className="app-main">{children}</main>
      </div>
    </div>
  );
}
