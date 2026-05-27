'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Icon, Avatar, Modal, initials, avColorFor } from '@/components/primitives';
import { EmptyCube } from '@/components/illustrations/Illustrations';
import { getEmployees, Employee, PaginatedResult } from '@/lib/api';

type Tab = 'team' | 'review' | 'ipr' | 'learn' | 'status';

const TABS: { id: Tab; label: string }[] = [
  { id: 'team', label: 'Сотрудники' },
  { id: 'review', label: 'Оценка' },
  { id: 'ipr', label: 'ИПР' },
  { id: 'learn', label: 'Обучение' },
  { id: 'status', label: 'Статус' },
];

export default function ManagerPage() {
  const [tab, setTab] = useState<Tab>('team');
  const [posOpen, setPosOpen] = useState<Employee | null>(null);
  const [team, setTeam] = useState<Employee[]>([]);
  const [managerId, setManagerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Берём первого сотрудника с подчинёнными как "руководителя" (демо)
      // В реальности managerId будет из auth
      const all = await getEmployees({ limit: 100 });
      const managers = new Set<string>();
      all.data.forEach((e) => e.managerId && managers.add(e.managerId));
      const firstManagerId = Array.from(managers)[0];
      setManagerId(firstManagerId ?? null);

      if (firstManagerId) {
        const subs = await getEmployees({ managerId: firstManagerId, limit: 100 });
        setTeam(subs.data);
      } else {
        setTeam([]);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="tabs">
        {TABS.map(t => (
          <button key={t.id} aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {tab === 'team' && <TeamTab team={team} loading={loading} error={error} onOpenPos={setPosOpen} onRetry={load} />}
      {tab === 'status' && <StatusCalendar team={team} />}
      {(tab === 'review' || tab === 'ipr' || tab === 'learn') && (
        <div className="card" style={{ padding: 40 }}>
          <div className="empty">
            <div className="ill"><EmptyCube w={120} /></div>
            <h3 style={{ fontFamily: 'var(--font-head)', fontSize: 20, color: 'var(--gpc-blue-800)' }}>
              {tab === 'review' ? 'Модуль «Оценка»' : tab === 'ipr' ? 'Индивидуальные планы развития' : 'План обучения команды'}
            </h3>
            <p style={{ maxWidth: 440, margin: '8px auto' }}>
              Модуль в разработке, доступен с III квартала 2025. Будут карточки по каждому подчинённому, статусы прохождения и экспорт в Excel.
            </p>
          </div>
        </div>
      )}

      <PositionModal open={!!posOpen} onClose={() => setPosOpen(null)} person={posOpen} />
    </div>
  );
}

function TeamTab({
  team,
  loading,
  error,
  onOpenPos,
  onRetry,
}: {
  team: Employee[];
  loading: boolean;
  error: string | null;
  onOpenPos: (p: Employee) => void;
  onRetry: () => void;
}) {
  if (error) {
    return (
      <div className="card" style={{ padding: 40, textAlign: 'center' }}>
        <div className="empty">
          <div className="ill"><EmptyCube w={100} /></div>
          <h3>Не удалось загрузить команду</h3>
          <p className="small muted">{error}</p>
          <button className="btn btn-primary" onClick={onRetry} style={{ marginTop: 12 }}>Повторить</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mgr-toolbar">
        <button className="btn btn-primary btn-sm"><Icon name="file" size={14} /> Отчёт о СМС / ОВЗ</button>
        <button className="btn btn-secondary btn-sm"><Icon name="download" size={14} /> Экспорт в Excel</button>
        <div className="flex-1" />
        <div className="hdr-search" style={{ margin: 0, flex: '0 0 260px' }}>
          <Icon name="search" size={16} />
          <input placeholder="Найти сотрудника..." />
        </div>
        <button className="btn btn-secondary btn-sm"><Icon name="filter" size={14} /> Фильтры</button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 24 }}></th>
              <th>Сотрудник</th>
              <th>Подразделение</th>
              <th>Должность</th>
              <th>E-mail</th>
              <th>Табельный</th>
              <th style={{ width: 48 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40 }}>Загрузка...</td></tr>
            )}
            {!loading && team.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--gpc-gray-500)' }}>Нет подчинённых</td></tr>
            )}
            {!loading && team.map(p => {
              const fullName = `${p.lastName} ${p.firstName} ${p.middleName ?? ''}`.trim();
              return (
                <tr key={p.id}>
                  <td className="col-drag"><Icon name="drag" size={14} /></td>
                  <td>
                    <div className="avatar-cell">
                      <div className={`av av-${avColorFor(fullName)}`}>{initials(fullName)}</div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{fullName}</div>
                        <div className="small muted">{p.position?.name ?? ''}</div>
                      </div>
                    </div>
                  </td>
                  <td className="small">{p.department?.name ?? ''}</td>
                  <td>
                    <a href="#" className="job-link" onClick={e => { e.preventDefault(); onOpenPos(p); }}>{p.position?.name ?? ''}</a>
                  </td>
                  <td className="small">{p.email}</td>
                  <td className="small"><b>{p.personnelNumber}</b></td>
                  <td>
                    <button className="btn btn-ghost btn-sm"><Icon name="dots" size={16} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function StatusCalendar({ team }: { team: Employee[] }) {
  const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
  // Mock bars — пока без API (в ФТТ отсутствия идут из 1С ЗУП)
  const bars = [
    { row: 0, type: 'vac' as const, from: 7, to: 8, label: 'Отпуск' },
    { row: 1, type: 'vac' as const, from: 6, to: 7, label: 'Отпуск' },
    { row: 2, type: 'trip' as const, from: 8, to: 8.5, label: 'Командировка' },
    { row: 3, type: 'sick' as const, from: 7.5, to: 8, label: 'Больничный' },
    { row: 4, type: 'vac' as const, from: 10, to: 11, label: 'Отпуск' },
  ];

  if (team.length === 0) {
    return (
      <div className="card" style={{ padding: 40 }}>
        <div className="empty">
          <div className="ill"><EmptyCube w={100} /></div>
          <h3>Нет подчинённых для отображения</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="gantt">
      <div className="row-g">
        <div className="g-name">
          <b style={{ fontSize: 11, color: 'var(--gpc-gray-500)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Сотрудник</b>
        </div>
        <div className="g-scale">
          {months.map(m => <div key={m}>{m}</div>)}
        </div>
      </div>
      {team.map((p, i) => {
        const fullName = `${p.lastName} ${p.firstName} ${p.middleName ?? ''}`.trim();
        return (
          <div key={p.id} className="row-g">
            <div className="g-name">
              <div className={`av av-${avColorFor(fullName)}`} style={{ width: 24, height: 24, fontSize: 10 }}>{initials(fullName)}</div>
              <div><b>{p.lastName} {p.firstName}</b></div>
            </div>
            <div className="g-scale">
              {months.map(m => <div key={m} />)}
              {bars.filter(b => b.row === i).map((b, bi) => (
                <div
                  key={bi}
                  className={`g-bar ${b.type}`}
                  style={{ left: `${(b.from / 12) * 100}%`, width: `${((b.to - b.from) / 12) * 100}%` }}
                >
                  {b.label}
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <div style={{ padding: '12px 16px', display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, borderTop: '1px solid var(--line)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <i style={{ width: 12, height: 12, borderRadius: 6, background: 'var(--gpc-orange)', display: 'inline-block' }} /> Отпуск
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <i style={{ width: 12, height: 12, borderRadius: 6, background: 'var(--err)', display: 'inline-block' }} /> Больничный
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <i style={{ width: 12, height: 12, borderRadius: 6, background: 'var(--gpc-blue)', display: 'inline-block' }} /> Командировка
        </span>
      </div>
    </div>
  );
}

function PositionModal({ open, onClose, person }: { open: boolean; onClose: () => void; person: Employee | null }) {
  if (!person) return null;
  const fullName = `${person.lastName} ${person.firstName} ${person.middleName ?? ''}`.trim();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Описание должности"
      size="lg"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Закрыть</button>
          <button className="btn btn-primary"><Icon name="download" size={14} /> Скачать PDF</button>
        </>
      }
    >
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', paddingBottom: 16, borderBottom: '1px solid var(--line)' }}>
        <Avatar name={fullName} size="lg" />
        <div>
          <h3 style={{ fontFamily: 'var(--font-head)', fontSize: 18 }}>{person.position?.name ?? ''}</h3>
          <div className="muted small">{person.department?.name ?? ''}</div>
          <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
            <span className="pill pill-blue">Табельный: {person.personnelNumber}</span>
            <span className="pill pill-gray">{person.email}</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <h4 style={{ marginBottom: 8 }}>Основные обязанности</h4>
        <ul style={{ paddingLeft: 18, fontSize: 13, color: 'var(--gpc-gray-700)', lineHeight: 1.6 }}>
          <li>Проектирование и реализация компонентов корпоративных систем</li>
          <li>Участие в архитектурных решениях и code review коллег</li>
          <li>Взаимодействие с аналитиками и продакт-менеджерами</li>
          <li>Сопровождение и отладка продуктивных сред</li>
        </ul>
      </div>

      <div style={{ marginTop: 16 }}>
        <h4 style={{ marginBottom: 8 }}>Ключевые компетенции</h4>
        <div>
          {['Java/Kotlin', 'Spring', 'Kubernetes', 'CI/CD', 'Системный анализ', 'Менторство'].map((s, i) => (
            <span key={i} className="skill-chip" data-level={i < 4 ? '3' : '1'}>{s}</span>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <h4 style={{ marginBottom: 8 }}>Критерии роста на следующий уровень</h4>
        <div className="card" style={{
          background: 'var(--gpc-sky)',
          borderColor: 'var(--gpc-sky-deep)',
          padding: 14,
          fontSize: 13,
          color: 'var(--gpc-blue-800)',
          display: 'flex',
          gap: 10,
          alignItems: 'flex-start',
        }}>
          <Icon name="info" size={16} />
          <span>
            Для перехода на следующий уровень необходимо: опыт владения архитектурными решениями, подтверждённые ментор-сессии, публикации во внутренней базе знаний.
          </span>
        </div>
      </div>
    </Modal>
  );
}
