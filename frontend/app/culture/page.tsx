'use client';

import React, { useState } from 'react';
import { Icon, Avatar, avColorFor, initials } from '@/components/primitives';
import { PeopleTalk, Team, PersonProfile, Lightbulb, Book } from '@/components/illustrations/Illustrations';

const SECTIONS = [
  { id: 'mission', label: 'Миссия', icon: 'flag' },
  { id: 'values', label: 'Ценности', icon: 'heart' },
  { id: 'rules', label: 'Правила', icon: 'shield' },
  { id: 'heroes', label: 'Герои', icon: 'star' },
  { id: 'traditions', label: 'Традиции', icon: 'gift' },
  { id: 'video', label: 'Обучающее видео', icon: 'bulb' },
  { id: 'books', label: 'Книжный клуб', icon: 'book' },
] as const;

type SectionId = typeof SECTIONS[number]['id'];

const VALUES = [
  { Ill: PeopleTalk, title: 'Ответственность за результат', text: 'Мы доводим задачи до конца и отвечаем за качество.' },
  { Ill: Team, title: 'Команда единомышленников', text: 'Поддерживаем друг друга, делимся знаниями и опытом.' },
  { Ill: PersonProfile, title: 'Профессионализм и развитие', text: 'Растём вместе с компанией и отраслью.' },
];

export default function CulturePage() {
  const [sec, setSec] = useState<SectionId>('mission');

  return (
    <div className="culture-main">
      <nav className="culture-nav">
        {SECTIONS.map(s => (
          <button key={s.id} aria-current={sec === s.id ? 'true' : undefined} onClick={() => setSec(s.id)}>
            <Icon name={s.icon} size={16} /> {s.label}
          </button>
        ))}
      </nav>
      <div>
        {sec === 'mission' && <CultureMission />}
        {sec === 'values' && <CultureValues />}
        {sec === 'heroes' && <CultureHeroes />}
        {sec === 'books' && <CultureBooks />}
        {sec === 'video' && <CultureVideo />}
        {(sec === 'rules' || sec === 'traditions') && (
          <div className="card card-pad">
            <h2 style={{ fontFamily: 'var(--font-head)', marginBottom: 8 }}>
              {SECTIONS.find(s => s.id === sec)!.label}
            </h2>
            <p className="muted">Раздел в наполнении. Скоро здесь появится контент от отдела бренда и коммуникаций.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CultureMission() {
  return (
    <div>
      <div className="hero-photo-card">
        <div>
          <span className="pill" style={{ background: 'rgba(255,255,255,.18)', color: '#fff', marginBottom: 10, display: 'inline-flex' }}>Наша миссия</span>
          <h2>Трансформируем сложные задачи в простые решения</h2>
          <p>Мы объединяем отраслевую экспертизу и современные ИТ-практики.</p>
        </div>
      </div>

      <div className="section-label" style={{ marginTop: 24 }}>Коротко о компании</div>
      <div className="grid-3">
        {[
          { n: '894', t: 'сотрудника' },
          { n: '12', t: 'направлений' },
          { n: '5', t: 'офисов по России' },
        ].map((f, i) => (
          <div key={i} className="card card-pad" style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-head)', fontSize: 44, color: 'var(--gpc-blue)', lineHeight: 1 }}>{f.n}</div>
            <div className="muted small" style={{ marginTop: 4 }}>{f.t}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CultureValues() {
  return (
    <div className="values-grid">
      {VALUES.map((v, i) => (
        <div key={i} className="value-card">
          <h3>{v.title}</h3>
          <p>{v.text}</p>
          <div className="ill"><v.Ill w={180} /></div>
        </div>
      ))}
    </div>
  );
}

function CultureHeroes() {
  const heroes = [
    { n: 'Иванова Елена', r: 'Ведущий инженер', c: 'blue' as const },
    { n: 'Орлов Максим', r: 'Руководитель проекта', c: 'orange' as const },
    { n: 'Лебедева Ольга', r: 'Ведущий юрист', c: 'green' as const },
    { n: 'Новиков Сергей', r: 'Архитектор', c: 'peach' as const },
    { n: 'Фёдоров Илья', r: 'Финансовый аналитик', c: 'purple' as const },
    { n: 'Соколова Мария', r: 'Старший инженер', c: 'blue' as const },
    { n: 'Ефимов Павел', r: 'DevOps-инженер', c: 'orange' as const },
    { n: 'Белова Ирина', r: 'Инженер-программист', c: 'green' as const },
  ];

  return (
    <>
      <div className="section-label" style={{ marginTop: 0 }}>Герои месяца</div>
      <div className="heroes">
        {heroes.map((h, i) => (
          <div key={i} className="hero-card">
            <div className="ph" style={{
              background: h.c === 'blue' ? 'var(--gpc-sky)' :
                h.c === 'orange' ? '#FFE8D4' : 'var(--gpc-gray-100)',
            }}>
              <Avatar name={h.n} size="lg" color={h.c} />
            </div>
            <div className="b">
              <b>{h.n}</b>
              <p>{h.r}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function CultureBooks() {
  const books = [
    { title: 'Чистый код', color: '#0079C2' },
    { title: 'Rework', color: '#D65200' },
    { title: 'Атлас профессий', color: '#033D62' },
    { title: 'Scrum', color: '#1F9D5E' },
    { title: 'Deep Work', color: '#5A2EBA' },
    { title: 'Принципы', color: '#FF6919' },
  ];

  return (
    <>
      <div className="section-label" style={{ marginTop: 0 }}>Книжный клуб</div>
      <p className="muted" style={{ marginBottom: 16 }}>Следующая встреча — 14 сентября, 19:00. Присоединяйтесь!</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16 }}>
        {books.map((b, i) => (
          <div key={i} style={{ textAlign: 'center' }}>
            <Book w={120} color={b.color} title={b.title} />
            <b style={{ display: 'block', fontSize: 13, marginTop: 8 }}>{b.title}</b>
          </div>
        ))}
      </div>
    </>
  );
}

function CultureVideo() {
  return (
    <div className="hero-photo-card" style={{ gridTemplateColumns: '1fr 220px' }}>
      <div>
        <span className="pill" style={{ background: 'rgba(255,255,255,.18)', color: '#fff', marginBottom: 10, display: 'inline-flex' }}>Видео</span>
        <h2>Создаём рабочее пространство вместе</h2>
        <p>15-минутный онбординг-ролик для новых коллег. Расскажет, как устроена компания и с чего начать.</p>
        <button className="btn btn-orange" style={{ marginTop: 14 }}><Icon name="check" size={16} /> Смотреть</button>
      </div>
      <Lightbulb w={200} />
    </div>
  );
}
