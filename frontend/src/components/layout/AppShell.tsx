'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { useAuth } from '@/lib/useAuth';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user && pathname !== '/login') {
      router.replace('/login');
    }
  }, [loading, user, pathname, router]);

  if (pathname === '/login') {
    return <>{children}</>;
  }

  if (loading || !user) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-y-auto">
        <header className="flex justify-end items-center gap-4 px-6 py-3 bg-white border-b border-gray-200">
          {!loading && user && (
            <>
              <span className="text-sm text-gray-600">
                {user.fullName} <span className="text-gray-400">({user.role})</span>
              </span>
              <button onClick={logout} className="text-sm text-red-600 hover:underline">
                Log out
              </button>
            </>
          )}
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
