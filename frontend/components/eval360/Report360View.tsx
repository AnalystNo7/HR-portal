'use client';

import React, { useEffect, useState } from 'react';
import { Icon } from '@/components/primitives';
import type {
  DeltaKind, GroupPairKey, Results360, Report360Sections, ReportGroupPair,
  ReportNarrativeItem, ReportOpenAnswers, ReportPairFinding, ReportZoneItem,
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

// ─── Поблочное редактирование ────────────────────────────────

interface EditCtx {
  /** HR может редактировать (у сотрудника и при печати — false). */
  canEdit: boolean;
  editingBlock: string | null;
  isEditing: (key: string) => boolean;
  startEdit: (key: string) => void;
  commit: () => void;
  cancel: () => void;
  update: (patch: (s: Report360Sections) => Report360Sections) => void;
}

/** Карандаш / «Готово»+«Отмена» в правом верхнем углу карточки блока. */
function BlockControls({ k, ctx }: { k: string; ctx: EditCtx }) {
  if (!ctx.canEdit) return null;
  if (ctx.isEditing(k)) {
    return (
      <span style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6 }}>
        <button className="btn btn-primary btn-sm" onClick={ctx.commit}>Готово</button>
        <button className="btn btn-secondary btn-sm" onClick={ctx.cancel}>Отмена</button>
      </span>
    );
  }
  return (
    <button
      className="btn btn-ghost btn-sm"
      title="Редактировать"
      style={{ position: 'absolute', top: 8, right: 8, opacity: ctx.editingBlock != null ? 0.35 : 1 }}
      disabled={ctx.editingBlock != null}
      onClick={() => ctx.startEdit(k)}
    >
      <Icon name="edit" size={14} />
    </button>
  );
}

const EMPTY_HINT = 'Раздел не заполнен — нажмите значок карандаша, чтобы добавить описание.';

function EmptyHint() {
  return <div className="small muted" style={{ textAlign: 'center' }}>{EMPTY_HINT}</div>;
}

// ─── Титул + шкала оценок (не редактируется) ─────────────────

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

// ─── Сводная таблица оценки (не редактируется) ───────────────

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

// ─── Открытые ответы (правленая копия HR — в отчёте) ─────────

const OPEN_BLOCKS = [
  { key: 'strengths' as const, blockKey: 'open:strengths', title: 'Сильные стороны', subtitle: 'отмеченные в открытых вопросах' },
  { key: 'toChange' as const, blockKey: 'open:toChange', title: 'Что нужно изменить, чтобы повысить эффективность', subtitle: 'Комментарии из открытых вопросов' },
  { key: 'toDevelop' as const, blockKey: 'open:toDevelop', title: 'Что нужно развивать в первую очередь', subtitle: 'Комментарии из открытых вопросов' },
];

/** Исходные цитаты из оценки (fallback, когда HR ещё не правил). */
function rawOpenAnswers(res: Results360): ReportOpenAnswers {
  const pick = (key: 'strengths' | 'toChange' | 'toDevelop') =>
    res.openAnswers.flatMap(g => g.items.map(i => i[key]).filter((s): s is string => !!s));
  return { strengths: pick('strengths'), toChange: pick('toChange'), toDevelop: pick('toDevelop') };
}

