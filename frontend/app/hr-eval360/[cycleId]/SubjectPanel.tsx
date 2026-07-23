'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Icon, Modal } from '@/components/primitives';
import {
  get360Workflow, Workflow, get360Results, Results360,
  RespondentStatus, CompetencyResult,
} from '@/lib/api';
import {
  RadarChart, ROLE_LABEL, ZONE_LABEL, ZONE_PILL, SCALE, SERIES, SeriesKey,
  groupByCategory, num, scaleColor, catLabel,
} from '@/components/eval360';
import { ReportView } from './ReportView';

const ST_LABEL: Record<RespondentStatus, string> = { PENDING: 'ожидает', IN_PROGRESS: 'заполняет', COMPLETED: 'готово' };

export type SubjectPanelTab = 'workflow' | 'results' | 'dashboard' | 'report';

export function SubjectPanel({ cycleId, subjectId, onChange, onTabChange }: {
  cycleId: string;
  subjectId: string;
  onChange: () => void;
  /** Уведомляет страницу о текущей вкладке (кнопки редактирования запуска видны только на «Воркфлоу»). */
  onTabChange?: (tab: SubjectPanelTab) => void;
}) {
  const [tab, setTabState] = useState<SubjectPanelTab>('workflow');
  const setTab = (t: SubjectPanelTab) => { setTabState(t); onTabChange?.(t); };
  useEffect(() => { onTabChange?.(tab); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [wf, setWf] = useState<Workflow | null>(null);
  const [res, setRes] = useState<Results360 | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { const [w, r] = await Promise.all([get360Workflow(cycleId, subjectId), get360Results(cycleId, subjectId)]); setWf(w); setRes(r); }
    catch {} finally { setLoading(false); }
  }, [cycleId, subjectId]);
  useEffect(() => { load(); }, [load]);

  if (loading || !wf || !res) return <div className="card card-pad muted">Загрузка...</div>;

  return (
    <div className="card card-pad">
      <div className="row-2" style={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <b style={{ fontSize: 16 }}>{wf.subject.name}</b>
        {wf.published && <span className="pill pill-green">Опубликовано сотруднику</span>}
      </div>

      <div className="tabs" style={{ margin: '12px 0' }}>
        <button aria-selected={tab === 'workflow'} onClick={() => setTab('workflow')}>Воркфлоу</button>
        <button aria-selected={tab === 'results'} onClick={() => setTab('results')}>Результаты</button>
        <button aria-selected={tab === 'dashboard'} onClick={() => setTab('dashboard')}>Дашборд</button>
        <button aria-selected={tab === 'report'} onClick={() => setTab('report')}>Отчёт</button>
      </div>

      {tab === 'workflow' && <WorkflowView wf={wf} />}
      {tab === 'results' && <ResultsView res={res} />}
      {tab === 'dashboard' && <DashboardView res={res} />}
      {tab === 'report' && <ReportView cycleId={cycleId} subjectId={subjectId} res={res} onPublished={() => { load(); onChange(); }} />}
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
  const BASE = 600;

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

