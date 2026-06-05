'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Icon, Modal, useToast } from '@/components/primitives';
import {
  get360Workflow, Workflow, get360Results, Results360,
  publish360, unpublish360, add360Conclusion, update360Conclusion, delete360Conclusion,
  RespondentStatus, EvalZone, EvaluatorRole, CompetencyResult,
} from '@/lib/api';
import { RadarChart } from './RadarChart';

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
  const [tab, setTab] = useState<'workflow' | 'results' | 'dashboard' | 'conclusions'>('workflow');
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
        <button aria-selected={tab === 'dashboard'} onClick={() => setTab('dashboard')}>Дашборд</button>
        <button aria-selected={tab === 'conclusions'} onClick={() => setTab('conclusions')}>Выводы</button>
      </div>

      {tab === 'workflow' && <WorkflowView wf={wf} />}
      {tab === 'results' && <ResultsView res={res} />}
      {tab === 'dashboard' && <DashboardView res={res} />}
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
        <span className={`node ${wf.stage !== 'DRAFT' ? 'active' : ''}`}>Оценка</span>
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
      <div style={{ marginTop: 20 }}>
        <b style={{ fontSize: 15 }}>Открытые ответы</b>
        <div style={{ marginTop: 8 }}><OpenAnswersView res={res} /></div>
      </div>
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

type SeriesKey = 'total' | 'peers' | 'subordinates' | 'manager' | 'self';
const SERIES: { key: SeriesKey; label: string; color: string }[] = [
  { key: 'total', label: 'Итоговая (средняя)', color: 'var(--gpc-blue-800)' },
  { key: 'peers', label: 'Коллега', color: 'var(--gpc-cyan)' },
  { key: 'subordinates', label: 'Подчинённый', color: 'var(--gpc-peach)' },
  { key: 'manager', label: 'Руководитель', color: 'var(--gpc-blue)' },
  { key: 'self', label: 'Самооценка', color: 'var(--gpc-orange)' },
];
const SCALE = [
  { label: 'менее 2', cls: 'pill-red', desc: 'компетенция на этапе развития, требуется обучение и поддержка' },
  { label: '2,0 – 3,5', cls: 'pill-yellow', desc: 'в целом соответствует ожиданиям, есть потенциал для роста' },
  { label: 'более 3,5', cls: 'pill-green', desc: 'высокий уровень развития, лучшие практики' },
];

function scaleColor(v: number | null): string {
  if (v == null) return 'var(--gpc-gray-400)';
  if (v < 2) return 'var(--err)';
  if (v <= 3.5) return 'var(--warn)';
  return 'var(--ok-green)';
}

const catLabel = (cat: string) => cat === 'Управленческие компетенции' ? 'Компетенции' : (cat || 'Компетенции');

