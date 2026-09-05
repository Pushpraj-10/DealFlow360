'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { useAuth } from '@/lib/useAuth';
import { LogOut, User, Menu, X } from 'lucide-react';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user && pathname !== '/login') {
      router.replace('/login');
    }
  }, [loading, user, pathname, router]);

  // Login page — bare layout
  if (pathname === '/login') {
    return <>{children}</>;
  }

  // Portal pages — clean customer-facing layout without sidebar
  if (pathname.startsWith('/portal')) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8F7F5' }}>
        {/* Portal header */}
        <header
          style={{
            background: '#fff',
            borderBottom: '1px solid var(--border)',
            padding: '0 32px',
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 24,
                height: 24,
                background: 'var(--accent)',
                borderRadius: 5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>D</span>
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>DealFlow360</span>
            <span
              style={{
                fontSize: 11,
                color: 'var(--text-tertiary)',
                background: 'var(--surface-02)',
                padding: '2px 7px',
                borderRadius: 99,
                marginLeft: 4,
              }}
            >
              Customer Portal
            </span>
          </div>
          {user && (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{user.fullName}</span>
          )}
        </header>
        <main style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px' }}>{children}</main>
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

  // Main app layout
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Desktop sidebar */}
      <div className="hidden-mobile" style={{ display: 'flex' }}>
        <Sidebar />
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 40,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(2px)',
          }}
          onClick={() => setSidebarOpen(false)}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: 224, height: '100%' }}>
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main content area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {/* Top bar */}
        <header className="df-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Mobile hamburger */}
            <button
              className="btn btn-ghost btn-sm"
              style={{ display: 'none' }}
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={16} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 10px',
                borderRadius: 'var(--radius)',
                background: 'var(--surface-02)',
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <User size={11} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                  {user.fullName}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.2 }}>
                  {user.role}
                </div>
              </div>
            </div>

            <button
              onClick={logout}
              className="btn btn-ghost btn-sm"
              title="Sign out"
              style={{ color: 'var(--text-secondary)' }}
            >
              <LogOut size={14} />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: 'auto' }}>{children}</main>
      </div>
    </div>
  );
}
