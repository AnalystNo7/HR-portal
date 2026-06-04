'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Icon, useToast } from '@/components/primitives';
import {
  get360Workflow, Workflow, get360Results, Results360,
  publish360, unpublish360, add360Conclusion, update360Conclusion, delete360Conclusion,
  RespondentStatus, EvalZone, EvaluatorRole,
} from '@/lib/api';

const ROLE_LABEL: Record<EvaluatorRole, string> = { SELF: 'Самооценка', MANAGER: 'Руководитель', PEER: 'Коллеги', SUBORDINATE: 'Подчинённые' };
const ZONE_LABEL: Record<Exclude<EvalZone, null>, string> = { CONSENSUS: 'Согласие', BLIND_SPOT: 'Слепая зона', HIDDEN_POTENTIAL: 'Скрытый потенциал' };
const ZONE_PILL: Record<Exclude<EvalZone, null>, string> = { CONSENSUS: 'pill-green', BLIND_SPOT: 'pill-red', HIDDEN_POTENTIAL: 'pill-blue' };
const ST_LABEL: Record<RespondentStatus, string> = { PENDING: 'ожидает', IN_PROGRESS: 'заполняет', COMPLETED: 'готово' };

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

export function SubjectPanel({ cycleId, subjectId, onChange }: { cycleId: string; subjectId: string; onChange: () => void }) {
  const toast = useToast();
  const [tab, setTab] = useState<'workflow' | 'results' | 'open' | 'conclusions'>('workflow');
  const [wf, setWf] = useState<Workflow | null>(null);
  const [res, setRes] = useState<Results360 | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const [w, r] = await Promise.all([get360Workflow(cycleId, subjectId), get360Results(cycleId, subjectId)]); setWf(w); setRes(r); }
    catch {} finally { setLoading(false); }
  }, [cycleId, subjectId]);
  useEffect(() => { load(); }, [load]);

  const doPublish = async () => {
    setBusy(true);
    try { await publish360(cycleId, subjectId); toast('Результаты опубликованы сотруднику'); load(); onChange(); }
    catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };
  const doUnpublish = async () => {
    setBusy(true);
    try { await unpublish360(cycleId, subjectId); toast('Публикация отменена'); load(); onChange(); }
    catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };

  if (loading || !wf || !res) return <div className="card card-pad muted">Загрузка...</div>;

  return (
    <div className="card card-pad">
      <div className="row-2" style={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <b style={{ fontSize: 16 }}>{wf.subject.name}</b>
        {wf.published
          ? <button className="btn btn-secondary btn-sm" disabled={busy} onClick={doUnpublish}>Отменить публикацию</button>
          : <button className="btn btn-primary btn-sm" disabled={busy} onClick={doPublish}>Опубликовать сотруднику</button>}
      </div>

      <div className="tabs" style={{ margin: '12px 0' }}>
        <button aria-selected={tab === 'workflow'} onClick={() => setTab('workflow')}>Воркфлоу</button>
        <button aria-selected={tab === 'results'} onClick={() => setTab('results')}>Результаты</button>
        <button aria-selected={tab === 'open'} onClick={() => setTab('open')}>Открытые ответы</button>
        <button aria-selected={tab === 'conclusions'} onClick={() => setTab('conclusions')}>Выводы HR</button>
      </div>

      {tab === 'workflow' && <WorkflowView wf={wf} />}
      {tab === 'results' && <ResultsView res={res} />}
      {tab === 'open' && <OpenAnswersView res={res} />}
      {tab === 'conclusions' && <ConclusionsView cycleId={cycleId} subjectId={subjectId} res={res} reload={load} />}
    </div>
  );
}