function OpenAnswersSection({ res, sections, ctx }: {
  res: Results360; sections: Report360Sections | null; ctx: EditCtx;
}) {
  const shown = sections?.openAnswers ?? rawOpenAnswers(res);
  const setList = (key: 'strengths' | 'toChange' | 'toDevelop', fn: (items: string[]) => string[]) =>
    ctx.update(s => {
      const cur = s.openAnswers ?? rawOpenAnswers(res);
      return { ...s, openAnswers: { ...cur, [key]: fn(cur[key]) } };
    });
  return (
    <div className="stack-3">
      {OPEN_BLOCKS.map(b => {
        const items = shown[b.key];
        const editing = ctx.isEditing(b.blockKey);
        return (
          <div key={b.key} className="card card-pad" style={{ position: 'relative' }}>
            <BlockControls k={b.blockKey} ctx={ctx} />
            <BigTitle title={b.title} subtitle={b.subtitle} />
            {!editing && items.length === 0 && <div className="small muted" style={{ textAlign: 'center' }}>Нет ответов</div>}
            {!editing ? (
              <ul style={{ margin: 0, paddingLeft: 22 }} className="stack-2">
                {items.map((t, i) => <li key={i} style={{ whiteSpace: 'pre-wrap' }}>{t}</li>)}
              </ul>
            ) : (
              <div className="stack-2">
                {items.map((t, i) => (
                  <div key={i} className="row-2" style={{ alignItems: 'flex-start', gap: 8 }}>
                    <textarea className="ta" rows={2} style={{ flex: 1 }} value={t}
                      onChange={e => setList(b.key, list => list.map((x, j) => j === i ? e.target.value : x))} />
                    <button className="btn btn-ghost btn-sm" title="Удалить"
                      onClick={() => setList(b.key, list => list.filter((_, j) => j !== i))}><Icon name="trash" size={13} /></button>
                  </div>
                ))}
                <button className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }}
                  onClick={() => setList(b.key, list => [...list, ''])}>+ Добавить</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Диаграммы по категориям (не редактируются) ──────────────

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

// ─── Сильные стороны / Зоны развития (нарратив) ──────────────

function NarrativeSection({ sec, listKey, title, ctx }: {
  sec: Report360Sections; listKey: 'strengths' | 'developmentAreas'; title: string; ctx: EditCtx;
}) {
  const items = sec[listKey];
  const editing = ctx.isEditing(listKey);
  if (!ctx.canEdit && items.length === 0) return null;
  const set = (fn: (items: ReportNarrativeItem[]) => ReportNarrativeItem[]) =>
    ctx.update(s => ({ ...s, [listKey]: fn(s[listKey]) }));
  return (
    <div className="card card-pad" style={{ position: 'relative' }}>
      <BlockControls k={listKey} ctx={ctx} />
      <BigTitle title={title} subtitle="по итогу совокупной оценки окружения" />
      {!editing && items.length === 0 && <EmptyHint />}
      <div className="stack-4">
        {items.map((it, i) => (
          <div key={i}>
            {editing ? (
              <div className="stack-2">
                <div className="row-2" style={{ alignItems: 'center' }}>
                  <input className="inp" value={it.competency} placeholder="Компетенция"
                    onChange={e => set(list => list.map((x, j) => j === i ? { ...x, competency: e.target.value } : x))} />
                  <button className="btn btn-ghost btn-sm" title="Удалить"
                    onClick={() => set(list => list.filter((_, j) => j !== i))}><Icon name="trash" size={13} /></button>
                </div>
                <textarea className="ta" rows={3} value={it.text} placeholder="Интерпретация с цифрами и опорой на комментарии"
                  onChange={e => set(list => list.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} />
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
        {editing && (
          <button className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }}
            onClick={() => set(list => [...list, { competency: '', text: '' }])}>+ Добавить</button>
        )}
      </div>
    </div>
  );
}

// ─── Слепые зоны / Скрытые возможности ───────────────────────

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
  const editing = ctx.isEditing(listKey);
  if (!ctx.canEdit && items.length === 0) return null;
  const set = (fn: (items: ReportZoneItem[]) => ReportZoneItem[]) =>
    ctx.update(s => ({ ...s, [listKey]: fn(s[listKey]) }));
  const patch = (i: number, p: Partial<ReportZoneItem>) => set(list => list.map((x, j) => j === i ? { ...x, ...p } : x));
  return (
    <div className="card card-pad" style={{ position: 'relative' }}>
      <BlockControls k={listKey} ctx={ctx} />
      <BigTitle title={title} subtitle="по итогу совокупной оценки окружения" />
      {!editing && items.length === 0 && (ctx.canEdit ? <EmptyHint /> : <div className="small muted" style={{ textAlign: 'center' }}>Не выявлены</div>)}
      <div className="stack-4">
        {items.map((it, i) => (
          <div key={i}>
            {editing ? (
              <div className="stack-2">
                <div className="row-2" style={{ alignItems: 'center' }}>
                  <input className="inp" style={{ maxWidth: 360 }} value={it.competency} placeholder="Компетенция" onChange={e => patch(i, { competency: e.target.value })} />
                  <button className="btn btn-ghost btn-sm" title="Удалить" onClick={() => set(list => list.filter((_, j) => j !== i))}><Icon name="trash" size={13} /></button>
                </div>
                {zoneScoreLine(it) && <div className="small muted">Данные оценки: {zoneScoreLine(it)}</div>}
                <div className="field"><label className="small">Подтверждение из комментариев</label>
                  <textarea className="ta" rows={3} value={it.text} placeholder="Опора на открытые ответы, без имён" onChange={e => patch(i, { text: e.target.value })} /></div>
                <div className="field"><label className="small">Вывод</label>
                  <textarea className="ta" rows={2} value={it.conclusion} placeholder="Вывод" onChange={e => patch(i, { conclusion: e.target.value })} /></div>
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
        {editing && (
          <button className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }}
            onClick={() => set(list => [...list, { competency: '', selfScore: null, othersScore: null, delta: null, text: '', conclusion: '' }])}>+ Добавить</button>
        )}
      </div>
    </div>
  );
}

// ─── Пары групп: диаграмма + разбор ──────────────────────────

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

function PairFindings({ pair, pairIndex, genitive, blockKey, ctx }: {
  pair: ReportGroupPair; pairIndex: number; genitive: string; blockKey: string; ctx: EditCtx;
}) {
  const editing = ctx.isEditing(blockKey);
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
  if (!ctx.canEdit && pair.items.length === 0) return null;

  return (
    <div className="card card-pad" style={{ position: 'relative' }}>
      <BlockControls k={blockKey} ctx={ctx} />
      <div className="stack-4" style={{ marginTop: ctx.canEdit ? 26 : 0 }}>
        {!editing && pair.items.length === 0 && <EmptyHint />}
        {kinds.map(kind => {
          const group = entries.filter(e => e.it.kind === kind);
          if (group.length === 0) return null;
          return (
            <div key={kind}>
              <b style={{ textDecoration: 'underline' }}>{headings[kind]}</b>
              <ul style={{ margin: '8px 0 0', paddingLeft: 22 }} className="stack-2">
                {group.map(({ it, idx }) => (
                  <li key={idx}>
                    {editing ? (
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
                        <textarea className="ta" rows={2} value={it.text} placeholder="Интерпретация"
                          onChange={e => patch(idx, { text: e.target.value })} />
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
        {editing && (
          <button className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }}
            onClick={() => setPair(list => [...list, { kind: 'CONSENSUS', competency: '', delta: null, text: '' }])}>+ Добавить</button>
        )}
      </div>
    </div>
  );
}

// ─── Рекомендации по развитию ────────────────────────────────

function RecommendationsSection({ sec, ctx }: { sec: Report360Sections; ctx: EditCtx }) {
  const editing = ctx.isEditing('recommendations');
  const hasContent = sec.recommendations.some(t => t.title || t.subtopics.some(s => s.title || s.text));
  if (!ctx.canEdit && !hasContent) return null;
  const patchTheme = (ti: number, fn: (t: Report360Sections['recommendations'][number]) => Report360Sections['recommendations'][number]) =>
    ctx.update(s => ({ ...s, recommendations: s.recommendations.map((t, j) => j === ti ? fn(t) : t) }));
  return (
    <div className="card card-pad" style={{ position: 'relative' }}>
      <BlockControls k="recommendations" ctx={ctx} />
      <BigTitle title="Рекомендации по развитию" subtitle="4 темы развития, по 4 подтемы в каждой" />
      {!editing && !hasContent && <EmptyHint />}
      <div className="stack-4">
        {sec.recommendations.map((theme, ti) => {
          if (!editing && !theme.title && theme.subtopics.every(s => !s.title && !s.text)) return null;
          return (
            <div key={ti}>
              {editing ? (
                <input className="inp" value={theme.title} placeholder={`Тема ${ti + 1}`}
                  onChange={e => patchTheme(ti, t => ({ ...t, title: e.target.value }))} />
              ) : (
                <b style={{ textDecoration: 'underline' }}>{ti + 1}. {theme.title}</b>
              )}
              <div className="small" style={{ textDecoration: 'underline', margin: '6px 0 4px' }}>Подтемы:</div>
              {editing ? (
                <div className="stack-2" style={{ paddingLeft: 8 }}>
                  {theme.subtopics.map((sub, si) => (
                    <div key={si} className="stack-2">
                      <input className="inp" value={sub.title} placeholder={`Подтема ${si + 1}`}
                        onChange={e => patchTheme(ti, t => ({ ...t, subtopics: t.subtopics.map((x, j) => j === si ? { ...x, title: e.target.value } : x) }))} />
                      <textarea className="ta" rows={2} value={sub.text} placeholder="Что и как развивать"
                        onChange={e => patchTheme(ti, t => ({ ...t, subtopics: t.subtopics.map((x, j) => j === si ? { ...x, text: e.target.value } : x) }))} />
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

// ─── Отчёт целиком (структура = PDF-образец) ─────────────────

export function Report360View({ res, sections, editable = false, onChange, onCommit, header }: {
  res: Results360;
  /** Интерпретационная часть; null у сотрудника — показывается только автоматическая часть. */
  sections?: Report360Sections | null;
  /** HR: блоки можно редактировать поблочно (карандаш → правка → «Готово»). */
  editable?: boolean;
  onChange?: (s: Report360Sections) => void;
  /** Вызывается при «Готово» на блоке — сохранение на сервер. */
  onCommit?: (s: Report360Sections) => void;
  /** Необязательный блок между автоматической частью и интерпретацией. */
  header?: React.ReactNode;
}) {
  const [editingBlock, setEditingBlock] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Report360Sections | null>(null);
  const canEdit = editable && !!sections && !!onChange;

  // сотрудник/печать: принудительно закрываем редактор
  useEffect(() => { if (!canEdit) { setEditingBlock(null); setSnapshot(null); } }, [canEdit]);

  const ctx: EditCtx = {
    canEdit,
    editingBlock,
    isEditing: key => canEdit && editingBlock === key,
    startEdit: key => { if (sections) { setSnapshot(sections); setEditingBlock(key); } },
    commit: () => { if (sections && onCommit) onCommit(sections); setEditingBlock(null); setSnapshot(null); },
    cancel: () => { if (snapshot && onChange) onChange(snapshot); setEditingBlock(null); setSnapshot(null); },
    update: patch => { if (sections && onChange) onChange(patch(sections)); },
  };
  const pairIndex = (key: GroupPairKey) => sections?.groupComparison.findIndex(p => p.pair === key) ?? -1;

  return (
    <div className="stack-3 print-area">
      {/* 1–2. Титул, вводный текст, шкала оценок */}
      <TitleBlock res={res} />
      {/* 3. Сводная таблица (из оценки, только чтение) */}
      <SummaryTable res={res} />
      {/* 4. Открытые ответы: исходные цитаты или правленая HR копия */}
      <OpenAnswersSection res={res} sections={sections ?? null} ctx={ctx} />
      {/* 5. Сводная диаграмма по всем группам (только чтение) */}
      <ChartBlock res={res} title="Диаграмма сравнительных оценок по всем категориям респондентов"
        keys={['self', 'manager', 'peers', 'subordinates']} />
      {header}
      {/* 6. Интерпретация по итогам оценки окружения */}
      {sections && (
        <>
          <NarrativeSection sec={sections} listKey="strengths" title="Сильные стороны" ctx={ctx} />
          <NarrativeSection sec={sections} listKey="developmentAreas" title="Зоны развития" ctx={ctx} />
          <ZoneSection sec={sections} listKey="blindSpots" title="Слепые зоны" ctx={ctx} />
          <ZoneSection sec={sections} listKey="hiddenPotential" title="Скрытые возможности" ctx={ctx} />
        </>
      )}
      {/* 7. Пары групп: диаграммы — всегда, разбор — при наличии отчёта */}
      {PAIR_BLOCKS.map(block => {
        const idx = pairIndex(block.pair);
        const pair = sections && idx >= 0 ? sections.groupComparison[idx] : null;
        return (
          <React.Fragment key={block.pair}>
            <ChartBlock res={res} title={block.chartTitle} keys={block.keys} />
            {pair && (
              <PairFindings pair={pair} pairIndex={idx} genitive={block.genitive} blockKey={`pair:${block.pair}`} ctx={ctx} />
            )}
          </React.Fragment>
        );
      })}
      {/* 8. Рекомендации */}
      {sections && <RecommendationsSection sec={sections} ctx={ctx} />}
    </div>
  );
}
