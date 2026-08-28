'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon, Avatar, useToast } from '@/components/primitives';
import { Support, EmptyCube } from '@/components/illustrations/Illustrations';
import { useAuth } from '@/contexts/AuthContext';
import {
  Appeal,
  AppealComment,
  AppealStatus,
  listAppeals,
  getAppealById,
  addAppealComment,
  updateAppealStatus,
} from '@/lib/api';

const STATUS_PILL: Record<AppealStatus, React.ReactNode> = {
  NEW: <span className="pill pill-blue pill-dot">Новое</span>,
  IN_PROGRESS: <span className="pill pill-yellow pill-dot">В работе</span>,
  NEEDS_CLARIFICATION: <span className="pill pill-orange pill-dot">Требует уточнения</span>,
  RESOLVED: <span className="pill pill-green pill-dot">Решено</span>,
  CLOSED: <span className="pill pill-gray pill-dot">Закрыто</span>,
};

const STATUS_LABELS: Record<AppealStatus, string> = {
  NEW: 'Новое',
  IN_PROGRESS: 'В работе',
  NEEDS_CLARIFICATION: 'Требует уточнения',
  RESOLVED: 'Решено',
  CLOSED: 'Закрыто',
};

const FILTERS: { id: string; label: string; status?: AppealStatus }[] = [
  { id: 'all', label: 'Все' },
  { id: 'new', label: 'Новые', status: 'NEW' },
  { id: 'in_progress', label: 'В работе', status: 'IN_PROGRESS' },
  { id: 'needs', label: 'Требуют уточнения', status: 'NEEDS_CLARIFICATION' },
  { id: 'resolved', label: 'Решены', status: 'RESOLVED' },
  { id: 'closed', label: 'Закрытые', status: 'CLOSED' },
];

export default function AppealsPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const { setFeedbackOpen, user } = useAuth();
  const [reloadKey, setReloadKey] = useState(0);

  if (selected) {
    return (
      <RequestDetail
        id={selected}
        onBack={() => { setSelected(null); setReloadKey(k => k + 1); }}
      />
    );
  }

  return (
    <RequestsList
      key={reloadKey}
      onOpen={setSelected}
      onNew={() => setFeedbackOpen(true)}
      isHR={user?.role === 'hr'}
      authorId={user?.role === 'hr' ? undefined : user?.id}
    />
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }) +
    ', ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function authorName(appeal: Appeal) {
  if (appeal.isAnonymous) return 'Анонимное обращение';
  const a = appeal.author;
  if (!a) return '—';
  return `${a.lastName} ${a.firstName[0]}. ${a.middleName ? a.middleName[0] + '.' : ''}`.trim();
}