function WorkflowView({ wf }: { wf: Workflow }) {
  return (
    <div>
      <div className="wf-flow">
        <span className="node active">Оценка запущена</span>
        <span className="arrow">→</span>
        <span className={`node ${wf.stage !== 'DRAFT' ? 'active' : ''}`}>Параллельная оценка</span>
        <span className="arrow">→</span>
        <span className={`node ${wf.stage === 'RESULTS' ? 'active' : ''}`}>Обработка</span>
        <span className="arrow">→</span>
        <span className={`node ${wf.published ? 'active' : ''}`}>Оценка завершена</span>
      </div>
      <div className="wf-lanes">
        {wf.lanes.filter(l => l.total > 0).map(lane => (
          <div key={lane.role} className={`wf-lane ${lane.done ? 'done' : ''}`}>
            <div className="wf-lane-head"><b>{lane.label}</b><span className="small muted">{lane.completed}/{lane.total}</span></div>
            {lane.items.map(it => (
              <div key={it.id} className="wf-person">
                <span>{it.name}</span>
                <span className="row-2" style={{ alignItems: 'center', gap: 6 }}><span className={`wf-dot ${it.status}`} /><span className="small muted">{ST_LABEL[it.status]}</span></span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultsView({ res }: { res: Results360 }) {
  return (
    <div>
      <div className="card-pad" style={{ background: 'var(--gpc-gray-50)', borderRadius: 8, marginBottom: 12 }}>
        <div className="row-4" style={{ flexWrap: 'wrap' }}>
          <div><div className="small muted">Самооценка (ср.)</div><b style={{ fontSize: 20 }}>{num(res.overall.selfAvg)}</b></div>
          <div><div className="small muted">Оценка окружения (ср.)</div><b style={{ fontSize: 20 }}>{num(res.overall.othersAvg)}</b></div>
          <div><div className="small muted">Расхождение (gap)</div><b style={{ fontSize: 20 }}>{res.overall.gap == null ? '—' : (res.overall.gap > 0 ? '+' : '') + res.overall.gap.toFixed(2)}</b></div>
        </div>
      </div>
      <table className="tbl">
        <thead><tr><th>Ценность/Компетенция</th><th>Само</th><th>Рук.</th><th>Колл.</th><th>Подч.</th><th>Итоговая</th><th>Gap</th><th>Зона</th></tr></thead>
        <tbody>
          {groupByCategory(res.competencyResults).map(g => (
            <React.Fragment key={g.cat || '—'}>
              {g.cat && <tr><td colSpan={8} style={{ background: 'var(--gpc-gray-50)', fontWeight: 600 }}>{g.cat}</td></tr>}
              {g.items.map(c => (
                <tr key={c.id}>
                  <td><b>{c.name}</b></td>
                  <td className="tabular">{num(c.self)}</td>
                  <td className="tabular">{num(c.manager)}</td>
                  <td className="tabular">{num(c.peers)}</td>
                  <td className="tabular">{num(c.subordinates)}</td>
                  <td className="tabular"><b>{num(c.total)}</b></td>
                  <td className="tabular">{c.gap == null ? '—' : (c.gap > 0 ? '+' : '') + c.gap.toFixed(2)}</td>
                  <td>{c.zone && <span className={`pill ${ZONE_PILL[c.zone]}`}>{ZONE_LABEL[c.zone]}</span>}</td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
      <div className="small muted" style={{ marginTop: 8 }}>Шкала: {res.scalePoints.map(p => `${p.value} — ${p.label}`).join(' · ')}</div>
    </div>
  );
}

function OpenAnswersView({ res }: { res: Results360 }) {
  const blocks = [
    { key: 'strengths' as const, title: 'Сильные стороны' },
    { key: 'toChange' as const, title: 'Что стоит изменить' },
    { key: 'toDevelop' as const, title: 'Что развивать' },
  ];
  return (
    <div className="stack-4">
      {blocks.map(b => (
        <div key={b.key}>
          <b>{b.title}</b>
          <div className="stack-2" style={{ marginTop: 6 }}>
            {res.openAnswers.flatMap(g => g.items.filter(i => i[b.key]).map((i, idx) => (
              <div key={g.role + idx} className="item-row" style={{ padding: 8, border: '1px solid var(--line)', borderRadius: 6 }}>
                <div className="small muted">{ROLE_LABEL[g.role]}{i.author ? ` · ${i.author}` : ' · аноним'}</div>
                <div>{i[b.key]}</div>
              </div>
            )))}
            {res.openAnswers.every(g => g.items.every(i => !i[b.key])) && <div className="small muted">Нет ответов</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function ConclusionsView({ cycleId, subjectId, res, reload }: { cycleId: string; subjectId: string; res: Results360; reload: () => void }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const add = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try { await add360Conclusion(cycleId, subjectId, text.trim()); setText(''); toast('Вывод сохранён'); reload(); }
    finally { setSaving(false); }
  };
  const saveEdit = async () => {
    if (!editId) return;
    await update360Conclusion(editId, editText.trim()); setEditId(null); reload();
  };
  const remove = async (id: string) => { await delete360Conclusion(id); reload(); };

  return (
    <div className="stack-3">
      {res.conclusions.map(c => (
        <div key={c.id} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 12 }}>
          {editId === c.id ? (
            <div className="stack-2">
              <textarea className="ta" value={editText} onChange={e => setEditText(e.target.value)} rows={3} />
              <div className="row-2"><button className="btn btn-primary btn-sm" onClick={saveEdit}>Сохранить</button><button className="btn btn-secondary btn-sm" onClick={() => setEditId(null)}>Отмена</button></div>
            </div>
          ) : (
            <>
              <div style={{ whiteSpace: 'pre-wrap' }}>{c.text}</div>
              <div className="row-2" style={{ marginTop: 6, justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="small muted">{c.author || ''} · {new Date(c.createdAt).toLocaleDateString('ru-RU')}</span>
                <span className="row-2">
                  <button className="btn btn-ghost btn-sm" onClick={() => { setEditId(c.id); setEditText(c.text); }}><Icon name="edit" size={13} /></button>
                  <button className="btn btn-ghost btn-sm" onClick={() => remove(c.id)}><Icon name="trash" size={13} /></button>
                </span>
              </div>
            </>
          )}
        </div>
      ))}
      <div className="field">
        <label className="small">Новый вывод / рекомендация</label>
        <textarea className="ta" value={text} onChange={e => setText(e.target.value)} rows={3} placeholder="Например: сильные лидерские качества, рекомендуется развивать делегирование..." />
        <div style={{ marginTop: 8 }}><button className="btn btn-primary btn-sm" onClick={add} disabled={saving}>{saving ? 'Сохранение...' : 'Добавить вывод'}</button></div>
      </div>
    </div>
  );
}
