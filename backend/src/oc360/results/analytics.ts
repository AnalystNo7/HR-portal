import { EvaluatorRole } from '@prisma/client';

/** Целевой уровень компетенций — константа методики (значения циклов игнорируются). */
export const DEFAULT_TARGET_LEVEL = 3.0;

/** Порог зоны развития по методике v1.2: итоговая (средняя) строго < 3,0. */
export const DEV_THRESHOLD = 3.0;

/** Порог сильной стороны по методике v1.2: итоговая (средняя) строго > 3,4. */
export const STRONG_THRESHOLD = 3.4;

/**
 * Порог слепой зоны / скрытой возможности по методике:
 * |самооценка − оценка окружения| ≥ 0.6.
 */
export const ZONE_EPS = 0.6;

/** Нижняя граница зоны внимания по методике: |Δ| в диапазоне 0.4–0.5. */
export const ATTENTION_EPS = 0.4;

export type DeltaCategory =
  | 'MATCH'       // 0.0–0.1 — практически полное совпадение
  | 'NOISE'       // 0.2–0.3 — незначимое расхождение («шум» шкалы)
  | 'ATTENTION'   // 0.4–0.5 — зона внимания
  | 'PRONOUNCED'  // 0.6–0.7 — выраженное расхождение
  | 'CRITICAL'    // 0.8–0.9 — критичное расхождение
  | 'SYSTEMIC'    // 1.0–1.2 — системный разрыв
  | 'EXTREME';    // > 1.2  — критический разрыв

export const DELTA_CATEGORY_LABEL: Record<DeltaCategory, string> = {
  MATCH: 'практически полное совпадение (0.0–0.1)',
  NOISE: 'незначимое расхождение, «шум» шкалы (0.2–0.3)',
  ATTENTION: 'зона внимания (0.4–0.5)',
  PRONOUNCED: 'выраженное расхождение (0.6–0.7)',
  CRITICAL: 'критичное расхождение (0.8–0.9)',
  SYSTEMIC: 'системный разрыв (1.0–1.2)',
  EXTREME: 'критический разрыв (>1.2)',
};

export function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return round2(nums.reduce((a, b) => a + b, 0) / nums.length);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Популяционное среднеквадратичное отклонение (разброс оценок внутри группы). */
export function stddev(nums: number[]): number | null {
  if (nums.length < 2) return null;
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length;
  return round2(Math.sqrt(variance));
}

/** Категория расхождения по |Δ|, границы — с округлением до 0.1 (по методике). */
export function deltaCategory(delta: number | null): DeltaCategory | null {
  if (delta == null) return null;
  const d = Math.round(Math.abs(delta) * 10) / 10;
  if (d <= 0.1) return 'MATCH';
  if (d <= 0.3) return 'NOISE';
  if (d <= 0.5) return 'ATTENTION';
  if (d <= 0.7) return 'PRONOUNCED';
  if (d <= 0.9) return 'CRITICAL';
  if (d <= 1.2) return 'SYSTEMIC';
  return 'EXTREME';
}

const EXTERNAL_ROLES = ['MANAGER', 'PEER', 'SUBORDINATE'] as const;
type ExternalRole = (typeof EXTERNAL_ROLES)[number];

/** Зона расхождения самооценки с группой (классификация выполняется кодом, не LLM). */
export type ZoneKind = 'CONSENSUS' | 'ATTENTION' | 'BLIND_SPOT' | 'HIDDEN_POTENTIAL';

/**
 * Зона по знаку Δ (самооценка − оценка группы) на |Δ|, округлённом до 0,1, —
 * единая сетка с категориями расхождений (deltaCategory):
 * ≤0,3 — консенсус; 0,4–0,5 — зона внимания; ≥0,6 — слепая зона / скрытая возможность.
 * Округляем |Δ|, а не Δ: Math.round для отрицательных несимметричен (−0,55 → −0,5).
 * Та же формула красит зоны в таблице результатов.
 */
export function zoneOfDelta(delta: number | null): ZoneKind | null {
  if (delta == null) return null;
  const a = Math.round(Math.abs(delta) * 10) / 10;
  if (a >= ZONE_EPS) return delta > 0 ? 'BLIND_SPOT' : 'HIDDEN_POTENTIAL';
  if (a >= ATTENTION_EPS) return 'ATTENTION';
  return 'CONSENSUS';
}

export interface GroupStat {
  /** Среднее по всем баллам группы (как в таблице результатов). */
  avg: number | null;
  /** Разброс между респондентами группы (СКО их средних по компетенции). */
  stddev: number | null;
  /** Число завершивших оценку респондентов группы, оценивших компетенцию. */
  n: number;
  min: number | null;
  max: number | null;
}

