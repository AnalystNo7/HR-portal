'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Icon } from '@/components/primitives';
import { LogoCube } from '@/components/illustrations/Illustrations';
import { useAuth, UserRole } from '@/contexts/AuthContext';

interface NavItem {
  id: string;
  label: string;
  icon: string;
  badge?: number;
}

interface NavSection {
  group: string;
  items: NavItem[];
}

const NAV: Record<UserRole, NavSection[]> = {
  employee: [
    { group: 'Основное', items: [
      { id: '/', label: 'Главная', icon: 'home' },
      { id: '/profile', label: 'Личный кабинет', icon: 'user' },
      { id: '/career', label: 'Карьера', icon: 'compass' },
      { id: '/culture', label: 'Корп. культура', icon: 'heart' },
    ]},
    { group: 'Обучение и развитие', items: [
      { id: '/learn', label: 'Обучение', icon: 'graduation' },
      { id: '/appeals', label: 'Мои обращения', icon: 'chat', badge: 2 },
    ]},
  ],
  manager: [
    { group: 'Основное', items: [
      { id: '/', label: 'Главная', icon: 'home' },
      { id: '/profile', label: 'Личный кабинет', icon: 'user' },
      { id: '/career', label: 'Карьера', icon: 'compass' },
      { id: '/culture', label: 'Корп. культура', icon: 'heart' },
    ]},
    { group: 'Управление', items: [
      { id: '/manager', label: 'Кабинет руководителя', icon: 'briefcase' },
      { id: '/appeals', label: 'Обращения', icon: 'chat' },
    ]},
  ],
  hr: [
    { group: 'Основное', items: [
      { id: '/', label: 'Главная', icon: 'home' },
      { id: '/profile', label: 'Личный кабинет', icon: 'user' },
    ]},
    { group: 'HR', items: [
      { id: '/hr', label: 'Все сотрудники', icon: 'users' },
      { id: '/hr-vacancies', label: 'Отклики', icon: 'clipboard', badge: 7 },
      { id: '/hr-surveys', label: 'Опросы', icon: 'chart' },
      { id: '/appeals', label: 'Обращения', icon: 'chat', badge: 5 },
    ]},
    { group: 'Организация', items: [
      { id: '/culture', label: 'Корп. культура', icon: 'heart' },
      { id: '/career', label: 'Карьера', icon: 'compass' },
    ]},
  ],
  admin: [
    { group: 'Администрирование', items: [
      { id: '/admin/employees', label: 'Сотрудники', icon: 'users' },
      { id: '/admin/departments', label: 'Подразделения', icon: 'building' },
      { id: '/admin/positions', label: 'Должности', icon: 'briefcase' },
      { id: '/admin/import', label: 'Импорт', icon: 'upload' },
    ]},
  ],
};

const NAV_LABELS: Record<string, string> = {
  '/': 'Главная',
  '/profile': 'Личный кабинет',
  '/career': 'Карьера',
  '/culture': 'Корп. культура',
  '/learn': 'Обучение',
  '/appeals': 'Мои обращения',
  '/manager': 'Кабинет руководителя',
  '/hr': 'Все сотрудники',
  '/hr-vacancies': 'Отклики на вакансии',
  '/hr-surveys': 'Опросы и рассылки',
  '/admin/employees': 'Сотрудники',
  '/admin/departments': 'Подразделения',
  '/admin/positions': 'Должности',
  '/admin/import': 'Импорт сотрудников',
};

export { NAV_LABELS };

function mergeNavForRoles(roles: UserRole[]): NavSection[] {
  const seen = new Set<string>();
  const sections: NavSection[] = [];
  const order: UserRole[] = ['employee', 'manager', 'hr', 'admin'];
  const sorted = order.filter(r => roles.includes(r));

  for (const role of sorted) {
    for (const section of NAV[role] || []) {
      const newItems = section.items.filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
      if (newItems.length === 0) continue;

      const existing = sections.find(s => s.group === section.group);
      if (existing) {
        existing.items.push(...newItems);
      } else {
        sections.push({ group: section.group, items: [...newItems] });
      }
    }
  }

  return sections;
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { roles, sidebarCollapsed, setSidebarCollapsed } = useAuth();

  const nav = mergeNavForRoles(roles);

  const isCurrent = (id: string) => {
    if (id === '/') return pathname === '/';
    return pathname.startsWith(id);
  };

  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <div className="logo-cube"><LogoCube size={30} /></div>
        <div className="brand-text">
          <b>Газпром ЦПС</b>
          <span>Портал</span>
        </div>
      </div>

      <nav className="sb-nav">
        {nav.map((section, si) => (
          <div key={si}>
            {!sidebarCollapsed && <div className="sb-section-label">{section.group}</div>}
            {section.items.map(item => (
              <button
                key={item.id}
                className="sb-item"
                aria-current={isCurrent(item.id) ? 'page' : undefined}
                onClick={() => router.push(item.id)}
                title={sidebarCollapsed ? item.label : ''}
              >
                <Icon name={item.icon} />
                <span className="sb-label">{item.label}</span>
                {item.badge && <span className="sb-badge">{item.badge}</span>}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="sb-footer">
        <button className="sb-collapse" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
          <Icon name={sidebarCollapsed ? 'chevron_right' : 'chevron_left'} size={16} />
          {!sidebarCollapsed && <span>Свернуть меню</span>}
        </button>
      </div>
    </aside>
  );
}
