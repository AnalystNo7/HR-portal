'use client';

import React, { useState } from 'react';
import { Icon, Avatar, initials, avColorFor } from '@/components/primitives';
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

const HR_DATA: Person[] = [
  { id: 1, name: 'Иванова Елена Сергеевна', dept: 'Блок ИТ / Разработка', pos: 'Ведущий инженер', lead: 'Морозов А. В.', family: 'ИТ-разработка', level: 'Senior (L4)', status: 'active' },
  { id: 2, name: 'Петров Олег Николаевич', dept: 'Блок ИТ / Разработка', pos: 'Инженер-программист', lead: 'Морозов А. В.', family: 'ИТ-разработка', level: 'Middle (L3)', status: 'vacation' },
  { id: 3, name: 'Соколова Мария Павловна', dept: 'Блок ИТ / Разработка', pos: 'Старший инженер', lead: 'Морозов А. В.', family: 'ИТ-разработка', level: 'Senior (L4)', status: 'trip' },
  { id: 4, name: 'Кузнецов Дмитрий Игоревич', dept: 'Блок ИТ / QA', pos: 'QA-инженер', lead: 'Морозов А. В.', family: 'Тестирование', level: 'Middle (L3)', status: 'active' },
  { id: 5, name: 'Волкова Анна Витальевна', dept: 'Блок ИТ / Разработка', pos: 'Младший инженер', lead: 'Морозов А. В.', family: 'ИТ-разработка', level: 'Junior (L2)', status: 'sick' },
  { id: 6, name: 'Новиков Сергей Александрович', dept: 'Блок ИТ / Архитектура', pos: 'Архитектор', lead: 'Морозов А. В.', family: 'Архитектура', level: 'Lead (L5)', status: 'active' },
  { id: 7, name: 'Белова Ирина Сергеевна', dept: 'Блок ИТ / Разработка', pos: 'Инженер-программист', lead: 'Морозов А. В.', family: 'ИТ-разработка', level: 'Middle (L3)', status: 'active' },
  { id: 8, name: 'Ефимов Павел Дмитриевич', dept: 'Блок ИТ / DevOps', pos: 'DevOps-инженер', lead: 'Морозов А. В.', family: 'Инфраструктура', level: 'Senior (L4)', status: 'active' },
  { id: 9, name: 'Кузнецова Антонина Тимофеевна', dept: 'HR-департамент', pos: 'Начальник отдела', lead: 'Смирнова Е. П.', family: 'HR', level: 'Lead (L5)', status: 'active' },
  { id: 10, name: 'Орлов Максим Владимирович', dept: 'Блок капитального строительства', pos: 'Руководитель проекта', lead: 'Смирнов В. А.', family: 'Управление проектами', level: 'Lead (L5)', status: 'vacation' },
  { id: 11, name: 'Лебедева Ольга Петровна', dept: 'Юридическая служба', pos: 'Ведущий юрист', lead: 'Чернова А. И.', family: 'Право', level: 'Senior (L4)', status: 'active' },
  { id: 12, name: 'Фёдоров Илья Сергеевич', dept: 'Блок экономики и финансов', pos: 'Финансовый аналитик', lead: 'Горбунов Д. Е.', family: 'Финансы', level: 'Middle (L3)', status: 'trip' },
];

const STATUS_LABEL: Record<Status, React.ReactNode> = {
  active: <span className="pill pill-green pill-dot">Активен</span>,
  vacation: <span className="pill pill-orange pill-dot">Отпуск</span>,
  sick: <span className="pill pill-red pill-dot">Больничный</span>,
  trip: <span className="pill pill-blue pill-dot">Командировка</span>,
};

type Tab = 'all' | 'vac' | 'comp' | 'req' | 'surv';

export default function HRPage() {
  const [tab, setTab] = useState<Tab>('all');

  return (
    <div>
      <div className="tabs">
        {[
          { id: 'all' as Tab, label: 'Все сотрудники' },
          { id: 'vac' as Tab, label: 'Отклики на вакансии' },
          { id: 'comp' as Tab, label: 'Компетенции' },
          { id: 'req' as Tab, label: 'Обращения' },
          { id: 'surv' as Tab, label: 'Опросы и рассылки' },
        ].map(t => (
          <button key={t.id} aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {tab === 'all' && <HRAllTab />}
      {tab !== 'all' && (
        <div className="card" style={{ padding: 40 }}>
          <div className="empty">
            <div className="ill"><EmptyCube w={120} /></div>
            <h3 style={{ fontFamily: 'var(--font-head)', fontSize: 20 }}>Модуль в разработке</h3>
            <p style={{ maxWidth: 440, margin: '8px auto' }}>Запуск — III квартал 2025.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function HRAllTab() {
  return (
    <>
      <div className="mgr-toolbar">
        <div className="hdr-search" style={{ margin: 0, flex: '0 0 320px' }}>
          <Icon name="search" size={16} />
          <input placeholder="ФИО, табельный, должность..." />
        </div>
        <button className="btn btn-secondary btn-sm"><Icon name="filter" size={14} /> Подразделение</button>
        <button className="btn btn-secondary btn-sm"><Icon name="filter" size={14} /> Семья ролей</button>
        <button className="btn btn-secondary btn-sm"><Icon name="filter" size={14} /> Статус</button>
        <div className="flex-1" />
        <button className="btn btn-secondary btn-sm"><Icon name="download" size={14} /> Экспорт</button>
        <button className="btn btn-primary btn-sm"><Icon name="plus" size={14} /> Новый сотрудник</button>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Сотрудник</th>
              <th>Подразделение</th>
              <th>Должность</th>
              <th>Руководитель</th>
              <th>Уровень</th>
              <th>Статус</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {HR_DATA.map(p => (
              <tr key={p.id}>
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
                <td><a href="#" className="job-link" onClick={e => e.preventDefault()}>{p.pos}</a></td>
                <td className="small">{p.lead}</td>
                <td className="small"><b>{p.level}</b></td>
                <td>{STATUS_LABEL[p.status]}</td>
                <td><button className="btn btn-ghost btn-sm"><Icon name="dots" size={16} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