function RequestsList({
  onOpen,
  onNew,
  isHR,
  authorId,
}: {
  onOpen: (id: string) => void;
  onNew: () => void;
  isHR: boolean;
  authorId?: string;
}) {
  const [filter, setFilter] = useState('all');
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const f = FILTERS.find(x => x.id === filter);
      const result = await listAppeals({
        status: f?.status,
        authorId,
      });
      setAppeals(result.data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [filter, authorId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
          <h3>{isHR ? 'Все обращения' : 'Мои обращения'} ({appeals.length})</h3>
          <button className="btn btn-primary btn-sm" onClick={onNew}>
            <Icon name="plus" size={14} /> Новое обращение
          </button>
        </div>

        {error && (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div className="empty">
              <div className="ill"><EmptyCube w={100} /></div>
              <h3>Не удалось загрузить обращения</h3>
              <p className="small muted">{error}</p>
              <button className="btn btn-primary" onClick={load} style={{ marginTop: 12 }}>Повторить</button>
            </div>
          </div>
        )}

        {!error && loading && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--gpc-gray-500)' }}>Загрузка...</div>
        )}

        {!error && !loading && appeals.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div className="empty">
              <div className="ill"><Support w={160} /></div>
              <h3>Обращений пока нет</h3>
              <p className="small muted">Создайте первое обращение через кнопку «Новое обращение».</p>
            </div>
          </div>
        )}

        {!error && !loading && appeals.length > 0 && (
          <div className="req-list">
            {appeals.map(r => (
              <div key={r.id} className="req-row" onClick={() => onOpen(r.id)}>
                <Avatar name={r.direction} size="sm" />
                <div>
                  <div className="subj">{r.subject}</div>
                  <div className="preview">{r.text}</div>
                </div>
                <div className="muted small">{r.direction}</div>
                <div>{STATUS_PILL[r.status]}</div>
                <div className="date">№ {r.number}</div>
                <div className="date">{formatDate(r.createdAt)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RequestDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const [appeal, setAppeal] = useState<(Appeal & { comments: AppealComment[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const toast = useToast();
  const { user } = useAuth();

  const canChangeStatus = user?.role === 'hr';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAppealById(id);
      setAppeal(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleSend = async () => {
    if (!reply.trim() || !user) return;
    setSending(true);
    try {
      await addAppealComment(id, { text: reply });
      setReply('');
      toast('Ответ отправлен');
      load();
    } catch (e) {
      toast(`Ошибка: ${(e as Error).message}`);
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (status: AppealStatus) => {
    try {
      await updateAppealStatus(id, status);
      toast(`Статус изменён: ${STATUS_LABELS[status]}`);
      load();
    } catch (e) {
      toast(`Ошибка: ${(e as Error).message}`);
    }
  };

  if (loading) {
    return <div className="card card-pad">Загрузка обращения...</div>;
  }

  if (error || !appeal) {
    return (
      <div>
        <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: 12 }}>
          <Icon name="chevron_left" size={14} /> Назад к списку
        </button>
        <div className="card card-pad">
          <div className="empty">
            <h3>Обращение не найдено</h3>
            <p className="small muted">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: 12 }}>
        <Icon name="chevron_left" size={14} /> Назад к списку
      </button>
      <div className="req-detail">
        <div className="req-thread">
          <div className="req-thread-head">
            <h2>{appeal.subject}</h2>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'var(--gpc-gray-500)', fontSize: 12.5, flexWrap: 'wrap' }}>
              № {appeal.number} · {appeal.direction} · открыто {formatDate(appeal.createdAt)} · {STATUS_PILL[appeal.status]}
            </div>
          </div>

          <div className="req-msg">
            <header>
              <Avatar name={authorName(appeal)} size="sm" />
              <b>{authorName(appeal)}</b>
              <span>{formatDateTime(appeal.createdAt)}</span>
            </header>
            <p>{appeal.text}</p>
          </div>

          {appeal.comments.map(c => {
            const name = c.author ? `${c.author.lastName} ${c.author.firstName}` : '—';
            return (
              <div key={c.id} className="req-msg">
                <header>
                  <Avatar name={name} size="sm" />
                  <b>{name}</b>
                  <span>{formatDateTime(c.createdAt)}</span>
                </header>
                <p>{c.text}</p>
              </div>
            );
          })}

          <div className="req-reply">
            <textarea
              className="ta"
              rows={3}
              placeholder="Написать ответ..."
              value={reply}
              onChange={e => setReply(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary btn-sm"><Icon name="paperclip" size={14} /> Прикрепить</button>
              <div className="flex-1" />
              {canChangeStatus && appeal.status !== 'CLOSED' && (
                <button className="btn btn-secondary btn-sm" onClick={() => handleStatusChange('CLOSED')}>
                  Закрыть обращение
                </button>
              )}
              <button
                className="btn btn-primary btn-sm"
                onClick={handleSend}
                disabled={sending || !reply.trim()}
              >
                {sending ? 'Отправка...' : 'Отправить'}
              </button>
            </div>
          </div>
        </div>

        <aside className="req-side">
          <div className="side-ill"><Support w={180} /></div>
          <hr className="divider" />
          <div className="kv">
            <div><span>Статус</span> {STATUS_PILL[appeal.status]}</div>
            <div><span>Направление</span> <b>{appeal.direction}</b></div>
            <div><span>Дата</span> <b>{formatDate(appeal.createdAt)}</b></div>
            <div><span>Комментариев</span> <b>{appeal.comments.length}</b></div>
            <div><span>SLA</span> <b style={{ color: 'var(--ok-green)' }}>В норме</b></div>
          </div>

          {canChangeStatus && (
            <>
              <hr className="divider" />
              <div>
                <label style={{ fontSize: 11.5, color: 'var(--gpc-gray-600)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', display: 'block', marginBottom: 6 }}>
                  Смена статуса
                </label>
                <select
                  className="sel"
                  value={appeal.status}
                  onChange={e => handleStatusChange(e.target.value as AppealStatus)}
                >
                  {(Object.keys(STATUS_LABELS) as AppealStatus[]).map(s => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
