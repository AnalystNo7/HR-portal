'use client';

import React from 'react';
import { Icon } from '@/components/primitives';
import type {
  DeltaKind, Results360, Report360Sections, ReportGroupPair,
  ReportNarrativeItem, ReportPairFinding, ReportZoneItem,
} from '@/lib/api';
import { RadarChart } from './RadarChart';
import { ROLE_LABEL, SCALE, SERIES, groupByCategory, scaleColor } from './helpers';

const KIND_LABEL: Record<DeltaKind, string> = {
  CONSENSUS: 'Зона консенсуса',
  BLIND_SPOT: 'Слепая зона',
  HIDDEN_POTENTIAL: 'Скрытый потенциал',
};
const KIND_PILL: Record<DeltaKind, string> = {
  CONSENSUS: 'pill-green',
  BLIND_SPOT: 'pill-red',
  HIDDEN_POTENTIAL: 'pill-blue',
};

const fmt = (n: number | null, digits = 1) => (n == null ? '—' : n.toFixed(digits));
const signed = (n: number | null) => (n == null ? '—' : (n > 0 ? '+' : '') + n.toFixed(1));

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <b style={{ fontSize: 16 }}>{title}</b>
      {subtitle && <div className="small muted">{subtitle}</div>}
    </div>
  );
}

// ─── 1. Сводная таблица с цветовой индикацией ─────────────────

