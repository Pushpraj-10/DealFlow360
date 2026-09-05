'use client';

import { LogOut, User } from 'lucide-react';
import type { CurrentUser } from '@/lib/api';

function formatRole(role: string) {
  return role.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function UserMenu({ user, onLogout }: { user: CurrentUser; onLogout: () => void }) {
  return (
    <div className="user-menu">
      <div className="user-menu-identity">
        <span className="user-menu-avatar">
          <User size={13} />
        </span>
        <span className="user-menu-copy">
          <span className="user-menu-name">{user.fullName}</span>
          <span className="user-menu-role">{formatRole(user.role)}</span>
        </span>
      </div>
      <button onClick={onLogout} className="icon-button" title="Sign out" aria-label="Sign out">
        <LogOut size={16} />
      </button>
    </div>
  );
}