export interface CompetencyAnalytics {
  id: string;
  name: string;
  category: string;
  description: string | null;
  byGroup: Record<EvaluatorRole, GroupStat>;
  othersAvg: number | null;
  total: number | null;
  selfVsOthers: { delta: number | null; category: DeltaCategory | null };
  selfVsGroup: Record<ExternalRole, { delta: number | null; category: DeltaCategory | null }>;
  groupPairs: {
    managerVsPeers: number | null;
    managerVsSubordinates: number | null;
    peersVsSubordinates: number | null;
  };
  vsTarget: { target: number; delta: number | null };
  /** Единичные низкие оценки на фоне приемлемого среднего. */
  outliers: { role: EvaluatorRole; indicatorText: string; score: number }[];
  /** Зона к совокупной оценке окружения — вычислена системой, LLM не переклассифицирует. */
  zoneVsOthers: ZoneKind | null;
  /** Зона к каждой группе оценивающих — вычислена системой. */
  zoneByGroup: Record<ExternalRole, ZoneKind | null>;
}

/** Пары внешних групп для разбора «руководитель против группы». */
export type ExternalPairKey = 'MANAGER_SUBORDINATE' | 'MANAGER_PEER';

export interface ExternalPairItem {
  name: string;
  managerAvg: number;
  groupAvg: number;
  /** Δ = оценка руководителя − оценка группы (со знаком). */
  delta: number;
}

/**
 * Готовые составы разделов отчёта (отбор выполнен системой, LLM пишет только тексты).
 * Разделы взаимоисключающие: компетенции с |Δ| ≥ 0,6 попадают ТОЛЬКО в
 * blindSpots/hiddenPotential и исключаются из strengths/developmentAreas.
 */
export interface ReportSelection {
  /** Сильные стороны: итоговая (средняя) строго > 3,4, среди компетенций без выраженного расхождения. */
  strengths: { name: string; total: number }[];
  /** Зоны развития: итоговая (средняя) строго < 3,0, среди компетенций без выраженного расхождения. */
  developmentAreas: { name: string; total: number }[];
  /** Слепые зоны: самооценка выше окружения на 0,6 и более (по убыванию Δ). */
  blindSpots: { name: string; delta: number }[];
  /** Скрытые возможности: самооценка ниже окружения на 0,6 и более (по убыванию |Δ|). */
  hiddenPotential: { name: string; delta: number }[];
  /**
   * Разборы пар внешних групп: компетенции с |Δ| ≥ 0,4 (по округлению до 0,1)
   * между оценкой руководителя и группы, по убыванию |Δ|.
   */
  externalPairs: Record<ExternalPairKey, ExternalPairItem[]>;
}

export interface ReportAnalytics {
  targetLevel: number;
  scale: { min: number; max: number };
  /** Составы разделов отчёта — вычислены системой (см. ReportSelection). */
  selection: ReportSelection;
  competencies: CompetencyAnalytics[];
  overall: {
    selfAvg: number | null;
    othersAvg: number | null;
    gap: number | null;
    gapCategory: DeltaCategory | null;
  };
  /** Открытые ответы по ролям, без имён респондентов. */
  openAnswers: {
    role: EvaluatorRole;
    strengths: string[];
    toChange: string[];
    toDevelop: string[];
  }[];
}

export interface CompetencyInput {
  id: string;
  name: string;
  category: string;
  description: string | null;
  /** Все баллы группы по индикаторам компетенции (пул). */
  scoresByRole: Record<EvaluatorRole, number[]>;
  /** Средние по компетенции каждого респондента группы. */
  respondentMeansByRole: Record<EvaluatorRole, number[]>;
  /** Баллы по индикаторам для поиска выбросов (только внешние роли). */
  indicatorScores: { role: EvaluatorRole; indicatorText: string; score: number }[];
}

export interface AnalyticsInput {
  targetLevel: number;
  scaleMin: number;
  scaleMax: number;
  competencies: CompetencyInput[];
  openAnswers: ReportAnalytics['openAnswers'];
}

function diff(a: number | null, b: number | null): number | null {
  return a != null && b != null ? round2(a - b) : null;
}

/**
 * Разбор пары «руководитель против группы»: компетенции, где |Δ| ≥ 0,4
 * (на округлённом до 0,1 значении — «зона внимания» и выше), по убыванию |Δ|.
 */
