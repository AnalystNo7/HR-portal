'use client';

import React from 'react';
import { initials, avColorFor, Icon } from '@/components/primitives';

const COWORKERS = [
  { n: 'Елена Иванова', s: 'online' },
  { n: 'Олег Петров', s: 'online' },
  { n: 'Мария Соколова', s: 'away' },
  { n: 'Дмитрий Кузнецов', s: 'online' },
  { n: 'Анна Волкова', s: 'offline' },
  { n: 'Сергей Новиков', s: 'online' },
  { n: 'Ирина Белова', s: 'away' },
  { n: 'Павел Ефимов', s: 'online' },
];

export function RightRail() {
  return (
    <aside className="rightrail">
      <div className="rr-label">Команда</div>
      {COWORKERS.map((c, i) => (
        <div
          key={i}
          className={`rr-avatar av-${avColorFor(c.n)}`}
          data-status={c.s}
          title={c.n}
        >
          {initials(c.n)}
        </div>
      ))}
      <div className="rr-divider" />
      <button
        className="rr-avatar"
        style={{
          background: 'var(--gpc-gray-150)',
          color: 'var(--gpc-gray-600)',
          border: '2px dashed var(--gpc-gray-300)',
          boxShadow: 'none',
        }}
        title="Добавить"
      >
        <Icon name="plus" size={14} />
      </button>
    </aside>
  );
}
