'use client';

import React from 'react';
import { Icon } from '@/components/primitives';
import type {
  DeltaKind, GroupPairKey, Results360, Report360Sections, ReportGroupPair,
  ReportNarrativeItem, ReportPairFinding, ReportZoneItem,
} from '@/lib/api';
import { CategoryRadarCard } from './CategoryRadarCard';
import { SCALE, SERIES, SeriesKey, groupByCategory, scaleBg } from './helpers';

const KIND_LABEL: Record<DeltaKind, string> = {
  CONSENSUS: 'Зона консенсуса',
  BLIND_SPOT: 'Слепая зона',
  HIDDEN_POTENTIAL: 'Скрытый потенциал',
};

// Вводный текст титульной части — как в PDF-образце
const INTRO_LINES = [
  'Результаты сводной таблицы основаны на анонимных оценках ваших коллег, руководителей и подчинённых.',
  'Данные представлены в обобщённом виде.',
  'По каждой ценности и каждому поведенческому индикатору рассчитан средний балл.',
  'Если участник выбрал ответ «не может оценить / не наблюдал ситуаций для проявления поведения», то этот вопрос не учитывался при расчёте.',
  'Цветовая индикация оценки выполнена в соответствии с приведённой шкалой.',
];

const fmt1 = (n: number | null) => (n == null ? '—' : n.toFixed(1).replace('.', ','));
const deltaWord = (n: number | null) =>
  n == null ? '' : ` (расхождение ${Math.abs(n).toFixed(1).replace('.', ',')} балла)`;

/** Крупный центрированный заголовок раздела — как в PDF. */
function BigTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ textAlign: 'center', margin: '6px 0 16px' }}>
      <div style={{ fontFamily: 'var(--font-head)', fontSize: 24, fontWeight: 700, lineHeight: 1.25 }}>{title}</div>
      {subtitle && <div style={{ fontWeight: 600, marginTop: 4 }}>{subtitle}</div>}
    </div>
  );
}

function SeriesLegend({ series }: { series: { label: string; color: string }[] }) {
  return (
    <div className="row-2" style={{ gap: 14, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 10 }}>
      {series.map(s => (
        <span key={s.label} className="row-2" style={{ alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: s.color, flex: '0 0 12px' }} />
          <span className="small">{s.label}</span>
        </span>
      ))}
    </div>
  );
}

// ─── Титул + шкала оценок ─────────────────────────────────────