function externalPair(
  competencies: CompetencyAnalytics[],
  role: 'SUBORDINATE' | 'PEER',
): ExternalPairItem[] {
  return competencies
    .flatMap(c => {
      const manager = c.byGroup.MANAGER.avg;
      const group = c.byGroup[role].avg;
      if (manager == null || group == null) return [];
      const delta = round2(manager - group);
      if (Math.round(Math.abs(delta) * 10) / 10 < ATTENTION_EPS) return [];
      return [{ name: c.name, managerAvg: manager, groupAvg: group, delta }];
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

export function buildAnalytics(input: AnalyticsInput): ReportAnalytics {
  const competencies = input.competencies.map((c): CompetencyAnalytics => {
    const byGroup = {} as Record<EvaluatorRole, GroupStat>;
    for (const role of ['SELF', ...EXTERNAL_ROLES] as EvaluatorRole[]) {
      const means = c.respondentMeansByRole[role] ?? [];
      byGroup[role] = {
        avg: avg(c.scoresByRole[role] ?? []),
        stddev: stddev(means),
        n: means.length,
        min: means.length ? round2(Math.min(...means)) : null,
        max: means.length ? round2(Math.max(...means)) : null,
      };
    }
    const self = byGroup.SELF.avg;
    const othersAvg = avg(EXTERNAL_ROLES.flatMap(r => c.scoresByRole[r] ?? []));
    const laneAvgs = (['SELF', ...EXTERNAL_ROLES] as EvaluatorRole[])
      .map(r => byGroup[r].avg)
      .filter((v): v is number => v != null);
    const total = avg(laneAvgs);

    const selfVsGroup = {} as CompetencyAnalytics['selfVsGroup'];
    for (const role of EXTERNAL_ROLES) {
      const d = diff(self, byGroup[role].avg);
      selfVsGroup[role] = { delta: d, category: deltaCategory(d) };
    }

    // выброс: низкий балл индикатора при среднем окружения не ниже целевого уровня
    const outliers =
      othersAvg != null && othersAvg >= input.targetLevel
        ? c.indicatorScores.filter(
            s => s.role !== 'SELF' && s.score <= input.scaleMin + 1,
          )
        : [];

    const gap = diff(self, othersAvg);
    const zoneByGroup = {} as CompetencyAnalytics['zoneByGroup'];
    for (const role of EXTERNAL_ROLES) zoneByGroup[role] = zoneOfDelta(selfVsGroup[role].delta);
    return {
      id: c.id,
      name: c.name,
      category: c.category,
      description: c.description,
      byGroup,
      othersAvg,
      total,
      selfVsOthers: { delta: gap, category: deltaCategory(gap) },
      selfVsGroup,
      zoneVsOthers: zoneOfDelta(gap),
      zoneByGroup,
      groupPairs: {
        managerVsPeers: diff(byGroup.MANAGER.avg, byGroup.PEER.avg),
        managerVsSubordinates: diff(byGroup.MANAGER.avg, byGroup.SUBORDINATE.avg),
        peersVsSubordinates: diff(byGroup.PEER.avg, byGroup.SUBORDINATE.avg),
      },
      vsTarget: {
        target: input.targetLevel,
        delta: total != null ? round2(total - input.targetLevel) : null,
      },
      outliers,
    };
  });

  const selfAvg = avg(competencies.map(c => c.byGroup.SELF.avg).filter((v): v is number => v != null));
  const othersAvg = avg(competencies.map(c => c.othersAvg).filter((v): v is number => v != null));
  const gap = diff(selfAvg, othersAvg);

  // составы разделов отчёта — детерминированный отбор (LLM пишет только тексты);
  // разделы взаимоисключающие: |Δ| ≥ 0,6 уходит только в слепые/скрытые,
  // остальные — по итоговой (средней) v1.2: строго > 3,4 — сильная сторона,
  // строго < 3,0 — зона развития, 3,0–3,4 — не входит никуда
  const rated = competencies.filter((c): c is CompetencyAnalytics & { total: number } => c.total != null);
  const eligible = rated.filter(c => c.zoneVsOthers !== 'BLIND_SPOT' && c.zoneVsOthers !== 'HIDDEN_POTENTIAL');
  const selection: ReportSelection = {
    strengths: eligible
      .filter(c => c.total > STRONG_THRESHOLD)
      .sort((a, b) => b.total - a.total)
      .map(c => ({ name: c.name, total: c.total })),
    developmentAreas: eligible
      .filter(c => c.total < DEV_THRESHOLD)
      .sort((a, b) => a.total - b.total)
      .map(c => ({ name: c.name, total: c.total })),
    blindSpots: competencies
      .filter(c => c.zoneVsOthers === 'BLIND_SPOT' && c.selfVsOthers.delta != null)
      .sort((a, b) => (b.selfVsOthers.delta ?? 0) - (a.selfVsOthers.delta ?? 0))
      .map(c => ({ name: c.name, delta: c.selfVsOthers.delta! })),
    hiddenPotential: competencies
      .filter(c => c.zoneVsOthers === 'HIDDEN_POTENTIAL' && c.selfVsOthers.delta != null)
      .sort((a, b) => Math.abs(b.selfVsOthers.delta ?? 0) - Math.abs(a.selfVsOthers.delta ?? 0))
      .map(c => ({ name: c.name, delta: c.selfVsOthers.delta! })),
    externalPairs: {
      MANAGER_SUBORDINATE: externalPair(competencies, 'SUBORDINATE'),
      MANAGER_PEER: externalPair(competencies, 'PEER'),
    },
  };

  return {
    targetLevel: input.targetLevel,
    scale: { min: input.scaleMin, max: input.scaleMax },
    selection,
    competencies,
    overall: { selfAvg, othersAvg, gap, gapCategory: deltaCategory(gap) },
    openAnswers: input.openAnswers,
  };
}
