// Методика MBI (Маслач, адаптация Водопьяновой/НИПНИ им. Бехтерева) —
// единственная точка порогов и формул (по образцу oc360/results/analytics.ts).
// Пороги сверены со страницей результата psytests.org (скриншот 2026-08-17).

export type BurnoutLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface BurnoutScaleDef {
  key: 'exhaustion' | 'depersonalization' | 'reduction';
  label: string;
  max: number;
  /**
   * Границы уровня ВЫГОРАНИЯ (не сырого балла): у редукции шкала обратная —
   * низкий балл достижений означает высокое выгорание.
   */
  levelOf: (v: number) => BurnoutLevel;
}

export const BURNOUT_SCALES: BurnoutScaleDef[] = [
  {
    key: 'exhaustion',
    label: 'Эмоциональное истощение',
    max: 54,
    levelOf: v => (v <= 15 ? 'LOW' : v <= 24 ? 'MEDIUM' : 'HIGH'),
  },
  {
    key: 'depersonalization',
    label: 'Деперсонализация',
    max: 30,
    levelOf: v => (v <= 5 ? 'LOW' : v <= 10 ? 'MEDIUM' : 'HIGH'),
  },
  {
    key: 'reduction',
    label: 'Редукция проф. достижений',
    max: 48,
    // обратная шкала: 37–48 — благополучно (LOW), 31–36 — средне, 0–30 — высокое выгорание
    levelOf: v => (v >= 37 ? 'LOW' : v >= 31 ? 'MEDIUM' : 'HIGH'),
  },
];

export const BURNOUT_LEVEL_LABEL: Record<BurnoutLevel, string> = {
  LOW: 'низкий',
  MEDIUM: 'средний',
  HIGH: 'высокий',
};

export interface BurnoutScores {
  exhaustion: number;
  depersonalization: number;
  reduction: number;
}

/** Балл в допустимом диапазоне своей шкалы (целое 0..max). */
export function validateScores(s: BurnoutScores): string[] {
  const errors: string[] = [];
  for (const def of BURNOUT_SCALES) {
    const v = s[def.key];
    if (!Number.isInteger(v) || v < 0 || v > def.max) {
      errors.push(`${def.label}: балл должен быть целым числом от 0 до ${def.max}`);
    }
  }
  return errors;
}

/** Уровни выгорания по трём шкалам. */
export function levelsOf(s: BurnoutScores): Record<BurnoutScaleDef['key'], BurnoutLevel> {
  return {
    exhaustion: BURNOUT_SCALES[0].levelOf(s.exhaustion),
    depersonalization: BURNOUT_SCALES[1].levelOf(s.depersonalization),
    reduction: BURNOUT_SCALES[2].levelOf(s.reduction),
  };
}

/**
 * Системный индекс синдрома перегорания (ИСП, НИПНИ им. Бехтерева), 0..1:
 * √((x₁²+x₂²+x₃²)/3), где x₁ = ЭИ/54, x₂ = ДП/30, x₃ = 1 − РПД/48.
 * Сверено с psytests: (31, 11, 21) → 0.51.
 */
export function ispOf(s: BurnoutScores): number {
  const x1 = s.exhaustion / 54;
  const x2 = s.depersonalization / 30;
  const x3 = 1 - s.reduction / 48;
  return Math.round(Math.sqrt((x1 * x1 + x2 * x2 + x3 * x3) / 3) * 100) / 100;
}
