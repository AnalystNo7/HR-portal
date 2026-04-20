'use client';

import React, { useState } from 'react';
import { Icon, Avatar, Modal, initials, avColorFor } from '@/components/primitives';
import { EmptyCube } from '@/components/illustrations/Illustrations';

type Status = 'active' | 'vacation' | 'sick' | 'trip';

interface Person {
  id: number;
  name: string;
  dept: string;
  pos: string;
  lead: string;
  family: string;
  level: string;
  status: Status;
}

const TEAM_DATA: Person[] = [
  { id: 1, name: 'Иванова Елена Сергеевна', dept: 'Блок ИТ / Разработка', pos: 'Ведущий инженер', lead: 'Морозов А. В.', family: 'ИТ-разработка', level: 'Senior (L4)', status: 'active' },
  { id: 2, name: 'Петров Олег Николаевич', dept: 'Блок ИТ / Разработка', pos: 'Инженер-программист', lead: 'Морозов А. В.', family: 'ИТ-разработка', level: 'Middle (L3)', status: 'vacation' },
  { id: 3, name: 'Соколова Мария Павловна', dept: 'Блок ИТ / Разработка', pos: 'Старший инженер', lead: 'Морозов А. В.', family: 'ИТ-разработка', level: 'Senior (L4)', status: 'trip' },
  { id: 4, name: 'Кузнецов Дмитрий Игоревич', dept: 'Блок ИТ / QA', pos: 'QA-инженер', lead: 'Морозов А. В.', family: 'Тестирование', level: 'Middle (L3)', status: 'active' },
  { id: 5, name: 'Волкова Анна Витальевна', dept: 'Блок ИТ / Разработка', pos: 'Младший инженер', lead: 'Морозов А. В.', family: 'ИТ-разработка', level: 'Junior (L2)', status: 'sick' },
  { id: 6, name: 'Новиков Сергей Александрович', dept: 'Блок ИТ / Архитектура', pos: 'Архитектор', lead: 'Морозов А. В.', family: 'Архитектура', level: 'Lead (L5)', status: 'active' },
  { id: 7, name: 'Белова Ирина Сергеевна', dept: 'Блок ИТ / Разработка', pos: 'Инженер-программист', lead: 'Морозов А. В.', family: 'ИТ-разработка', level: 'Middle (L3)', status: 'active' },
  { id: 8, name: 'Ефимов Павел Дмитриевич', dept: 'Блок ИТ / DevOps', pos: 'DevOps-инженер', lead: 'Морозов А. В.', family: 'Инфраструктура', level: 'Senior (L4)', status: 'active' },
];

const STATUS_LABEL: Record<Status, React.ReactNode> = {
  active: <span className="pill pill-green pill-dot">Активен</span>,
  vacation: <span className="pill pill-orange pill-dot">Отпуск</span>,
  sick: <span className="pill pill-red pill-dot">Больничный</span>,
  trip: <span className="pill pill-blue pill-dot">Командировка</span>,
};

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
  const [posOpen, setPosOpen] = useState<Person | null>(null);

  return (
    <div>
      <div className="tabs">
        {TABS.map(t => (
          <button key={t.id} aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {tab === 'team' && <TeamTab onOpenPos={setPosOpen} />}
      {tab === 'status' && <StatusCalendar />}
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

function TeamTab({ onOpenPos }: { onOpenPos: (p: Person) => void }) {
  return (
    <>
      <div className="mgr-toolbar">
        <button className="btn btn-primary btn-sm">
          <Icon name="file" size={14} /> Отчёт о СМС / ОВЗ
        </button>
        <button className="btn btn-secondary btn-sm">
          <Icon name="download" size={14} /> Экспорт в Excel
        </button>
        <div className="flex-1" />
        <div className="hdr-search" style={{ margin: 0, flex: '0 0 260px' }}>
          <Icon name="search" size={16} />
          <input placeholder="Найти сотрудника..." />
        </div>
        <button className="btn btn-secondary btn-sm">
          <Icon name="filter" size={14} /> Фильтры
        </button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 24 }}></th>
              <th>Сотрудник</th>
              <th>Подразделение</th>
              <th>Должность</th>
              <th>Руководитель</th>
              <th>Семья / Уровень</th>
              <th>Статус</th>
              <th style={{ width: 48 }}></th>
            </tr>
          </thead>
          <tbody>
            {TEAM_DATA.map(p => (
              <tr key={p.id}>
                <td className="col-drag"><Icon name="drag" size={14} /></td>
                <td>
                  <div className="avatar-cell">
                    <div className={`av av-${avColorFor(p.name)}`}>{initials(p.name)}</div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      <div className="small muted">{p.pos}</div>
                    </div>
                  </div>
                </td>
                <td className="small">{p.dept}</td>
                <td>
                  <a href="#" className="job-link" onClick={e => { e.preventDefault(); onOpenPos(p); }}>{p.pos}</a>
                </td>
                <td className="small">{p.lead}</td>
                <td className="small">{p.family} · <b>{p.level.match(/L\d/)?.[0]}</b></td>
                <td>{STATUS_LABEL[p.status]}</td>
                <td>
                  <button className="btn btn-ghost btn-sm"><Icon name="dots" size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: '1px solid var(--line)',
          fontSize: 12,
          color: 'var(--gpc-gray-500)',
        }}>
          <span>Показано {TEAM_DATA.length} из {TEAM_DATA.length}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-secondary btn-sm" disabled><Icon name="chevron_left" size={14} /></button>
            <button className="btn btn-primary btn-sm" style={{ minWidth: 30, padding: 0 }}>1</button>
            <button className="btn btn-secondary btn-sm" disabled><Icon name="chevron_right" size={14} /></button>
          </div>
        </div>
      </div>
    </>
  );
}

function StatusCalendar() {
  const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
  const bars = [
    { row: 0, type: 'vac' as const, from: 7, to: 8, label: 'Отпуск' },
    { row: 1, type: 'vac' as const, from: 6, to: 7, label: 'Отпуск' },
    { row: 2, type: 'trip' as const, from: 8, to: 8.5, label: 'Командировка' },
    { row: 4, type: 'sick' as const, from: 7.5, to: 8, label: 'Больничный' },
    { row: 5, type: 'vac' as const, from: 10, to: 11, label: 'Отпуск' },
    { row: 7, type: 'trip' as const, from: 5, to: 6, label: 'Командировка' },
  ];

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
      {TEAM_DATA.map((p, i) => (
        <div key={p.id} className="row-g">
          <div className="g-name">
            <div className={`av av-${avColorFor(p.name)}`} style={{ width: 24, height: 24, fontSize: 10 }}>{initials(p.name)}</div>
            <div><b>{p.name.split(' ').slice(0, 2).join(' ')}</b></div>
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
      ))}
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

function PositionModal({ open, onClose, person }: { open: boolean; onClose: () => void; person: Person | null }) {
  if (!person) return null;
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
        <Avatar name={person.name} size="lg" />
        <div>
          <h3 style={{ fontFamily: 'var(--font-head)', fontSize: 18 }}>{person.pos}</h3>
          <div className="muted small">{person.dept}</div>
          <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
            <span className="pill pill-blue">{person.family}</span>
            <span className="pill pill-gray">{person.level}</span>
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
            Для перехода на Lead (L5) необходимо: опыт владения архитектурными решениями ≥ 1 года, подтверждённые ментор-сессии, публикации во внутренней базе знаний.
          </span>
        </div>
      </div>
    </Modal>
  );
}
