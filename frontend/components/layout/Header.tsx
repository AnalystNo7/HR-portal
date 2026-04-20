'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/primitives';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { NAV_LABELS } from './Sidebar';

const ROLE_LABELS: Record<UserRole, string> = {
  employee: 'Сотрудник',
  manager: 'Руководитель',
  hr: 'HR',
};

export function Header() {
  const pathname = usePathname();
  const { role, setRole, setFeedbackOpen } = useAuth();

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

      <div className="hdr-search">
        <Icon name="search" size={16} />
        <input placeholder="Поиск по порталу, коллегам, документам..." />
      </div>

      <div className="hdr-spacer" />

      <div className="hdr-engagement" title="Уровень вовлечённости">
        <span>Вовлечённость</span>
        <b>60%</b>
        <div className="bar"><i style={{ width: '60%' }} /></div>
      </div>

      <button className="hdr-cta" onClick={() => setFeedbackOpen(true)}>
        <Icon name="bulb" size={16} />
        Обратная связь
      </button>

      <div className="hdr-role" title="Демо: переключение роли">
        {(Object.keys(ROLE_LABELS) as UserRole[]).map(k => (
          <button key={k} data-active={role === k} onClick={() => setRole(k)}>
            {ROLE_LABELS[k]}
          </button>
        ))}
      </div>

      <button className="hdr-avatar" title="А. Морозов">АМ</button>
    </header>
  );
}
