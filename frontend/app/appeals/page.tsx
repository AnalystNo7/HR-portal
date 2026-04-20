'use client';

import React, { useState } from 'react';
import { Icon, Avatar, useToast } from '@/components/primitives';
import { Support } from '@/components/illustrations/Illustrations';
import { useAuth } from '@/contexts/AuthContext';

type Status = 'open' | 'in_progress' | 'answered' | 'closed';

interface RequestItem {
  id: string;
  subj: string;
  dir: string;
  status: Status;
  preview: string;
  date: string;
}

const REQS_DATA: RequestItem[] = [
  { id: 'R-2841', subj: 'Нужна справка 2-НДФЛ для банка', dir: 'HR и кадры', status: 'open', preview: 'Добрый день, требуется справка о доходах за 2024 год...', date: '12 авг' },
  { id: 'R-2839', subj: 'Продлить доступ к VPN', dir: 'ИТ-поддержка', status: 'answered', preview: 'Истекает 15 августа, нужно продлить на год...', date: '10 авг' },
  { id: 'R-2832', subj: 'Замена корпоративного ноутбука', dir: 'ИТ-поддержка', status: 'in_progress', preview: 'Текущий ноутбук работает медленно, часто перегревается...', date: '8 авг' },
  { id: 'R-2820', subj: 'Заказать пропуск для гостя', dir: 'АХО и офис', status: 'closed', preview: 'Встреча 5 августа в 11:00, гость — Иванов Д.С....', date: '3 авг' },
  { id: 'R-2805', subj: 'Вопрос по расчётному листку за июль', dir: 'Финансы и ЗП', status: 'closed', preview: 'Не совпадает сумма премии с ожидаемой...', date: '29 июл' },
];

const STATUS_PILL: Record<Status, React.ReactNode> = {
  open: <span className="pill pill-blue pill-dot">Открыто</span>,
  in_progress: <span className="pill pill-yellow pill-dot">В работе</span>,
  answered: <span className="pill pill-orange pill-dot">Ждёт ответа</span>,
  closed: <span className="pill pill-gray pill-dot">Закрыто</span>,
};

const FILTERS: { id: string; label: string; status?: Status }[] = [
  { id: 'all', label: 'Все' },
  { id: 'open', label: 'Открытые', status: 'open' },
  { id: 'answered', label: 'Ждёт ответа', status: 'answered' },
  { id: 'in_progress', label: 'В работе', status: 'in_progress' },
  { id: 'closed', label: 'Закрытые', status: 'closed' },
];

export default function AppealsPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const { setFeedbackOpen } = useAuth();

  if (selected) {
    return <RequestDetail id={selected} onBack={() => setSelected(null)} />;
  }

  return <RequestsList onOpen={setSelected} onNew={() => setFeedbackOpen(true)} />;
}

function RequestsList({ onOpen, onNew }: { onOpen: (id: string) => void; onNew: () => void }) {
  const [filter, setFilter] = useState('all');

  const filtered = REQS_DATA.filter(r => {
    const f = FILTERS.find(x => x.id === filter);
    if (!f?.status) return true;
    return r.status === f.status;
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {FILTERS.map(f => (
            <button
              key={f.id}
              className="btn btn-sm"
              style={{
                background: filter === f.id ? 'var(--gpc-blue)' : '#fff',
                color: filter === f.id ? '#fff' : 'var(--gpc-gray-700)',
                border: filter === f.id ? 'none' : '1px solid var(--line-strong)',
              }}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div className="card-head">
          <h3>Мои обращения ({filtered.length})</h3>
          <button className="btn btn-primary btn-sm" onClick={onNew}>
            <Icon name="plus" size={14} /> Новое обращение
          </button>
        </div>
        <div className="req-list">
          {filtered.map(r => (
            <div key={r.id} className="req-row" onClick={() => onOpen(r.id)}>
              <Avatar name={r.dir} size="sm" />
              <div>
                <div className="subj">{r.subj}</div>
                <div className="preview">{r.preview}</div>
              </div>
              <div className="muted small">{r.dir}</div>
              <div>{STATUS_PILL[r.status]}</div>
              <div className="date">№ {r.id}</div>
              <div className="date">{r.date}</div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--gpc-gray-500)' }}>
              Обращений с таким фильтром нет.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RequestDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const req = REQS_DATA.find(r => r.id === id) || REQS_DATA[0];
  const toast = useToast();
  const [reply, setReply] = useState('');

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: 12 }}>
        <Icon name="chevron_left" size={14} /> Назад к списку
      </button>
      <div className="req-detail">
        <div className="req-thread">
          <div className="req-thread-head">
            <h2>{req.subj}</h2>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'var(--gpc-gray-500)', fontSize: 12.5 }}>
              № {req.id} · {req.dir} · открыто {req.date} · {STATUS_PILL[req.status]}
            </div>
          </div>
          <div className="req-msg">
            <header>
              <Avatar name="Александр Морозов" size="sm" />
              <b>Вы</b>
              <span>12 авг, 10:42</span>
            </header>
            <p>{req.preview} Нужна справка за период с января по июль 2025 года. Подойдёт электронная копия с ЭЦП.</p>
          </div>
          <div className="req-msg">
            <header>
              <Avatar name="Кузнецова Антонина" size="sm" />
              <b>Кузнецова А. Т. · HR</b>
              <span>12 авг, 14:15</span>
            </header>
            <p>Добрый день! Справку подготовим завтра, к концу дня. Направим на вашу рабочую почту с ЭЦП. Нужен ли дополнительно оригинал?</p>
          </div>
          <div className="req-reply">
            <textarea
              className="ta"
              rows={3}
              placeholder="Написать ответ..."
              value={reply}
              onChange={e => setReply(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary btn-sm">
                <Icon name="paperclip" size={14} /> Прикрепить
              </button>
              <div className="flex-1" />
              <button className="btn btn-secondary btn-sm">Закрыть обращение</button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => { toast('Ответ отправлен'); setReply(''); }}
              >
                Отправить
              </button>
            </div>
          </div>
        </div>
        <aside className="req-side">
          <div className="side-ill"><Support w={180} /></div>
          <hr className="divider" />
          <div className="kv">
            <div><span>Статус</span> {STATUS_PILL[req.status]}</div>
            <div><span>Направление</span> <b>{req.dir}</b></div>
            <div><span>Ответственный</span> <b>Кузнецова А. Т.</b></div>
            <div><span>Приоритет</span> <b>Средний</b></div>
            <div><span>Последний ответ</span> <b>14:15</b></div>
            <div><span>SLA</span> <b style={{ color: 'var(--ok-green)' }}>В норме</b></div>
          </div>
        </aside>
      </div>
    </div>
  );
}