function TitleBlock({ res }: { res: Results360 }) {
  return (
    <div className="card card-pad">
      <div style={{ textAlign: 'center', margin: '10px 0 14px' }}>
        <div style={{ fontFamily: 'var(--font-head)', fontSize: 28, fontWeight: 700 }}>Результаты оценки 360</div>
        <div style={{ fontSize: 17, fontWeight: 600, marginTop: 8 }}>{res.subject.name}</div>
      </div>
      <div className="stack-2" style={{ maxWidth: 720, margin: '0 auto' }}>
        {INTRO_LINES.map((line, i) => <div key={i}>{line}</div>)}
      </div>
      <div style={{ maxWidth: 520, margin: '20px auto 6px' }}>
        <div style={{ textAlign: 'center', fontFamily: 'var(--font-head)', fontSize: 18, fontWeight: 700, borderBottom: '1px solid var(--line)', paddingBottom: 8, marginBottom: 12 }}>
          Шкала оценок
        </div>
        <div className="stack-3">
          {SCALE.map(s => (
            <div key={s.label} className="row-2" style={{ alignItems: 'flex-start', gap: 10 }}>
              <span className={`pill ${s.cls}`} style={{ flex: '0 0 auto' }}>{s.label}</span>
              <span className="small">{s.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Сводная таблица оценки ───────────────────────────────────

function SummaryTable({ res }: { res: Results360 }) {
  const cell = (v: number | null, bold = false) => (
    <td className="tabular" style={{ background: scaleBg(v), fontWeight: bold ? 700 : 600, textAlign: 'center' }}>
      {v == null ? '—' : v.toFixed(1).replace('.', ',')}
    </td>
  );
  return (
    <div className="card card-pad">
      <BigTitle title="Сводная таблица оценки" />
      <table className="tbl">
        <thead>
          <tr>
            <th style={{ width: 34 }} />
            <th>Ценности / компетенции</th>
            <th style={{ textAlign: 'center' }}>Самооценка</th>
            <th style={{ textAlign: 'center' }}>Руководитель</th>
            <th style={{ textAlign: 'center' }}>Коллеги</th>
            <th style={{ textAlign: 'center' }}>Подчиненные</th>
            <th style={{ textAlign: 'center' }}>Итоговая (средняя)</th>
          </tr>
        </thead>
        <tbody>
          {groupByCategory(res.competencyResults).map(g => (
            <React.Fragment key={g.cat || '—'}>
              {g.items.map((c, idx) => (
                <tr key={c.id}>
                  {idx === 0 && (
                    <td rowSpan={g.items.length} style={{
                      writingMode: 'vertical-rl', transform: 'rotate(180deg)', textAlign: 'center',
                      fontWeight: 600, background: 'var(--gpc-gray-50)', padding: '8px 4px',
                    }}>
                      {g.cat || 'Компетенции'}
                    </td>
                  )}
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
      <div className="small muted" style={{ marginTop: 8 }}>
        Шкала: {res.scalePoints.map(p => `${p.value} — ${p.label}`).join(' · ')}
      </div>
    </div>
  );
}

// ─── Открытые ответы (анонимно, без ролей) ────────────────────

function OpenAnswersSection({ res }: { res: Results360 }) {
  const blocks = [
    { key: 'strengths' as const, title: 'Сильные стороны', subtitle: 'отмеченные в открытых вопросах' },
    { key: 'toChange' as const, title: 'Что нужно изменить, чтобы повысить эффективность', subtitle: 'Комментарии из открытых вопросов' },
    { key: 'toDevelop' as const, title: 'Что нужно развивать в первую очередь', subtitle: 'Комментарии из открытых вопросов' },
  ];
  return (
    <div className="stack-3">
      {blocks.map(b => {
        const items = res.openAnswers.flatMap(g =>
          g.items.filter(i => i[b.key]).map((i, idx) => ({ key: g.role + idx, text: i[b.key]! })),
        );
        return (
          <div key={b.key} className="card card-pad">
            <BigTitle title={b.title} subtitle={b.subtitle} />
            {items.length === 0 && <div className="small muted" style={{ textAlign: 'center' }}>Нет ответов</div>}
            <ul style={{ margin: 0, paddingLeft: 22 }} className="stack-2">
              {items.map(i => <li key={i.key}>{i.text}</li>)}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

// ─── Диаграммы по категориям (стиль Дашборда) ─────────────────

function ChartBlock({ res, title, keys }: { res: Results360; title: string; keys: SeriesKey[] }) {
  const vals = res.scalePoints.map(p => p.value);
  const min = vals.length ? Math.min(...vals) : 0;
  const max = vals.length ? Math.max(...vals) : 4;
  const requested = SERIES.filter(s => keys.includes(s.key));
  const active = requested.filter(s => res.competencyResults.some(c => c[s.key] != null));
  const missing = requested.filter(s => !active.includes(s));
  const groups = groupByCategory(res.competencyResults);
  return (
    <div className="card card-pad">
      <BigTitle title={title} />
      <SeriesLegend series={active} />
      {missing.length > 0 && (
        <div className="small muted" style={{ textAlign: 'center', marginBottom: 10 }}>
          {missing.map(s => s.label).join(', ')}: нет завершённых оценок этой группы
        </div>
      )}
      {active.length === 0 ? (
        <div className="small muted" style={{ textAlign: 'center' }}>Нет данных для диаграммы</div>
      ) : (
        <div className="row-2" style={{ gap: 16, flexWrap: 'wrap', alignItems: 'stretch' }}>
          {groups.map(g => (
            <CategoryRadarCard
              key={g.cat || '—'}
              cat={g.cat}
              items={g.items}
              series={active.map(s => ({ label: s.label, color: s.color, values: g.items.map(c => c[s.key]) }))}
              min={min}
              max={max}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Интерпретация: общие примитивы редактирования ────────────

interface EditCtx {
  editable: boolean;
  update: (patch: (s: Report360Sections) => Report360Sections) => void;
}

function Text({ value, onChange, ctx, rows = 3, placeholder }: {
  value: string; onChange: (v: string) => void; ctx: EditCtx; rows?: number; placeholder?: string;
}) {
  if (!ctx.editable) return value ? <span style={{ whiteSpace: 'pre-wrap' }}>{value}</span> : null;
  return <textarea className="ta" rows={rows} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />;
}

// ─── Сильные стороны / Зоны развития (нарратив) ───────────────

function NarrativeSection({ sec, listKey, title, ctx }: {
  sec: Report360Sections; listKey: 'strengths' | 'developmentAreas'; title: string; ctx: EditCtx;
}) {
  const items = sec[listKey];
  if (!ctx.editable && items.length === 0) return null;
  const set = (fn: (items: ReportNarrativeItem[]) => ReportNarrativeItem[]) =>
    ctx.update(s => ({ ...s, [listKey]: fn(s[listKey]) }));
  return (
    <div className="card card-pad">
      <BigTitle title={title} subtitle="по итогу совокупной оценки окружения" />
      <div className="stack-4">
        {items.map((it, i) => (
          <div key={i}>
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
              <div>
                <b style={{ textDecoration: 'underline' }}>{it.competency}</b>
                {it.competency ? '. ' : ''}
                <span style={{ whiteSpace: 'pre-wrap' }}>{it.text}</span>
              </div>
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

// ─── Слепые зоны / Скрытые возможности ────────────────────────

function zoneScoreLine(it: ReportZoneItem): string {
  const parts: string[] = [];
  if (it.selfScore != null) parts.push(`Самооценка — ${fmt1(it.selfScore)}`);
  if (it.othersScore != null) parts.push(`оценка окружения — ${fmt1(it.othersScore)}`);
  let line = parts.join('; ');
  if (it.delta != null) line += `. Разница между самооценкой и оценкой окружения составляет ${Math.abs(it.delta).toFixed(1).replace('.', ',')} балла`;
  return line ? line + '.' : '';
}

function ZoneSection({ sec, listKey, title, ctx }: {
  sec: Report360Sections; listKey: 'blindSpots' | 'hiddenPotential'; title: string; ctx: EditCtx;
}) {
  const items = sec[listKey];
  if (!ctx.editable && items.length === 0) return null;
  const set = (fn: (items: ReportZoneItem[]) => ReportZoneItem[]) =>
    ctx.update(s => ({ ...s, [listKey]: fn(s[listKey]) }));
  const patch = (i: number, p: Partial<ReportZoneItem>) => set(list => list.map((x, j) => j === i ? { ...x, ...p } : x));
  return (
    <div className="card card-pad">
      <BigTitle title={title} subtitle="по итогу совокупной оценки окружения" />
      <div className="stack-4">
        {items.map((it, i) => (
          <div key={i}>
            {ctx.editable ? (
              <div className="stack-2">
                <div className="row-2" style={{ alignItems: 'center' }}>
                  <input className="inp" style={{ maxWidth: 360 }} value={it.competency} placeholder="Компетенция" onChange={e => patch(i, { competency: e.target.value })} />
                  <button className="btn btn-ghost btn-sm" title="Удалить" onClick={() => set(list => list.filter((_, j) => j !== i))}><Icon name="trash" size={13} /></button>
                </div>
                {zoneScoreLine(it) && <div className="small muted">Данные оценки: {zoneScoreLine(it)}</div>}
                <div className="field"><label className="small">Подтверждение из комментариев</label>
                  <Text ctx={ctx} value={it.text} placeholder="Опора на открытые ответы, без имён" onChange={v => patch(i, { text: v })} /></div>
                <div className="field"><label className="small">Вывод</label>
                  <Text ctx={ctx} rows={2} value={it.conclusion} placeholder="Вывод" onChange={v => patch(i, { conclusion: v })} /></div>
              </div>
            ) : (
              <div className="stack-2">
                <b style={{ textDecoration: 'underline' }}>{it.competency}</b>
                {zoneScoreLine(it) && <div><span style={{ textDecoration: 'underline' }}>Данные оценки:</span> {zoneScoreLine(it)}</div>}
                {it.text && <div><span style={{ textDecoration: 'underline' }}>Подтверждение из комментариев:</span> <span style={{ whiteSpace: 'pre-wrap' }}>{it.text}</span></div>}
                {it.conclusion && <div><b>Вывод:</b> <span style={{ whiteSpace: 'pre-wrap' }}>{it.conclusion}</span></div>}
              </div>
            )}
          </div>
        ))}
        {!ctx.editable && items.length === 0 && <div className="small muted" style={{ textAlign: 'center' }}>Не выявлены</div>}
        {ctx.editable && (
          <button className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }}
            onClick={() => set(list => [...list, { competency: '', selfScore: null, othersScore: null, delta: null, text: '', conclusion: '' }])}>+ Добавить</button>
        )}
      </div>
    </div>
  );
}

// ─── Пары групп: диаграмма + разбор ───────────────────────────

const PAIR_BLOCKS: {
  pair: GroupPairKey;
  chartTitle: string;
  genitive: string; // «руководителя» / «подчиненных» / «коллег»
  keys: SeriesKey[];
}[] = [
  { pair: 'SELF_MANAGER', chartTitle: 'Диаграмма сравнения самооценки и оценки руководителя', genitive: 'руководителя', keys: ['manager', 'self'] },
  { pair: 'SELF_SUBORDINATE', chartTitle: 'Диаграмма сравнения самооценки и оценки подчиненных', genitive: 'подчиненных', keys: ['subordinates', 'self'] },
  { pair: 'SELF_PEER', chartTitle: 'Диаграмма сравнения самооценки и оценки коллег', genitive: 'коллег', keys: ['peers', 'self'] },
];

const KIND_HEADING = (genitive: string): Record<DeltaKind, string> => ({
  CONSENSUS: 'Зоны консенсуса (оценки близки):',
  BLIND_SPOT: `Слепые зоны (самооценка выше оценки ${genitive}):`,
  HIDDEN_POTENTIAL: `Зоны скрытого потенциала (оценка ${genitive} выше самооценки):`,
});

function PairFindings({ pair, pairIndex, genitive, ctx }: {
  pair: ReportGroupPair; pairIndex: number; genitive: string; ctx: EditCtx;
}) {
  const setPair = (fn: (items: ReportPairFinding[]) => ReportPairFinding[]) =>
    ctx.update(s => ({
      ...s,
      groupComparison: s.groupComparison.map((p, j): ReportGroupPair => j === pairIndex ? { ...p, items: fn(p.items) } : p),
    }));
  const patch = (idx: number, p: Partial<ReportPairFinding>) =>
    setPair(list => list.map((x, j) => j === idx ? { ...x, ...p } : x));

  const entries = pair.items.map((it, idx) => ({ it, idx }));
  const kinds: DeltaKind[] = ['CONSENSUS', 'BLIND_SPOT', 'HIDDEN_POTENTIAL'];
  const headings = KIND_HEADING(genitive);
  if (!ctx.editable && pair.items.length === 0) return null;

  return (
    <div className="stack-4" style={{ marginTop: 14 }}>
      {kinds.map(kind => {
        const group = entries.filter(e => e.it.kind === kind);
        if (group.length === 0) return null;
        return (
          <div key={kind}>
            <b style={{ textDecoration: 'underline' }}>{headings[kind]}</b>
            <ul style={{ margin: '8px 0 0', paddingLeft: 22 }} className="stack-2">
              {group.map(({ it, idx }) => (
                <li key={idx}>
                  {ctx.editable ? (
                    <div className="stack-2">
                      <div className="row-2" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <select className="inp" style={{ maxWidth: 190 }} value={it.kind}
                          onChange={e => patch(idx, { kind: e.target.value as DeltaKind })}>
                          {kinds.map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                        </select>
                        <input className="inp" style={{ maxWidth: 280 }} value={it.competency} placeholder="Компетенция"
                          onChange={e => patch(idx, { competency: e.target.value })} />
                        <span className="small muted">{deltaWord(it.delta) || 'Δ —'}</span>
                        <button className="btn btn-ghost btn-sm" title="Удалить" onClick={() => setPair(list => list.filter((_, j) => j !== idx))}><Icon name="trash" size={13} /></button>
                      </div>
                      <Text ctx={ctx} rows={2} value={it.text} placeholder="Интерпретация" onChange={v => patch(idx, { text: v })} />
                    </div>
                  ) : (
                    <>
                      <b style={{ textDecoration: 'underline' }}>{it.competency}</b>
                      {deltaWord(it.delta)}
                      {it.competency || it.delta != null ? '. ' : ''}
                      <span style={{ whiteSpace: 'pre-wrap' }}>{it.text}</span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {ctx.editable && (
        <button className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }}
          onClick={() => setPair(list => [...list, { kind: 'CONSENSUS', competency: '', delta: null, text: '' }])}>+ Добавить</button>
      )}
    </div>
  );
}

// ─── Рекомендации по развитию ─────────────────────────────────

function RecommendationsSection({ sec, ctx }: { sec: Report360Sections; ctx: EditCtx }) {
  const hasContent = sec.recommendations.some(t => t.title || t.subtopics.some(s => s.title || s.text));
  if (!ctx.editable && !hasContent) return null;
  const patchTheme = (ti: number, fn: (t: Report360Sections['recommendations'][number]) => Report360Sections['recommendations'][number]) =>
    ctx.update(s => ({ ...s, recommendations: s.recommendations.map((t, j) => j === ti ? fn(t) : t) }));
  return (
    <div className="card card-pad">
      <BigTitle title="Рекомендации по развитию" />
      <div className="stack-4">
        {sec.recommendations.map((theme, ti) => {
          if (!ctx.editable && !theme.title && theme.subtopics.every(s => !s.title && !s.text)) return null;
          return (
            <div key={ti}>
              {ctx.editable ? (
                <input className="inp" value={theme.title} placeholder={`Тема ${ti + 1}`}
                  onChange={e => patchTheme(ti, t => ({ ...t, title: e.target.value }))} />
              ) : (
                <b style={{ textDecoration: 'underline' }}>{ti + 1}. {theme.title}</b>
              )}
              <div className="small" style={{ textDecoration: 'underline', margin: '6px 0 4px' }}>Подтемы:</div>
              {ctx.editable ? (
                <div className="stack-2" style={{ paddingLeft: 8 }}>
                  {theme.subtopics.map((sub, si) => (
                    <div key={si} className="stack-2">
                      <input className="inp" value={sub.title} placeholder={`Подтема ${si + 1}`}
                        onChange={e => patchTheme(ti, t => ({ ...t, subtopics: t.subtopics.map((x, j) => j === si ? { ...x, title: e.target.value } : x) }))} />
                      <Text ctx={ctx} rows={2} value={sub.text} placeholder="Что и как развивать"
                        onChange={v => patchTheme(ti, t => ({ ...t, subtopics: t.subtopics.map((x, j) => j === si ? { ...x, text: v } : x) }))} />
                    </div>
                  ))}
                </div>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 22 }} className="stack-2">
                  {theme.subtopics.filter(s => s.title || s.text).map((sub, si) => (
                    <li key={si}>
                      {sub.title}{sub.title && sub.text ? ': ' : ''}
                      <span style={{ whiteSpace: 'pre-wrap' }}>{sub.text}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Отчёт целиком (структура = PDF-образец) ──────────────────

export function Report360View({ res, sections, editable = false, onChange, header }: {
  res: Results360;
  /** Интерпретационная часть; null — показывается только автоматическая часть. */
  sections?: Report360Sections | null;
  editable?: boolean;
  onChange?: (s: Report360Sections) => void;
  /** Необязательный блок между автоматической частью и интерпретацией. */
  header?: React.ReactNode;
}) {
  const ctx: EditCtx = {
    editable: editable && !!sections && !!onChange,
    update: patch => { if (sections && onChange) onChange(patch(sections)); },
  };
  const pairIndex = (key: GroupPairKey) => sections?.groupComparison.findIndex(p => p.pair === key) ?? -1;

  return (
    <div className="stack-3 print-area">
      {/* 1–2. Титул, вводный текст, шкала оценок */}
      <TitleBlock res={res} />
      {/* 3. Сводная таблица */}
      <SummaryTable res={res} />
      {/* 4. Открытые ответы (анонимно) */}
      <OpenAnswersSection res={res} />
      {/* 5. Сводная диаграмма по всем группам */}
      <ChartBlock res={res} title="Диаграмма сравнительных оценок по всем категориям респондентов"
        keys={['self', 'manager', 'peers', 'subordinates']} />
      {header}
      {/* 6. Интерпретация по итогам оценки окружения (только при наличии отчёта) */}
      {sections && (
        <>
          <NarrativeSection sec={sections} listKey="strengths" title="Сильные стороны" ctx={ctx} />
          <NarrativeSection sec={sections} listKey="developmentAreas" title="Зоны развития" ctx={ctx} />
          <ZoneSection sec={sections} listKey="blindSpots" title="Слепые зоны" ctx={ctx} />
          <ZoneSection sec={sections} listKey="hiddenPotential" title="Скрытые возможности" ctx={ctx} />
        </>
      )}
      {/* 7. Пары групп: диаграммы — всегда (автоматическая часть), разбор — при наличии отчёта */}
      {PAIR_BLOCKS.map(block => {
        const idx = pairIndex(block.pair);
        const pair = sections && idx >= 0 ? sections.groupComparison[idx] : null;
        const hasFindings = !!pair && (ctx.editable || pair.items.length > 0);
        return (
          <React.Fragment key={block.pair}>
            <ChartBlock res={res} title={block.chartTitle} keys={block.keys} />
            {hasFindings && pair && (
              <div className="card card-pad">
                <PairFindings pair={pair} pairIndex={idx} genitive={block.genitive} ctx={ctx} />
              </div>
            )}
          </React.Fragment>
        );
      })}
      {/* 8. Рекомендации */}
      {sections && <RecommendationsSection sec={sections} ctx={ctx} />}
    </div>
  );
}
