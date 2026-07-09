'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/primitives';
import { useAuth, UserRole, isMockAuth } from '@/contexts/AuthContext';
import { NAV_LABELS } from './Sidebar';

const ROLE_LABELS: Record<UserRole, string> = {
  employee: 'Сотрудник',
  manager: 'Руководитель',
  hr: 'HR',
  admin: 'Администратор',
};

export function Header() {
  const pathname = usePathname();
  const { role, setRole, setFeedbackOpen, logout, user } = useAuth();
  const avInitials = user ? `${user.lastName[0] ?? ''}${user.firstName[0] ?? ''}`.toUpperCase() : '';
  const avTitle = user ? `${user.lastName} ${user.firstName}` : '';
  const mock = isMockAuth();

  const sectionTitle = NAV_LABELS[pathname] || 'Портал';
  const showCrumb = pathname !== '/';

  return (
    <header className="header">
      <div className="hdr-section-title">
        {showCrumb && (
          <>
            <span className="muted">Портал</span>
            <span className="crumb-sep">/</span>
          </>
        )}
        <span className="crumb-current">{sectionTitle}</span>
      </div>

      <div className="hdr-spacer" />

      {role !== 'admin' && (
        <button className="hdr-cta" onClick={() => setFeedbackOpen(true)}>
          <Icon name="bulb" size={16} />
          Обратная связь
        </button>
      )}

      {mock ? (
        <div className="hdr-role" title="Демо: переключение роли">
          {(Object.keys(ROLE_LABELS) as UserRole[]).map(k => (
            <button key={k} data-active={role === k} onClick={() => setRole(k)}>
              {ROLE_LABELS[k]}
            </button>
          ))}
        </div>
      ) : (
        <button
          className="btn btn-ghost btn-sm"
          onClick={logout}
          title="Выход"
          style={{ padding: '0 8px' }}
        >
          <Icon name="logout" size={16} />
        </button>
      )}

      <button className="hdr-avatar" title={avTitle}>{avInitials}</button>
    </header>
  );
}
