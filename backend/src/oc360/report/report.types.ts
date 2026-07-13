// Структура интерпретационного отчёта 360 (хранится в Cycle360Report.sections).
// Зеркальная копия типов — во frontend/lib/api.ts.

export type DeltaKind = 'CONSENSUS' | 'BLIND_SPOT' | 'HIDDEN_POTENTIAL';

export interface ReportNarrativeItem {
  competency: string;
  text: string;
}

export interface ReportZoneItem {
  competency: string;
  selfScore: number | null;
  othersScore: number | null;
  delta: number | null;
  text: string;
  conclusion: string;
}

export type GroupPairKey = 'SELF_MANAGER' | 'SELF_PEER' | 'SELF_SUBORDINATE';

export interface ReportPairFinding {
  kind: DeltaKind;
  competency: string;
  delta: number | null;
  text: string;
}

export interface ReportGroupPair {
  pair: GroupPairKey;
  title: string;
  items: ReportPairFinding[];
}

export interface ReportRecommendationTheme {
  title: string;
  subtopics: { title: string; text: string }[];
}

export interface Report360Sections {
  intro: string;
  strengths: ReportNarrativeItem[];
  developmentAreas: ReportNarrativeItem[];
  blindSpots: ReportZoneItem[];
  hiddenPotential: ReportZoneItem[];
  groupComparison: ReportGroupPair[];
  recommendations: ReportRecommendationTheme[];
}

export const GROUP_PAIR_TITLES: Record<GroupPairKey, string> = {
  SELF_MANAGER: 'Самооценка и оценка руководителя',
  SELF_PEER: 'Самооценка и оценка коллег',
  SELF_SUBORDINATE: 'Самооценка и оценка подчинённых',
};

export const RECOMMENDATION_THEMES = 4;
export const RECOMMENDATION_SUBTOPICS = 4;

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

const KINDS: DeltaKind[] = ['CONSENSUS', 'BLIND_SPOT', 'HIDDEN_POTENTIAL'];

function narrativeItems(v: unknown): ReportNarrativeItem[] {
  return arr(v)
    .map(obj)
    .map(o => ({ competency: str(o.competency), text: str(o.text) }))
    .filter(i => i.competency || i.text);
}

function zoneItems(v: unknown): ReportZoneItem[] {
  return arr(v)
    .map(obj)
    .map(o => ({
      competency: str(o.competency),
      selfScore: num(o.selfScore),
      othersScore: num(o.othersScore),
      delta: num(o.delta),
      text: str(o.text),
      conclusion: str(o.conclusion),
    }))
    .filter(i => i.competency || i.text || i.conclusion);
}

/**
 * Приводит ответ модели (или PUT от фронта) к строгой форме Report360Sections:
 * недостающие массивы — пустые, рекомендации — ровно 4 темы × 4 подтемы.
 */
export function normalizeSections(raw: unknown): Report360Sections {
  const root = obj(raw);

  const pairs: ReportGroupPair[] = (Object.keys(GROUP_PAIR_TITLES) as GroupPairKey[]).map(pair => {
    const found = arr(root.groupComparison)
      .map(obj)
      .find(p => str(p.pair) === pair);
    return {
      pair,
      title: str(found?.title) || GROUP_PAIR_TITLES[pair],
      items: arr(found?.items)
        .map(obj)
        .map(o => ({
          kind: KINDS.includes(str(o.kind) as DeltaKind) ? (str(o.kind) as DeltaKind) : 'CONSENSUS',
          competency: str(o.competency),
          delta: num(o.delta),
          text: str(o.text),
        }))
        .filter(i => i.competency || i.text),
    };
  });

  const recommendations: ReportRecommendationTheme[] = [];
  const rawThemes = arr(root.recommendations).map(obj);
  for (let t = 0; t < RECOMMENDATION_THEMES; t++) {
    const theme = rawThemes[t] ?? {};
    const rawSubs = arr(theme.subtopics).map(obj);
    const subtopics: ReportRecommendationTheme['subtopics'] = [];
    for (let s = 0; s < RECOMMENDATION_SUBTOPICS; s++) {
      const sub = rawSubs[s] ?? {};
      subtopics.push({ title: str(sub.title), text: str(sub.text) });
    }
    recommendations.push({ title: str(theme.title), subtopics });
  }

  return {
    intro: str(root.intro),
    strengths: narrativeItems(root.strengths),
    developmentAreas: narrativeItems(root.developmentAreas),
    blindSpots: zoneItems(root.blindSpots),
    hiddenPotential: zoneItems(root.hiddenPotential),
    groupComparison: pairs,
    recommendations,
  };
}

/** Отчёт считается пустым, если модель не заполнила ни одного содержательного раздела. */
export function isEmptySections(s: Report360Sections): boolean {
  return (
    !s.intro &&
    !s.strengths.length &&
    !s.developmentAreas.length &&
    !s.blindSpots.length &&
    !s.hiddenPotential.length &&
    s.groupComparison.every(p => !p.items.length) &&
    s.recommendations.every(t => !t.title && t.subtopics.every(x => !x.title && !x.text))
  );
}
