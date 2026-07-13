import { EvaluatorRole } from '@prisma/client';

/** Целевой уровень компетенций по методике, если не задан в цикле. */
export const DEFAULT_TARGET_LEVEL = 3.0;

/**
 * Порог слепой зоны / скрытой возможности по методике:
 * |самооценка − оценка окружения| ≥ 0.6.
 */
export const ZONE_EPS = 0.6;

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
}

export interface ReportAnalytics {
  targetLevel: number;
  scale: { min: number; max: number };
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

  return {
    targetLevel: input.targetLevel,
    scale: { min: input.scaleMin, max: input.scaleMax },
    competencies,
    overall: { selfAvg, othersAvg, gap, gapCategory: deltaCategory(gap) },
    openAnswers: input.openAnswers,
  };
}
