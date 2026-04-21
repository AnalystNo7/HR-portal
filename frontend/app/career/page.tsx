'use client';

import React, { useState } from 'react';
import { Icon, Avatar, Modal } from '@/components/primitives';
import { EmptyCube, Referral } from '@/components/illustrations/Illustrations';
import { useAuth } from '@/contexts/AuthContext';

interface Level {
  id: number;
  name: string;
  sub: string;
  tag: 'past' | 'current' | 'next' | 'future';
}

const LEVELS: Level[] = [
  { id: 1, name: 'Junior', sub: 'L1–L2', tag: 'past' },
  { id: 2, name: 'Middle', sub: 'L3', tag: 'past' },
  { id: 3, name: 'Senior', sub: 'L4', tag: 'current' },
  { id: 4, name: 'Lead', sub: 'L5', tag: 'next' },
  { id: 5, name: 'Principal', sub: 'L6', tag: 'future' },
];

export default function CareerPage() {
  const { user } = useAuth();
  const [lvl, setLvl] = useState<Level | null>(null);

  const fullName = user ? `${user.lastName} ${user.firstName} ${user.middleName ?? ''}`.trim() : '';

  return (
    <div>
      <div className="profile-head" style={{ marginBottom: 24 }}>
        <Avatar name={fullName} size="lg" />
        <div className="names">
          <h1>{fullName || 'Загрузка...'}</h1>
          <div className="role">{user?.position ?? ''} · {user?.department ?? ''} · ООО «Газпром ЦПС»</div>
          <div className="meta">
            <span>Семья ролей: <b>ИТ-разработка</b></span>
            <span>Текущий уровень: <b>Senior (L4)</b></span>
            <span>Следующий: <b>Lead (L5)</b></span>
          </div>
        </div>
      </div>

      <div className="section-label">Карьерный трек</div>
      <div className="ladder">
        {LEVELS.map(l => (
          <div key={l.id} className={`step ${l.tag === 'current' ? 'current' : l.tag === 'past' ? 'past' : ''}`}>
            <div className="info" onClick={() => setLvl(l)} title="Подробнее">
              <Icon name="info" size={14} />
            </div>
            <div className="lv">{l.id}</div>
            <b>{l.name}</b>
            <span className="small muted">{l.sub}</span>
            {l.tag === 'current' && <span className="pill pill-blue pill-dot" style={{ alignSelf: 'flex-start' }}>Вы здесь</span>}
            {l.tag === 'next' && <span className="pill pill-orange pill-dot" style={{ alignSelf: 'flex-start' }}>Ближайшая цель</span>}
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ marginTop: 24 }}>
        <div className="card card-pad">
          <h3 style={{ fontFamily: 'var(--font-head)', fontSize: 17, marginBottom: 10 }}>Что развивать до Lead (L5)</h3>
          <div className="stack stack-3">
            {[
              { n: '1', title: 'Архитектурные решения', text: 'Отвечать за архитектуру >= 1 крупного продукта в течение года.' },
              { n: '2', title: 'Менторство', text: 'Регулярные ментор-сессии с Middle-инженерами, подтверждённые обратной связью.' },
              { n: '3', title: 'Внешние коммуникации', text: 'Публикации в базе знаний, доклад на внутреннем митапе.' },
            ].map(item => (
              <div key={item.n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div className="av av-blue" style={{ width: 28, height: 28, fontSize: 12 }}>{item.n}</div>
                <div>
                  <b style={{ fontSize: 13 }}>{item.title}</b>
                  <p className="small muted">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="banner warm" style={{ alignItems: 'flex-start' }}>
          <div className="ill"><Referral w={160} /></div>
          <div className="b-body">
            <h3>Приведи друга</h3>
            <p>Порекомендуйте коллегу — при успешном найме вы получаете бонус. Актуальные вакансии в разделе «Отклики».</p>
            <button className="btn btn-orange btn-sm" style={{ marginTop: 10 }}>
              <Icon name="gift" size={14} /> Рекомендовать
            </button>
          </div>
        </div>
      </div>

      <Modal
        open={!!lvl}
        onClose={() => setLvl(null)}
        title={lvl ? `${lvl.name} · ${lvl.sub}` : ''}
        size="md"
        footer={<button className="btn btn-primary" onClick={() => setLvl(null)}>Понятно</button>}
      >
        {lvl && (
          <>
            <p style={{ marginBottom: 12 }}>Описание уровня для семьи <b>ИТ-разработка</b>.</p>
            <div className="empty" style={{ padding: '24px 10px' }}>
              <div className="ill"><EmptyCube w={80} /></div>
              <h3>Компетенции — в разработке</h3>
              <p className="small muted">Полный гайд с критериями роста появится с запуском модуля компетенций.</p>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
