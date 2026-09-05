'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { TopNavigation } from './TopNavigation';
import { UserMenu } from './UserMenu';
import { useAuth } from '@/lib/useAuth';
import { Menu, MessageSquare, Quote, UserRound, X } from 'lucide-react';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      if (pathname !== '/login') router.replace('/login');
      return;
    }
    if (user.role === 'CUSTOMER' && !pathname.startsWith('/portal')) {
      router.replace('/portal');
      return;
    }
    if (user.role !== 'CUSTOMER' && pathname.startsWith('/portal')) {
      router.replace('/');
    }
  }, [loading, user, pathname, router]);

  // Login page — bare layout
  if (pathname === '/login') {
    return <>{children}</>;
  }

  // Portal pages — clean customer-facing layout without internal shell
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
            <a className={pathname.includes('/quotation') ? 'active' : ''} href={pathname.startsWith('/portal/quotation') ? pathname : '/portal'}>
              <MessageSquare size={14} />
              Messages
            </a>
            <a href="/portal">
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

  // Loading / unauthenticated guard
  if (loading || !user) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              background: 'var(--accent)',
              borderRadius: 7,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>D</span>
          </div>
          <div
            style={{
              width: 120,
              height: 3,
              background: 'var(--surface-03)',
              borderRadius: 99,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                background: 'var(--accent)',
                borderRadius: 99,
                animation: 'shimmer 1.4s ease infinite',
                backgroundSize: '200% 100%',
                backgroundImage:
                  'linear-gradient(90deg, var(--accent) 25%, #60a5fa 50%, var(--accent) 75%)',
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (user.role === 'ADMIN') {
    return (
      <div className="admin-app-shell">
        <div className="admin-sidebar-desktop">
          <Sidebar />
        </div>

        {sidebarOpen && (
          <div className="mobile-shell-overlay" onClick={() => setSidebarOpen(false)}>
            <div onClick={(e) => e.stopPropagation()}>
              <Sidebar />
            </div>
          </div>
        )}

        <div className="admin-main-shell">
          <header className="df-topbar">
            <button className="icon-button mobile-menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation">
              <Menu size={17} />
            </button>
            <div className="topbar-spacer" />
            <UserMenu user={user} onLogout={logout} />
          </header>
          <main className="app-main-content">{children}</main>
        </div>
      </div>
    );
  }

  // Main app layout for Sales, Manager, Finance, and Operations roles
  return (
    <div className="app-shell">
      <button className="mobile-menu-fab" onClick={() => setSidebarOpen((open) => !open)} aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'}>
        {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
      </button>
      <TopNavigation user={user} onLogout={logout} mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />
      <main className="app-main-content">{children}</main>
    </div>
  );
}
