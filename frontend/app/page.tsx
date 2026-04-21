'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon, Modal } from '@/components/primitives';
import { PersonProfile, PeopleTalk, Team, Lightbulb } from '@/components/illustrations/Illustrations';
import { useAuth } from '@/contexts/AuthContext';

const TILES = [
  { id: '/profile', title: 'Личный кабинет', sub: 'Профиль, компетенции, отпуск', icon: 'user' },
  { id: '/career', title: 'Карьера', sub: 'Трек развития и уровни', icon: 'compass' },
  { id: '/learn', title: 'Обучение', sub: 'Курсы и мероприятия', icon: 'graduation' },
  { id: '/culture', title: 'Корп. культура', sub: 'Ценности, герои, традиции', icon: 'heart' },
  { id: '/appeals', title: 'Обращения', sub: 'Вопросы и заявки', icon: 'chat', badge: 2 },
  { id: '/org', title: 'Оргструктура', sub: 'Подразделения и руководители', icon: 'building' },
  { id: '/benefits', title: 'Льготы', sub: 'ДМС, страхование, бонусы', icon: 'gift' },
  { id: '/docs', title: 'Документы', sub: 'Справки и заявления', icon: 'file' },
  { id: '/manager', title: 'Моя команда', sub: 'Подчинённые и статусы', icon: 'users' },
  { id: '/events', title: 'Мероприятия', sub: 'Корпоративный календарь', icon: 'calendar' },
  { id: '/news', title: 'Новости', sub: 'Что происходит в компании', icon: 'flag' },
  { id: '/help', title: 'Поддержка', sub: 'Справка и контакты', icon: 'bell' },
];

const VALUES = [
  { Ill: PeopleTalk, title: 'Ответственность за результат', text: 'Мы доводим задачи до конца и отвечаем за качество.' },
  { Ill: Team, title: 'Команда единомышленников', text: 'Поддерживаем друг друга, делимся знаниями и опытом.' },
  { Ill: PersonProfile, title: 'Профессионализм и развитие', text: 'Растём вместе с компанией и отраслью.' },
];

const POLL_QS = [
  'Рекомендуете ли вы Газпром ЦПС как работодателя? (шкала 1–10)',
  'Насколько вам понятны цели вашего подразделения?',
  'Получаете ли вы регулярную обратную связь от руководителя?',
  'Видите ли вы возможности для развития?',
  'Что бы вы улучшили в работе компании? (свободный ответ)',
];

export default function HomePage() {
  const router = useRouter();
  const { user, setFeedbackOpen } = useAuth();
  const [pollOpen, setPollOpen] = useState(false);

  return (
    <div>
      <section className="home-hello">
        <div className="flex-1">
          <h1>Привет{user ? `, ${user.firstName}` : ''}!</h1>
          <p>
            Добро пожаловать в Портал Газпром ЦПС. Здесь можно работать с личным кабинетом,
            посмотреть карьерный трек, задать вопрос HR или изучить корпоративную культуру.
          </p>
          <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" onClick={() => router.push('/profile')}>
              <Icon name="user" size={16} /> Мой профиль
            </button>
            <button className="btn btn-secondary" onClick={() => setFeedbackOpen(true)}>
              <Icon name="bulb" size={16} /> Обратная связь
            </button>
          </div>
        </div>
        <div className="hero-ill"><PersonProfile w={280} /></div>
      </section>

      <div className="section-label">
        Разделы портала
        <a className="link" href="#">Все разделы →</a>
      </div>
      <div className="tile-grid">
        {TILES.map(t => (
          <button key={t.id} className="tile" onClick={() => router.push(t.id)}>
            {t.badge && <span className="pill pill-orange tile-badge">{t.badge}</span>}
            <div className="tile-icon"><Icon name={t.icon} size={22} /></div>
            <div>
              <div className="tile-title">{t.title}</div>
              <div className="tile-sub">{t.sub}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="section-label">Ценности компании</div>
      <div className="values-grid">
        {VALUES.map((v, i) => (
          <div key={i} className="value-card">
            <h3>{v.title}</h3>
            <p>{v.text}</p>
            <div className="ill"><v.Ill w={180} /></div>
          </div>
        ))}
      </div>

      <div className="section-label">Опросы и вовлечённость</div>
      <div className="card polls-card">
        <div className="polls-left">
          <h3>Квартальный опрос вовлечённости</h3>
          <p className="muted" style={{ fontSize: 13 }}>18 вопросов · 5–7 минут · анонимно</p>
          <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--gpc-gray-500)' }}>
            <span>До окончания: <b style={{ color: 'var(--gpc-gray-800)' }}>14 дней</b></span>
            <span>Приняли участие: <b style={{ color: 'var(--gpc-blue)' }}>612 / 894</b></span>
          </div>
          <div>
            <button className="btn btn-primary">Пройти опрос</button>
            <button className="btn btn-ghost" onClick={() => setPollOpen(true)} style={{ marginLeft: 6 }}>
              Посмотреть примеры
            </button>
          </div>
        </div>
        <div className="polls-right">
          <h3>Ваше мнение формирует культуру компании</h3>
          <button className="btn">
            Пройти сейчас <Icon name="arrow_right" size={16} />
          </button>
          <div className="ill"><Lightbulb w={180} /></div>
        </div>
      </div>

      <Modal
        open={pollOpen}
        onClose={() => setPollOpen(false)}
        title="Примеры вопросов"
        size="md"
        footer={<button className="btn btn-primary" onClick={() => setPollOpen(false)}>Понятно</button>}
      >
        <div className="poll-qs">
          {POLL_QS.map((q, i) => (
            <div key={i} className="poll-q">
              <b>{i + 1}.</b> {q}
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
