'use client';

import { LogOut, ChevronDown } from 'lucide-react';
import type { CurrentUser } from '@/lib/api';

function formatRole(role: string) {
  return role.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

export function UserMenu({ user, onLogout }: { user: CurrentUser; onLogout: () => void }) {
  return (
    <div className="user-menu">
      <div className="user-menu-identity">
        <span className="user-menu-avatar" aria-hidden="true">
          {getInitials(user.fullName)}
        </span>
        <span className="user-menu-copy">
          <span className="user-menu-name">{user.fullName}</span>
          <span className="user-menu-role">{formatRole(user.role)}</span>
        </span>
        <ChevronDown size={12} className="user-menu-chevron" />
      </div>
      <button onClick={onLogout} className="icon-button" title="Sign out" aria-label="Sign out">
        <LogOut size={15} />
      </button>
    </div>
  );
}