function DashboardView({ res }: { res: Results360 }) {
  const [active, setActive] = useState<Set<SeriesKey>>(new Set<SeriesKey>(['total']));
  const [expanded, setExpanded] = useState<number | null>(null);
  const toggle = (k: SeriesKey) => setActive(s => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  const vals = res.scalePoints.map(p => p.value);
  const min = vals.length ? Math.min(...vals) : 0;
  const max = vals.length ? Math.max(...vals) : 4;
  const hasData = (k: SeriesKey) => res.competencyResults.some(c => c[k] != null);
  const groups = groupByCategory(res.competencyResults);
  const avgTotal = (items: CompetencyResult[]) => {
    const ns = items.map(c => c.total).filter((v): v is number => v != null);
    return ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : null;
  };

  const renderChart = (g: { items: CompetencyResult[] }, size?: number, showValues?: boolean) => {
    const series = SERIES.filter(s => active.has(s.key)).map(s => ({
      label: s.label, color: s.color, values: g.items.map(c => c[s.key]),
    }));
    const axes = g.items.map(c => ({ label: c.name, value: c.total }));
    return <RadarChart axes={axes} series={series} min={min} max={max} size={size} showValues={showValues} />;
  };

  const picker = (
    <div className="card card-pad" style={{ flex: '0 0 auto' }}>
      <b>Оценка</b>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
        {SERIES.map(s => {
          const dis = !hasData(s.key);
          return (
            <label key={s.key} className="chk" style={{ opacity: dis ? 0.4 : 1 }}>
              <input type="checkbox" checked={active.has(s.key)} disabled={dis} onChange={() => toggle(s.key)} />
              <span style={{ width: 12, height: 12, borderRadius: 3, background: s.color, flex: '0 0 12px' }} />
              <span>{s.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );

  const scaleLegend = (
    <div className="card card-pad">
      <b>Шкала оценок</b>
      <div className="stack-2" style={{ marginTop: 10 }}>
        {SCALE.map(s => (
          <div key={s.label} className="row-2" style={{ alignItems: 'flex-start', gap: 8 }}>
            <span className={`pill ${s.cls}`} style={{ flex: '0 0 auto' }}>{s.label}</span>
            <span className="small muted">{s.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 16 }}>{picker}</div>

      <div className="row-2" style={{ gap: 16, flexWrap: 'wrap', alignItems: 'stretch' }}>
        {groups.map((g, idx) => {
          const grp = avgTotal(g.items);
          return (
            <div key={g.cat || '—'} className="card card-pad" style={{ flex: '1 1 0', minWidth: 340, position: 'relative' }}>
              <button className="btn btn-ghost btn-sm" style={{ position: 'absolute', top: 6, right: 6 }} onClick={() => setExpanded(idx)} title="Развернуть"><Icon name="expand" /></button>
              <div style={{ paddingRight: 56 }}>
                <b>{catLabel(g.cat)}</b>
                <div className="row-2" style={{ alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span className="small muted">Уровень развития группы</span>
                  <span className="pill" style={{ background: scaleColor(grp), color: '#fff' }}>{grp == null ? '—' : grp.toFixed(1)}</span>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
                {renderChart(g)}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 16, maxWidth: '50%' }}>{scaleLegend}</div>

      {expanded != null && (() => {
        const g = groups[expanded];
        return (
          <ChartZoomModal
            key={expanded}
            title={catLabel(g.cat)}
            grp={avgTotal(g.items)}
            picker={picker}
            scaleLegend={scaleLegend}
            renderChart={size => renderChart(g, size, true)}
            onClose={() => setExpanded(null)}
          />
        );
      })()}
    </div>
  );
}

function ChartZoomModal({ title, grp, picker, scaleLegend, renderChart, onClose }: {
  title: string; grp: number | null; picker: React.ReactNode; scaleLegend: React.ReactNode;
  renderChart: (size: number) => React.ReactNode; onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const clamp = (v: number) => Math.min(4, Math.max(1, v));
  const BASE = 520;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom(z => clamp(+(z + (e.deltaY < 0 ? 0.2 : -0.2)).toFixed(2)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <Modal open onClose={onClose} size="half" title={title}>
      <div className="row-2" style={{ gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div className="stack-3" style={{ flex: '0 0 240px', minWidth: 200 }}>
          {picker}
          <div className="card card-pad">
            <span className="row-2" style={{ alignItems: 'center', gap: 6 }}>
              <span className="small muted">Уровень развития группы</span>
              <span className="pill" style={{ background: scaleColor(grp), color: '#fff' }}>{grp == null ? '—' : grp.toFixed(1)}</span>
            </span>
          </div>
          {scaleLegend}
        </div>
        <div className="stack-2" style={{ alignItems: 'center', flex: '0 0 auto' }}>
          <span className="small muted">{zoom.toFixed(1)}×</span>
          <input
            type="range" min={1} max={4} step={0.1} value={zoom}
            onChange={e => setZoom(clamp(Number(e.target.value)))}
            style={{ writingMode: 'vertical-lr', direction: 'rtl', height: 240, WebkitAppearance: 'slider-vertical' as any }}
          />
        </div>
        <div ref={scrollRef} style={{ flex: '1 1 400px', overflow: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
          <div style={{ width: BASE * zoom, margin: '0 auto' }}>
            {renderChart(BASE * zoom)}
          </div>
        </div>
      </div>
    </Modal>
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