function SummaryTable({ res }: { res: Results360 }) {
  const cell = (v: number | null, bold = false) => (
    <td className="tabular" style={{ color: scaleColor(v), fontWeight: bold ? 700 : 600 }}>{fmt(v)}</td>
  );
  return (
    <div className="card card-pad">
      <SectionTitle title="Сводная таблица оценки" subtitle="Средний балл по каждой компетенции в разрезе групп респондентов" />
      <table className="tbl">
        <thead>
          <tr><th>Ценности / компетенции</th><th>Самооценка</th><th>Руководитель</th><th>Коллеги</th><th>Подчинённые</th><th>Итоговая (средняя)</th></tr>
        </thead>
        <tbody>
          {groupByCategory(res.competencyResults).map(g => (
            <React.Fragment key={g.cat || '—'}>
              {g.cat && <tr><td colSpan={6} style={{ background: 'var(--gpc-gray-50)', fontWeight: 600 }}>{g.cat}</td></tr>}
              {g.items.map(c => (
                <tr key={c.id}>
                  <td><b>{c.name}</b></td>
                  {cell(c.self)}
                  {cell(c.manager)}
                  {cell(c.peers)}
                  {cell(c.subordinates)}
                  {cell(c.total, true)}
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
      <div className="row-2" style={{ gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
        {SCALE.map(s => (
          <span key={s.label} className="row-2" style={{ alignItems: 'center', gap: 6 }}>
            <span className={`pill ${s.cls}`}>{s.label}</span>
            <span className="small muted">{s.desc}</span>
          </span>
        ))}
      </div>
      <div className="small muted" style={{ marginTop: 6 }}>
        Шкала: {res.scalePoints.map(p => `${p.value} — ${p.label}`).join(' · ')}
      </div>
    </div>
  );
}

// ─── 2. Открытые ответы ───────────────────────────────────────

function OpenAnswersSection({ res }: { res: Results360 }) {
  const blocks = [
    { key: 'strengths' as const, title: 'Сильные стороны', subtitle: 'отмеченные в открытых вопросах' },
    { key: 'toChange' as const, title: 'Что нужно изменить', subtitle: 'чтобы повысить эффективность' },
    { key: 'toDevelop' as const, title: 'Что нужно развивать в первую очередь', subtitle: 'комментарии из открытых вопросов' },
  ];
  return (
    <div className="stack-3">
      {blocks.map(b => {
        const items = res.openAnswers.flatMap(g =>
          g.items.filter(i => i[b.key]).map((i, idx) => ({ key: g.role + idx, role: g.role, text: i[b.key]! })),
        );
        return (
          <div key={b.key} className="card card-pad">
            <SectionTitle title={b.title} subtitle={b.subtitle} />
            {items.length === 0 && <div className="small muted">Нет ответов</div>}
            <ul style={{ margin: 0, paddingLeft: 18 }} className="stack-2">
              {items.map(i => (
                <li key={i.key}>
                  {i.text} <span className="small muted">— {ROLE_LABEL[i.role]}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

// ─── 3. Диаграммы (как в PDF: сводная + 3 парных) ─────────────

function ChartsSection({ res }: { res: Results360 }) {
  const vals = res.scalePoints.map(p => p.value);
  const min = vals.length ? Math.min(...vals) : 0;
  const max = vals.length ? Math.max(...vals) : 4;
  const axes = res.competencyResults.map(c => ({ label: c.name, value: c.total }));

  const series = (keys: ('self' | 'manager' | 'peers' | 'subordinates')[]) =>
    SERIES.filter(s => keys.includes(s.key as any))
      .filter(s => res.competencyResults.some(c => c[s.key] != null))
      .map(s => ({ label: s.label, color: s.color, values: res.competencyResults.map(c => c[s.key]) }));

  const pairs: { title: string; keys: ('self' | 'manager' | 'peers' | 'subordinates')[] }[] = [
    { title: 'Сравнение самооценки и оценки руководителя', keys: ['self', 'manager'] },
    { title: 'Сравнение самооценки и оценки коллег', keys: ['self', 'peers'] },
    { title: 'Сравнение самооценки и оценки подчинённых', keys: ['self', 'subordinates'] },
  ];

  const legend = (ss: { label: string; color: string }[]) => (
    <div className="row-2" style={{ gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
      {ss.map(s => (
        <span key={s.label} className="row-2" style={{ alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: s.color, flex: '0 0 12px' }} />
          <span className="small">{s.label}</span>
        </span>
      ))}
    </div>
  );

  const overview = series(['self', 'manager', 'peers', 'subordinates']);
  return (
    <div className="stack-3">
      <div className="card card-pad">
        <SectionTitle title="Диаграмма сравнительных оценок" subtitle="по всем категориям респондентов" />
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <RadarChart axes={axes} series={overview} min={min} max={max} showValues />
        </div>
        {legend(overview)}
      </div>
      <div className="row-2" style={{ gap: 16, flexWrap: 'wrap', alignItems: 'stretch' }}>
        {pairs.map(p => {
          const ss = series(p.keys);
          if (ss.length < 2) return null; // нет данных второй группы — парная диаграмма не информативна
          return (
            <div key={p.title} className="card card-pad" style={{ flex: '1 1 0', minWidth: 340 }}>
              <SectionTitle title={p.title} />
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <RadarChart axes={axes} series={ss} min={min} max={max} size={420} showValues />
              </div>
              {legend(ss)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 4. Интерпретация (LLM + правка HR) ───────────────────────

interface EditCtx {
  editable: boolean;
  update: (patch: (s: Report360Sections) => Report360Sections) => void;
}

function Text({ value, onChange, ctx, rows = 3, placeholder }: {
  value: string; onChange: (v: string) => void; ctx: EditCtx; rows?: number; placeholder?: string;
}) {
  if (!ctx.editable) return value ? <div style={{ whiteSpace: 'pre-wrap' }}>{value}</div> : null;
  return <textarea className="ta" rows={rows} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />;
}

function NarrativeSection({ sec, listKey, title, subtitle, ctx }: {
  sec: Report360Sections; listKey: 'strengths' | 'developmentAreas'; title: string; subtitle: string; ctx: EditCtx;
}) {
  const items = sec[listKey];
  if (!ctx.editable && items.length === 0) return null;
  const set = (fn: (items: ReportNarrativeItem[]) => ReportNarrativeItem[]) =>
    ctx.update(s => ({ ...s, [listKey]: fn(s[listKey]) }));
  return (
    <div className="card card-pad">
      <SectionTitle title={title} subtitle={subtitle} />
      <div className="stack-3">
        {items.map((it, i) => (
          <div key={i} style={{ borderLeft: '3px solid var(--line)', paddingLeft: 10 }}>
            {ctx.editable ? (
              <div className="stack-2">
                <div className="row-2" style={{ alignItems: 'center' }}>
                  <input className="inp" value={it.competency} placeholder="Компетенция"
                    onChange={e => set(list => list.map((x, j) => j === i ? { ...x, competency: e.target.value } : x))} />
                  <button className="btn btn-ghost btn-sm" title="Удалить"
                    onClick={() => set(list => list.filter((_, j) => j !== i))}><Icon name="trash" size={13} /></button>
                </div>
                <Text ctx={ctx} value={it.text} placeholder="Интерпретация с цифрами и опорой на комментарии"
                  onChange={v => set(list => list.map((x, j) => j === i ? { ...x, text: v } : x))} />
              </div>
            ) : (
              <>
                <b>{it.competency}.</b>{' '}
                <span style={{ whiteSpace: 'pre-wrap' }}>{it.text}</span>
              </>
            )}
          </div>
        ))}
        {ctx.editable && (
          <button className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }}
            onClick={() => set(list => [...list, { competency: '', text: '' }])}>+ Добавить</button>
        )}
      </div>
    </div>
  );
}

function ZoneSection({ sec, listKey, title, subtitle, ctx }: {
  sec: Report360Sections; listKey: 'blindSpots' | 'hiddenPotential'; title: string; subtitle: string; ctx: EditCtx;
}) {
  const items = sec[listKey];
  if (!ctx.editable && items.length === 0) return null;
  const set = (fn: (items: ReportZoneItem[]) => ReportZoneItem[]) =>
    ctx.update(s => ({ ...s, [listKey]: fn(s[listKey]) }));
  const patch = (i: number, p: Partial<ReportZoneItem>) => set(list => list.map((x, j) => j === i ? { ...x, ...p } : x));
  return (
    <div className="card card-pad">
      <SectionTitle title={title} subtitle={subtitle} />
      <div className="stack-3">
        {items.length === 0 && !ctx.editable ? null : items.map((it, i) => (
          <div key={i} style={{ borderLeft: '3px solid var(--line)', paddingLeft: 10 }}>
            <div className="row-2" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              {ctx.editable
                ? <input className="inp" style={{ maxWidth: 320 }} value={it.competency} placeholder="Компетенция" onChange={e => patch(i, { competency: e.target.value })} />
                : <b>{it.competency}</b>}
              <span className="small muted">
                Самооценка {fmt(it.selfScore)} · Окружение {fmt(it.othersScore)} · Δ {signed(it.delta)}
              </span>
              {ctx.editable && (
                <button className="btn btn-ghost btn-sm" title="Удалить" onClick={() => set(list => list.filter((_, j) => j !== i))}><Icon name="trash" size={13} /></button>
              )}
            </div>
            <div className="stack-2" style={{ marginTop: 6 }}>
              <Text ctx={ctx} value={it.text} placeholder="Разбор с цифрами и комментариями" onChange={v => patch(i, { text: v })} />
              {ctx.editable
                ? <Text ctx={ctx} rows={2} value={it.conclusion} placeholder="Вывод" onChange={v => patch(i, { conclusion: v })} />
                : it.conclusion && <div style={{ whiteSpace: 'pre-wrap' }}><b>Вывод: </b>{it.conclusion}</div>}
            </div>
          </div>
        ))}
        {!ctx.editable && items.length === 0 && <div className="small muted">Не выявлены</div>}
        {ctx.editable && (
          <button className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }}
            onClick={() => set(list => [...list, { competency: '', selfScore: null, othersScore: null, delta: null, text: '', conclusion: '' }])}>+ Добавить</button>
        )}
      </div>
    </div>
  );
}

function GroupComparisonSection({ sec, ctx }: { sec: Report360Sections; ctx: EditCtx }) {
  const hasContent = sec.groupComparison.some(p => p.items.length > 0);
  if (!ctx.editable && !hasContent) return null;
  const setPair = (pi: number, fn: (items: ReportPairFinding[]) => ReportPairFinding[]) =>
    ctx.update(s => ({
      ...s,
      groupComparison: s.groupComparison.map((p, j): ReportGroupPair => j === pi ? { ...p, items: fn(p.items) } : p),
    }));
  return (
    <div className="card card-pad">
      <SectionTitle title="Сравнение по группам респондентов" subtitle="зоны консенсуса, слепые зоны и скрытый потенциал по каждой паре" />
      <div className="stack-4">
        {sec.groupComparison.map((pair, pi) => {
          if (!ctx.editable && pair.items.length === 0) return null;
          return (
            <div key={pair.pair}>
              <b>{pair.title}</b>
              <div className="stack-3" style={{ marginTop: 8 }}>
                {pair.items.map((it, i) => (
                  <div key={i} style={{ borderLeft: '3px solid var(--line)', paddingLeft: 10 }}>
                    <div className="row-2" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      {ctx.editable ? (
                        <select className="inp" style={{ maxWidth: 190 }} value={it.kind}
                          onChange={e => setPair(pi, list => list.map((x, j) => j === i ? { ...x, kind: e.target.value as DeltaKind } : x))}>
                          {(Object.keys(KIND_LABEL) as DeltaKind[]).map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                        </select>
                      ) : (
                        <span className={`pill ${KIND_PILL[it.kind]}`}>{KIND_LABEL[it.kind]}</span>
                      )}
                      {ctx.editable
                        ? <input className="inp" style={{ maxWidth: 280 }} value={it.competency} placeholder="Компетенция"
                            onChange={e => setPair(pi, list => list.map((x, j) => j === i ? { ...x, competency: e.target.value } : x))} />
                        : <b>{it.competency}</b>}
                      <span className="small muted">Δ {signed(it.delta)}</span>
                      {ctx.editable && (
                        <button className="btn btn-ghost btn-sm" title="Удалить" onClick={() => setPair(pi, list => list.filter((_, j) => j !== i))}><Icon name="trash" size={13} /></button>
                      )}
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <Text ctx={ctx} rows={2} value={it.text} placeholder="Интерпретация"
                        onChange={v => setPair(pi, list => list.map((x, j) => j === i ? { ...x, text: v } : x))} />
                    </div>
                  </div>
                ))}
                {ctx.editable && (
                  <button className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }}
                    onClick={() => setPair(pi, list => [...list, { kind: 'CONSENSUS', competency: '', delta: null, text: '' }])}>+ Добавить</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecommendationsSection({ sec, ctx }: { sec: Report360Sections; ctx: EditCtx }) {
  const hasContent = sec.recommendations.some(t => t.title || t.subtopics.some(s => s.title || s.text));
  if (!ctx.editable && !hasContent) return null;
  const patchTheme = (ti: number, fn: (t: Report360Sections['recommendations'][number]) => Report360Sections['recommendations'][number]) =>
    ctx.update(s => ({ ...s, recommendations: s.recommendations.map((t, j) => j === ti ? fn(t) : t) }));
  return (
    <div className="card card-pad">
      <SectionTitle title="Рекомендации по развитию" subtitle="4 темы развития, по 4 подтемы в каждой" />
      <div className="stack-4">
        {sec.recommendations.map((theme, ti) => {
          if (!ctx.editable && !theme.title && theme.subtopics.every(s => !s.title && !s.text)) return null;
          return (
            <div key={ti}>
              {ctx.editable ? (
                <input className="inp" value={theme.title} placeholder={`Тема ${ti + 1}`}
                  onChange={e => patchTheme(ti, t => ({ ...t, title: e.target.value }))} />
              ) : (
                <b>{ti + 1}. {theme.title}</b>
              )}
              <div className="stack-2" style={{ marginTop: 8, paddingLeft: 14 }}>
                {theme.subtopics.map((sub, si) => (
                  <div key={si}>
                    {ctx.editable ? (
                      <div className="stack-2">
                        <input className="inp" value={sub.title} placeholder={`Подтема ${si + 1}`}
                          onChange={e => patchTheme(ti, t => ({ ...t, subtopics: t.subtopics.map((x, j) => j === si ? { ...x, title: e.target.value } : x) }))} />
                        <Text ctx={ctx} rows={2} value={sub.text} placeholder="Что и как развивать"
                          onChange={v => patchTheme(ti, t => ({ ...t, subtopics: t.subtopics.map((x, j) => j === si ? { ...x, text: v } : x) }))} />
                      </div>
                    ) : (
                      (sub.title || sub.text) && (
                        <div>
                          <b>{sub.title}</b>{sub.title && sub.text ? ': ' : ''}
                          <span style={{ whiteSpace: 'pre-wrap' }}>{sub.text}</span>
                        </div>
                      )
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Отчёт целиком ────────────────────────────────────────────

export function Report360View({ res, sections, editable = false, onChange, header }: {
  res: Results360;
  /** Интерпретационная часть; null — показывается только автоматическая часть. */
  sections?: Report360Sections | null;
  editable?: boolean;
  onChange?: (s: Report360Sections) => void;
  /** Необязательный блок между таблицей и интерпретацией (управление отчётом у HR). */
  header?: React.ReactNode;
}) {
  const ctx: EditCtx = {
    editable: editable && !!sections && !!onChange,
    update: patch => { if (sections && onChange) onChange(patch(sections)); },
  };
  return (
    <div className="stack-3">
      <SummaryTable res={res} />
      <OpenAnswersSection res={res} />
      <ChartsSection res={res} />
      {header}
      {sections && (
        <>
          {(ctx.editable || sections.intro) && (
            <div className="card card-pad">
              <SectionTitle title="Резюме" />
              <Text ctx={ctx} value={sections.intro} placeholder="Краткое резюме итогов оценки"
                onChange={v => ctx.update(s => ({ ...s, intro: v }))} />
            </div>
          )}
          <NarrativeSection sec={sections} listKey="strengths" title="Сильные стороны" subtitle="по итогу совокупной оценки окружения" ctx={ctx} />
          <NarrativeSection sec={sections} listKey="developmentAreas" title="Зоны развития" subtitle="по итогу совокупной оценки окружения" ctx={ctx} />
          <ZoneSection sec={sections} listKey="blindSpots" title="Слепые зоны" subtitle="самооценка заметно выше оценки окружения (Δ ≥ 0.6)" ctx={ctx} />
          <ZoneSection sec={sections} listKey="hiddenPotential" title="Скрытые возможности" subtitle="самооценка заметно ниже оценки окружения (Δ ≥ 0.6)" ctx={ctx} />
          <GroupComparisonSection sec={sections} ctx={ctx} />
          <RecommendationsSection sec={sections} ctx={ctx} />
        </>
      )}
    </div>
  );
}
