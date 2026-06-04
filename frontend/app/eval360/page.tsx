'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Icon, Modal, useToast } from '@/components/primitives';
import { useAuth } from '@/contexts/AuthContext';
import {
  get360Assignments, Assignment, get360Assignment, AssignmentForm, submit360Assignment,
  get360MyResults, MySubject360, get360MyResult, Results360, RespondentStatus, EvaluatorRole, EvalZone,
  listPeers, addPeer, removePeer, confirmPeers, PeerRespondent, getEmployees, Employee,
} from '@/lib/api';

const ST_PILL: Record<RespondentStatus, string> = { PENDING: 'pill-gray', IN_PROGRESS: 'pill-yellow', COMPLETED: 'pill-green' };
const ST_LABEL: Record<RespondentStatus, string> = { PENDING: 'Не начато', IN_PROGRESS: 'В работе', COMPLETED: 'Завершено' };

export default function Eval360Page() {
  const [tab, setTab] = useState<'assignments' | 'results'>('assignments');
  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-head)', fontSize: 22, marginBottom: 16 }}>Оценка 360</h2>
      <div className="tabs" style={{ marginBottom: 16 }}>
        <button aria-selected={tab === 'assignments'} onClick={() => setTab('assignments')}>Мои оценки</button>
        <button aria-selected={tab === 'results'} onClick={() => setTab('results')}>Мои результаты</button>
      </div>
      {tab === 'assignments' ? <AssignmentsTab /> : <MyResultsTab />}
    </div>
  );
}

