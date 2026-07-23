// Общие константы и хелперы модуля «Оценка 360»
// (используются HR-админкой и страницей сотрудника).

import type { EvaluatorRole, EvalZone, Report360Sections } from '@/lib/api';

/** Имя файла по умолчанию при печати отчёта в PDF (пробелы → подчёркивания). */
export const reportPdfTitle = (subjectName: string) =>
  `${subjectName}_Результаты оценки 360`.replace(/\s+/g, '_');

// ─── Оценка времени AI-генерации отчёта (для полосы прогресса) ───
// Сервер не отдаёт промежуточный прогресс — оцениваем по длительности прошлых генераций.

const GEN_DUR_KEY = 'oc360.genDurations';
const GEN_DUR_KEEP = 5;              // сколько последних длительностей хранить
const GEN_MS_DEFAULT = 90_000;       // дефолт, если истории нет (~90 с)
const GEN_MS_MIN = 15_000;
const GEN_MS_MAX = 300_000;

const clampMs = (ms: number) => Math.min(GEN_MS_MAX, Math.max(GEN_MS_MIN, ms));

/** Ожидаемая длительность генерации (мс): среднее последних замеров или дефолт. */
export function expectedGenMs(): number {
  try {
    const arr = JSON.parse(localStorage.getItem(GEN_DUR_KEY) || '[]');
    const nums = Array.isArray(arr) ? arr.filter((n: unknown) => typeof n === 'number' && Number.isFinite(n)) : [];
    if (nums.length) return clampMs(nums.reduce((a: number, b: number) => a + b, 0) / nums.length);
  } catch { /* localStorage недоступен — используем дефолт */ }
  return GEN_MS_DEFAULT;
}

/** Запомнить длительность завершённой генерации (мс) для адаптивной оценки. */
export function recordGenDuration(ms: number): void {
  if (!Number.isFinite(ms) || ms <= 0) return;
  try {
    const arr = JSON.parse(localStorage.getItem(GEN_DUR_KEY) || '[]');
    const next = (Array.isArray(arr) ? arr.filter((n: unknown) => typeof n === 'number') : []) as number[];
    next.push(ms);
    while (next.length > GEN_DUR_KEEP) next.shift();
    localStorage.setItem(GEN_DUR_KEY, JSON.stringify(next));
  } catch { /* игнорируем */ }
}

export const ROLE_LABEL: Record<EvaluatorRole, string> = {
  SELF: 'Самооценка',
  MANAGER: 'Руководитель',
  PEER: 'Коллеги',
  SUBORDINATE: 'Подчинённые',
};

export const ZONE_LABEL: Record<Exclude<EvalZone, null>, string> = {
  CONSENSUS: 'Согласие',
  ATTENTION: 'Внимание',
  BLIND_SPOT: 'Слепая зона',
  HIDDEN_POTENTIAL: 'Скрытый потенциал',
};

export const ZONE_PILL: Record<Exclude<EvalZone, null>, string> = {
  CONSENSUS: 'pill-green',
  ATTENTION: 'pill-yellow',
  BLIND_SPOT: 'pill-red',
  HIDDEN_POTENTIAL: 'pill-blue',
};

export const num = (n: number | null) => (n == null ? '—' : n.toFixed(2));

export function groupByCategory<T extends { category: string }>(items: T[]): { cat: string; items: T[] }[] {
  const groups: { cat: string; items: T[] }[] = [];
  for (const it of items) {
    const key = it.category || '';
    let g = groups.find(x => x.cat === key);
    if (!g) { g = { cat: key, items: [] }; groups.push(g); }
    g.items.push(it);
  }
  return groups;
}

export type SeriesKey = 'total' | 'peers' | 'subordinates' | 'manager' | 'self';
export const SERIES: { key: SeriesKey; label: string; color: string }[] = [
  { key: 'total', label: 'Итоговая (средняя)', color: 'var(--gpc-blue-800)' },
  { key: 'peers', label: 'Коллега', color: 'var(--gpc-cyan)' },
  { key: 'subordinates', label: 'Подчинённый', color: 'var(--gpc-peach)' },
  { key: 'manager', label: 'Руководитель', color: 'var(--gpc-blue)' },
  { key: 'self', label: 'Самооценка', color: 'var(--gpc-orange)' },
];

export const SCALE = [
  { label: 'менее 2', cls: 'pill-red', desc: 'компетенция на этапе развития, требуется обучение и поддержка' },
  { label: '2,0 – 3,5', cls: 'pill-yellow', desc: 'в целом соответствует ожиданиям, есть потенциал для роста' },
  { label: 'более 3,5', cls: 'pill-green', desc: 'высокий уровень развития, лучшие практики' },
];

export function scaleColor(v: number | null): string {
  if (v == null) return 'var(--gpc-gray-400)';
  if (v < 2) return 'var(--err)';
  if (v <= 3.5) return 'var(--warn)';
  return 'var(--ok-green)';
}

/** Светлая фоновая заливка ячейки по шкале (как в PDF-отчёте). */
export function scaleBg(v: number | null): string {
  if (v == null) return 'transparent';
  if (v < 2) return '#fbdcdc';
  if (v <= 3.5) return '#fdf3b3';
  return '#cdf2cd';
}

/** UI-fallback переименования категории для немигрированных данных. */
export const catLabel = (cat: string) =>
  cat === 'Управленческие компетенции' ? 'Компетенции' : (cat || 'Компетенции');

/** Пустой шаблон отчёта для ручного заполнения без ИИ (зеркало normalizeSections({}) на backend). */
export function emptyReport360Sections(): Report360Sections {
  return {
    strengths: [],
    developmentAreas: [],
    blindSpots: [],
    hiddenPotential: [],
    groupComparison: [
      { pair: 'SELF_MANAGER', title: 'Самооценка и оценка руководителя', items: [] },
      { pair: 'SELF_PEER', title: 'Самооценка и оценка коллег', items: [] },
      { pair: 'SELF_SUBORDINATE', title: 'Самооценка и оценка подчинённых', items: [] },
    ],
    externalComparison: [
      { pair: 'MANAGER_SUBORDINATE', title: 'Сравнение оценок руководителя и подчинённых', items: [] },
      { pair: 'MANAGER_PEER', title: 'Сравнение оценок руководителя и коллег', items: [] },
    ],
    recommendations: Array.from({ length: 4 }, () => ({
      title: '',
      subtopics: Array.from({ length: 4 }, () => ({ title: '', text: '' })),
    })),
    openAnswers: null,
  };
}