// ─── Мои оценки (заполнение) ───────────────────────────
function AssignmentsTab() {
  const { user } = useAuth();
  const employeeId = user?.id;
  const [items, setItems] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<string | null>(null);
  const [peersFor, setPeersFor] = useState<Assignment | null>(null);

  const load = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    try { setItems(await get360Assignments(employeeId)); } catch {} finally { setLoading(false); }
  }, [employeeId]);
  useEffect(() => { load(); }, [load]);

  // Руководитель сначала утверждает список коллег — до этого открывается редактор, после — форма оценки.
  const needsPeerConfirm = (a: Assignment) => a.role === 'MANAGER' && a.managerEditsPeers && !a.peersConfirmed;
  const openAssignment = (a: Assignment) => { if (needsPeerConfirm(a)) setPeersFor(a); else setActive(a.id); };

  if (active && employeeId) return <FillForm respondentId={active} employeeId={employeeId} onBack={() => { setActive(null); load(); }} />;
  if (peersFor && employeeId) return (
    <PeerEditor
      assignment={peersFor} employeeId={employeeId}
      onBack={() => { setPeersFor(null); load(); }}
      onConfirmAndEvaluate={() => { const id = peersFor.id; setPeersFor(null); load(); setActive(id); }}
    />
  );

  if (loading) return <div className="card card-pad muted">Загрузка...</div>;
  if (items.length === 0) return <div className="card card-pad muted">Вам пока не назначено оценок.</div>;

  return (
    <div className="stack-2">
      {items.map(a => (
        <div key={a.id} className="card card-pad" style={{ cursor: 'pointer' }} onClick={() => openAssignment(a)}>
          <div className="row-2" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <b>{a.isSelf ? 'Самооценка' : `Оценка: ${a.subject.name}`}</b>
              <div className="small muted">{a.cycle.name} · {a.roleLabel}</div>
            </div>
            <span className={`pill ${ST_PILL[a.status]}`}>{ST_LABEL[a.status]}</span>
          </div>
          {needsPeerConfirm(a) && (
            <div className="small muted" style={{ marginTop: 8 }}>
              <Icon name="people" size={13} /> Утвердите список оценивающих коллег, чтобы начать оценку
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Управление коллегами (для руководителя) ──────────
const fio = (e: { lastName: string; firstName: string; middleName: string | null }) =>
  [e.lastName, e.firstName, e.middleName].filter(Boolean).join(' ');

function PeerEditor({ assignment, employeeId, onBack, onConfirmAndEvaluate }: { assignment: Assignment; employeeId: string; onBack: () => void; onConfirmAndEvaluate: () => void }) {
  const toast = useToast();
  const [peers, setPeers] = useState<PeerRespondent[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setPeers(await listPeers(assignment.subjectId, employeeId)); } catch (e) { toast((e as Error).message); } finally { setLoading(false); }
  }, [assignment.subjectId, employeeId]);
  useEffect(() => { load(); }, [load]);

  const remove = async (rid: string) => {
    try { await removePeer(assignment.subjectId, rid, employeeId); load(); } catch (e) { toast((e as Error).message); }
  };

  // Утверждение делает PEER-назначения видимыми оценивающим. then: куда перейти после сохранения.
  const confirm = async (then: () => void) => {
    setSaving(true);
    try { await confirmPeers(assignment.subjectId, employeeId); then(); } catch (e) { toast((e as Error).message); } finally { setSaving(false); }
  };

  return (
    <div>
      <button className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }} onClick={onBack}><Icon name="chevron_left" size={14} /> Назад</button>
      <div className="card card-pad">
        <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <b>Оценивающие коллеги: {assignment.subject.name}</b>
            <div className="small muted">{assignment.cycle.name}</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => setAddOpen(true)}><Icon name="plus" size={13} /> Добавить коллегу</button>
        </div>
        {loading && <div className="muted small" style={{ marginTop: 12 }}>Загрузка...</div>}
        {!loading && peers.length === 0 && <div className="muted small" style={{ marginTop: 12 }}>Коллеги-оценивающие не назначены.</div>}
        {!loading && peers.map(p => (
          <div key={p.id} className="row-2" style={{ alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
            <div>
              <span>{p.name}</span>
              <span className={`pill ${ST_PILL[p.status]}`} style={{ marginLeft: 8 }}>{ST_LABEL[p.status]}</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => remove(p.id)}><Icon name="close" size={12} /></button>
          </div>
        ))}
        <div className="small muted" style={{ marginTop: 12 }}>После сохранения коллеги получат свои задания на оценку.</div>
        <div className="row-2" style={{ marginTop: 12 }}>
          <button className="btn btn-secondary" disabled={saving} onClick={() => confirm(() => { toast('Список коллег сохранён'); onBack(); })}>Сохранить</button>
          <button className="btn btn-primary" disabled={saving} onClick={() => confirm(onConfirmAndEvaluate)}>Перейти к оценке</button>
        </div>
      </div>
      {addOpen && <AddPeerModal subjectId={assignment.subjectId} employeeId={employeeId}
        existing={peers.map(p => p.evaluator.id)}
        onClose={() => setAddOpen(false)} onAdded={() => { setAddOpen(false); load(); toast('Коллега добавлен'); }} />}
    </div>
  );
}

function AddPeerModal({ subjectId, employeeId, existing, onClose, onAdded }: { subjectId: string; employeeId: string; existing: string[]; onClose: () => void; onAdded: () => void }) {
  const toast = useToast();
  const [all, setAll] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { getEmployees({ limit: 500 }).then(r => setAll(r.data)).catch(() => {}); }, []);

  const list = all.filter(e => !existing.includes(e.id) && e.id !== employeeId && (!search || fio(e).toLowerCase().includes(search.toLowerCase())));

  const select = async (id: string) => {
    setSaving(true);
    try { await addPeer(subjectId, { evaluatorId: id, employeeId }); onAdded(); } catch (e) { toast((e as Error).message); } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title="Добавить коллегу-оценивающего">
      <input className="inp" placeholder="Поиск..." value={search} onChange={e => setSearch(e.target.value)} autoFocus style={{ marginBottom: 12 }} />
      <div style={{ maxHeight: 300, overflowY: 'auto' }}>
        {list.map(e => (
          <div key={e.id} className="item-row" style={{ padding: 8, cursor: 'pointer', borderBottom: '1px solid var(--line)' }} onClick={() => !saving && select(e.id)}>
            {fio(e)} <span className="small muted">· {e.department?.name}</span>
          </div>
        ))}
        {list.length === 0 && <div className="muted small" style={{ padding: 12 }}>Нет подходящих сотрудников.</div>}
      </div>
    </Modal>
  );
}

function FillForm({ respondentId, employeeId, onBack }: { respondentId: string; employeeId: string; onBack: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState<AssignmentForm | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [open, setOpen] = useState({ strengths: '', toChange: '', toDevelop: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    get360Assignment(respondentId, employeeId).then(f => {
      setForm(f); setScores(f.scores);
      setOpen({ strengths: f.openAnswer.strengths || '', toChange: f.openAnswer.toChange || '', toDevelop: f.openAnswer.toDevelop || '' });
    }).catch(() => {});
  }, [respondentId, employeeId]);

  if (!form) return <div className="card card-pad muted">Загрузка...</div>;

  const allIndicators = form.competencies.flatMap(c => c.indicators);
  const answered = allIndicators.filter(i => scores[i.id] != null).length;
  const complete = answered === allIndicators.length;

  const save = async (submit: boolean) => {
    if (submit && !complete) { toast('Оцените все индикаторы перед отправкой'); return; }
    setSaving(true);
    try {
      await submit360Assignment(respondentId, {
        employeeId,
        scores: Object.entries(scores).map(([indicatorId, score]) => ({ indicatorId, score })),
        openAnswer: { strengths: open.strengths || null, toChange: open.toChange || null, toDevelop: open.toDevelop || null },
        submit,
      });
      toast(submit ? 'Оценка отправлена' : 'Черновик сохранён');
      if (submit) onBack();
    } catch (e) { toast((e as Error).message); } finally { setSaving(false); }
  };

  return (
    <div>
      <button className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }} onClick={onBack}><Icon name="chevron_left" size={14} /> Назад</button>
      <div className="card card-pad" style={{ marginBottom: 12 }}>
        <b style={{ fontSize: 16 }}>{form.subject.name === '' || form.role === 'SELF' ? 'Самооценка' : `Оценка: ${form.subject.name}`}</b>
        <div className="small muted">{form.cycle.name} · {form.roleLabel}</div>
        <div className="small muted" style={{ marginTop: 4 }}>Оценено {answered} из {allIndicators.length}</div>
      </div>

      <div className="stack-4">
        {form.competencies.map(c => (
          <div key={c.id} className="card card-pad">
            <b>{c.name}</b>{c.description && <div className="small muted">{c.description}</div>}
            <div className="stack-3" style={{ marginTop: 10 }}>
              {c.indicators.map(i => (
                <div key={i.id}>
                  <div style={{ marginBottom: 6 }}>{i.text}</div>
                  <div className="row-2" style={{ flexWrap: 'wrap', gap: 6 }}>
                    {form.scalePoints.map(p => (
                      <button key={p.value}
                        className={`btn btn-sm ${scores[i.id] === p.value ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setScores(s => ({ ...s, [i.id]: p.value }))}
                        title={p.label}>
                        {p.value}
                      </button>
                    ))}
                    <span className="small muted" style={{ alignSelf: 'center' }}>
                      {scores[i.id] != null ? form.scalePoints.find(p => p.value === scores[i.id])?.label : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="card card-pad stack-3">
          <div className="field"><label className="small">Сильные стороны</label><textarea className="ta" rows={2} value={open.strengths} onChange={e => setOpen(o => ({ ...o, strengths: e.target.value }))} /></div>
          <div className="field"><label className="small">Что стоит изменить</label><textarea className="ta" rows={2} value={open.toChange} onChange={e => setOpen(o => ({ ...o, toChange: e.target.value }))} /></div>
          <div className="field"><label className="small">Что развивать</label><textarea className="ta" rows={2} value={open.toDevelop} onChange={e => setOpen(o => ({ ...o, toDevelop: e.target.value }))} /></div>
        </div>

        <div className="row-2">
          <button className="btn btn-secondary" disabled={saving} onClick={() => save(false)}>Сохранить черновик</button>
          <button className="btn btn-primary" disabled={saving || !complete} onClick={() => save(true)}>Отправить оценку</button>
        </div>
      </div>
    </div>
  );
}

// ─── Мои результаты ────────────────────────────────────
const ROLE_LABEL: Record<EvaluatorRole, string> = { SELF: 'Самооценка', MANAGER: 'Руководитель', PEER: 'Коллеги', SUBORDINATE: 'Подчинённые' };
const ZONE_LABEL: Record<Exclude<EvalZone, null>, string> = { CONSENSUS: 'Согласие', BLIND_SPOT: 'Слепая зона', HIDDEN_POTENTIAL: 'Скрытый потенциал' };
const ZONE_PILL: Record<Exclude<EvalZone, null>, string> = { CONSENSUS: 'pill-green', BLIND_SPOT: 'pill-red', HIDDEN_POTENTIAL: 'pill-blue' };
const num = (n: number | null) => (n == null ? '—' : n.toFixed(2));

function groupByCategory<T extends { category: string }>(items: T[]): { cat: string; items: T[] }[] {
  const groups: { cat: string; items: T[] }[] = [];
  for (const it of items) {
    const key = it.category || '';
    let g = groups.find(x => x.cat === key);
    if (!g) { g = { cat: key, items: [] }; groups.push(g); }
    g.items.push(it);
  }
  return groups;
}

function MyResultsTab() {
  const { user } = useAuth();
  const employeeId = user?.id;
  const [items, setItems] = useState<MySubject360[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<{ cycleId: string; sid: string } | null>(null);

  useEffect(() => {
    if (!employeeId) return;
    get360MyResults(employeeId).then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, [employeeId]);

  if (open && employeeId) return <MyResultDetail cycleId={open.cycleId} sid={open.sid} employeeId={employeeId} onBack={() => setOpen(null)} />;
  if (loading) return <div className="card card-pad muted">Загрузка...</div>;
  if (items.length === 0) return <div className="card card-pad muted">Опубликованных результатов пока нет.</div>;

  return (
    <div className="stack-2">
      {items.map(m => (
        <div key={m.subjectId} className="card card-pad" style={{ cursor: 'pointer' }} onClick={() => setOpen({ cycleId: m.cycle.id, sid: m.subjectId })}>
          <div className="row-2" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <b>{m.cycle.name}</b>
            <span className="small muted">{m.publishedAt && new Date(m.publishedAt).toLocaleDateString('ru-RU')}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function MyResultDetail({ cycleId, sid, employeeId, onBack }: { cycleId: string; sid: string; employeeId: string; onBack: () => void }) {
  const [res, setRes] = useState<Results360 | null>(null);
  useEffect(() => { get360MyResult(cycleId, sid, employeeId).then(setRes).catch(() => {}); }, [cycleId, sid, employeeId]);
  if (!res) return <div className="card card-pad muted">Загрузка...</div>;

  return (
    <div>
      <button className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }} onClick={onBack}><Icon name="chevron_left" size={14} /> Назад</button>
      <div className="card card-pad">
        <table className="tbl">
          <thead><tr><th>Ценность/Компетенция</th><th>Само</th><th>Окруж.</th><th>Итоговая</th><th>Gap</th><th>Зона</th></tr></thead>
          <tbody>
            {groupByCategory(res.competencyResults).map(g => (
              <React.Fragment key={g.cat || '—'}>
                {g.cat && <tr><td colSpan={6} style={{ background: 'var(--gpc-gray-50)', fontWeight: 600 }}>{g.cat}</td></tr>}
                {g.items.map(c => (
                  <tr key={c.id}>
                    <td><b>{c.name}</b></td>
                    <td className="tabular">{num(c.self)}</td>
                    <td className="tabular">{num(c.othersAvg)}</td>
                    <td className="tabular"><b>{num(c.total)}</b></td>
                    <td className="tabular">{c.gap == null ? '—' : (c.gap > 0 ? '+' : '') + c.gap.toFixed(2)}</td>
                    <td>{c.zone && <span className={`pill ${ZONE_PILL[c.zone]}`}>{ZONE_LABEL[c.zone]}</span>}</td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        <div className="small muted" style={{ marginTop: 8 }}>Оценки коллег и подчинённых показаны обобщённо и анонимно.</div>
      </div>

      {res.conclusions.length > 0 && (
        <div className="card card-pad" style={{ marginTop: 12 }}>
          <b>Выводы и рекомендации HR</b>
          <div className="stack-2" style={{ marginTop: 8 }}>
            {res.conclusions.map(c => <div key={c.id} style={{ whiteSpace: 'pre-wrap' }}>{c.text}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}
