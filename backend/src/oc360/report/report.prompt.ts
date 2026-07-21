import { ReportAnalytics } from '../results/analytics';

/** Лимит суммарного текста методических документов в промпте (символы). */
export const MAX_CONTEXT_CHARS = 150_000;

/**
 * Методическая часть системного промпта (редактируется HR во вкладке «База знаний»).
 * Плейсхолдеры {{scale_min}}, {{scale_max}}, {{target_level}} подставляются при генерации.
 */
export const DEFAULT_METHODOLOGY = `Ты — эксперт по оценке персонала методом «360 градусов». Составь черновик
интерпретационного отчёта по результатам оценки сотрудника для HR-специалиста.

Методология:
- Шкала оценок: от {{scale_min}} до {{scale_max}}. Целевой уровень развития компетенций: {{target_level}}.
- Категории расхождений |Δ| между самооценкой и оценкой группы:
  0.0–0.1 — практически полное совпадение; 0.2–0.3 — «шум» шкалы, незначимо;
  0.4–0.5 — зона внимания; 0.6–0.7 — выраженное расхождение;
  0.8–0.9 — критичное расхождение; 1.0–1.2 — системный разрыв; более 1.2 — критический разрыв.
- Слепая зона: самооценка ВЫШЕ оценки окружения на 0.6 и более.
- Скрытая возможность: самооценка НИЖЕ оценки окружения на 0.6 и более.
- Зона консенсуса: |Δ| не больше 0.3 — восприятие совпадает.
- Зона внимания: |Δ| в диапазоне 0.4–0.5 — расхождение заметно, но порога слепой
  зоны / скрытой возможности не достигает; требует наблюдения.
- Сравнивай оценки с целевым уровнем: оценка окружения ниже целевого уровня — зона риска,
  даже при малом Δ.
- Высокий разброс оценок внутри группы (stddev > 0.6) — поведение воспринимается по-разному,
  выводы делай осторожнее.
- Единичные низкие оценки (outliers) отмечай как сигнал для внимания, а не как вывод.

Требования к тексту:
- Пиши по-русски, деловым, уважительным, безоценочным тоном; о сотруднике — в третьем лице.
- Каждый тезис подкрепляй цифрами (средние, Δ) и, где уместно, парафразом комментариев
  из открытых ответов. НЕ указывай и НЕ выдумывай имена оценивающих.
- Не изобретай данные: используй только переданные цифры и комментарии.
- Составы разделов уже отобраны системой и переданы в данных (selection): сильные стороны —
  топ-3 по оценке окружения; зоны развития — оценка окружения ниже целевого уровня;
  слепые зоны — самооценка ВЫШЕ окружения на 0.6 и более (Δ = самооценка − оценка окружения,
  Δ ≥ +0.6); скрытые возможности — самооценка НИЖЕ на 0.6 и более (Δ ≤ −0.6). Твоя задача —
  написать интерпретацию для каждой позиции из этих списков, не меняя их состав.
- Если раздел по selection пуст — объясни причину одним абзацем (emptyReasons), опираясь на
  цифры. В blindSpots/hiddenPotential поле "text" — абзац «Подтверждение из комментариев»:
  опора на открытые ответы (парафраз, без имён); поле "conclusion" — абзац «Вывод» с
  трактовкой разрыва и рекомендацией. Цифры оценок не повторяй в text — они выводятся отдельно.
- В groupComparison включи ВСЕ компетенции каждой пары с зоной из zoneByGroup;
  "text" — 1–3 предложения в стиле «Сотрудник и руководитель одинаково высоко оценивают
  уровень развития этой компетенции» с трактовкой причины расхождения/совпадения.
- В recommendations — РОВНО 4 темы развития, в каждой РОВНО 4 подтемы; темы выводи из
  зон развития и слепых зон.`;

/** Общие правила технической части (без схемы ответа). */
const TECHNICAL_RULES = `Рассуждай кратко: классификация, отбор и все вычисления уже выполнены системой —
не переанализируй данные заново, сразу переходи к составлению итогового JSON.

Классификация и отбор уже выполнены системой — НЕ переклассифицируй и не пересчитывай:
- У каждой компетенции в данных заданы zoneVsOthers (зона к совокупной оценке окружения) и zoneByGroup (зона к каждой группе). Сетка зон по |Δ|, округлённому до 0,1: |Δ| ≤ 0,3 — CONSENSUS (зона консенсуса); 0,4–0,5 — ATTENTION (зона внимания); |Δ| ≥ 0,6 — BLIND_SPOT (самооценка выше группы) или HIDDEN_POTENTIAL (самооценка ниже группы).
- Категорию расхождения называй СТРОГО по сетке (не своими словами): 0,0–0,1 — «практически полное совпадение»; 0,2–0,3 — «незначимое расхождение»; 0,4–0,5 — «зона внимания»; 0,6–0,7 — «выраженное расхождение»; 0,8–0,9 — «критичное расхождение»; 1,0–1,2 — «системный разрыв»; более 1,2 — «критический разрыв».
- Составы разделов заданы в selection: strengths — РОВНО компетенции из selection.strengthsTop (в том же порядке); developmentAreas — РОВНО из selection.developmentAreas; blindSpots — РОВНО из selection.blindSpots; hiddenPotential — РОВНО из selection.hiddenPotential. Ничего не добавляй, не убирай и не перемещай между разделами.
- Если список в selection пуст — верни для раздела пустой массив [] и заполни emptyReasons.<раздел> одним абзацем: объясни на цифрах, почему таких зон нет (например, самооценка согласована с окружением, расхождений ≥ 0,6 нет).
- В groupComparison включи ВСЕ компетенции каждой пары (пропусти только те, где у группы нет оценки); kind каждой компетенции — СТРОГО из её zoneByGroup для этой группы.
- Все числа (средние, Δ, разбросы) бери готовыми из данных — не вычисляй и не изменяй их.

Язык текста:
- Весь текст в строковых значениях JSON (text, conclusion, title, competency и т.п.) — СТРОГО на русском языке. Латиница в тексте запрещена.
- Названия зарубежных методик пиши в русском написании: «метод «5 почему», «диаграмма Исикавы», «обратная связь по модели SBI» → «модель «ситуация–поведение–влияние» и т.п.
- НЕ цитируй имена технических полей входных данных (stddev, avg, delta, byGroup, selfScore, othersScore, n, min, max и др.) — используй русские формулировки:
  stddev — «разброс оценок внутри группы»; avg — «средняя оценка»; delta — «расхождение»; selfScore — «самооценка»; othersScore — «оценка окружения».
- Цифры приводи в русской формулировке: «разброс оценок внутри группы — 0,17», а не «stddev = 0,17».
- Ключи JSON и значения-перечисления схемы (pair: SELF_MANAGER…, kind: CONSENSUS|ATTENTION|BLIND_SPOT|HIDDEN_POTENTIAL) оставляй ровно как в схеме — на них запрет латиницы НЕ распространяется.`;

/** Разделы ответа генерации (ключи верхнего уровня схемы). */
export type ReportSectionKey =
  | 'strengths' | 'developmentAreas' | 'blindSpots' | 'hiddenPotential'
  | 'emptyReasons' | 'groupComparison' | 'recommendations';

export const ALL_SECTION_KEYS: ReportSectionKey[] = [
  'strengths', 'developmentAreas', 'blindSpots', 'hiddenPotential',
  'groupComparison', 'recommendations', 'emptyReasons',
];

/** Фрагменты схемы ответа по разделам (собираются в блок «Верни СТРОГО JSON…»). */
const SCHEMA_FRAGMENTS: Record<ReportSectionKey, string> = {
  strengths: `  "strengths": [ { "competency": "название", "text": "абзац интерпретации с цифрами и опорой на комментарии" } ]`,
  developmentAreas: `  "developmentAreas": [ { "competency": "название", "text": "абзац интерпретации" } ]`,
  blindSpots: `  "blindSpots": [ { "competency": "название", "selfScore": 3.8, "othersScore": 3.0, "delta": 0.8, "text": "подтверждение из комментариев", "conclusion": "вывод одним абзацем" } ]`,
  hiddenPotential: `  "hiddenPotential": [ { "competency": "название", "selfScore": 2.3, "othersScore": 3.1, "delta": -0.8, "text": "подтверждение из комментариев", "conclusion": "вывод" } ]`,
  groupComparison: `  "groupComparison": [
    { "pair": "SELF_MANAGER", "title": "Самооценка и оценка руководителя",
      "items": [ { "kind": "CONSENSUS|ATTENTION|BLIND_SPOT|HIDDEN_POTENTIAL", "competency": "название", "delta": 0.4, "text": "интерпретация" } ] },
    { "pair": "SELF_SUBORDINATE", "title": "Самооценка и оценка подчинённых", "items": [ ... ] },
    { "pair": "SELF_PEER", "title": "Самооценка и оценка коллег", "items": [ ... ] }
  ]`,
  recommendations: `  "recommendations": [
    { "title": "Тема развития", "subtopics": [ { "title": "подтема", "text": "1–2 предложения, что и как развивать" } ] }
  ]`,
  emptyReasons: `  "emptyReasons": { "strengths": "абзац-объяснение (ТОЛЬКО если раздел пуст)", "developmentAreas": "...", "blindSpots": "...", "hiddenPotential": "..." }`,
};

function schemaBlock(keys: ReportSectionKey[]): string {
  return `Верни СТРОГО JSON без пояснений и без markdown, по схеме:\n{\n${keys.map(k => SCHEMA_FRAGMENTS[k]).join(',\n')}\n}`;
}

/**
 * Защищённая техническая часть: формат ответа. НЕ редактируется из UI —
 * её нарушение ломает разбор ответа модели (normalizeSections).
 */
export const TECHNICAL_PROMPT = `${TECHNICAL_RULES}\n\n${schemaBlock(ALL_SECTION_KEYS)}`;

/**
 * Разбивка генерации на части (splitParts пресета): каждой части — свой запрос
 * со своим лимитом вывода. Части независимы, запускаются параллельно.
 */
export function partsForCount(n: number): ReportSectionKey[][] {
  const sections: ReportSectionKey[] = ['strengths', 'developmentAreas', 'blindSpots', 'hiddenPotential', 'emptyReasons'];
  if (n >= 3) return [sections, ['groupComparison'], ['recommendations']];
  if (n === 2) return [sections, ['groupComparison', 'recommendations']];
  return [ALL_SECTION_KEYS];
}

export interface KnowledgeDocInput {
  name: string;
  text: string;
}

/** Подстановка плейсхолдеров методической части. */
export function fillMethodology(methodology: string, a: ReportAnalytics): string {
  return methodology
    .replaceAll('{{scale_min}}', String(a.scale.min))
    .replaceAll('{{scale_max}}', String(a.scale.max))
    .replaceAll('{{target_level}}', String(a.targetLevel));
}

/** Блок методических документов с обрезкой по общему лимиту. */
export function buildDocsBlock(docs: KnowledgeDocInput[]): string {
  if (!docs.length) return '';
  const parts: string[] = ['Методические документы (используй их положения при интерпретации):'];
  let budget = MAX_CONTEXT_CHARS;
  for (const d of docs) {
    if (budget <= 0) break;
    let text = d.text;
    if (text.length > budget) text = text.slice(0, budget) + '\n[документ обрезан по лимиту объёма]';
    budget -= text.length;
    parts.push(`### ${d.name}\n${text}`);
  }
  return parts.join('\n\n');
}

/**
 * System-промпт целиком: методическая часть (кастомная или стандартная)
 * + методические документы + защищённая техническая часть.
 * keys — разделы этой части генерации (по умолчанию все = одним запросом);
 * при частичной генерации схема содержит только свои разделы.
 */
export function buildSystemPrompt(
  a: ReportAnalytics,
  methodology: string = DEFAULT_METHODOLOGY,
  docs: KnowledgeDocInput[] = [],
  keys: ReportSectionKey[] = ALL_SECTION_KEYS,
): string {
  const blocks = [fillMethodology(methodology, a)];
  const docsBlock = buildDocsBlock(docs);
  if (docsBlock) blocks.push(docsBlock);
  if (keys.length >= ALL_SECTION_KEYS.length) {
    blocks.push(TECHNICAL_PROMPT);
  } else {
    blocks.push(
      `${TECHNICAL_RULES}\n\n` +
      `Сейчас генерируется ЧАСТЬ отчёта — верни ТОЛЬКО разделы из схемы ниже, другие разделы НЕ включай.\n\n` +
      schemaBlock(keys),
    );
  }
  return blocks.join('\n\n');
}

export interface ReportPromptSubject {
  name: string;
  position: string | null;
  cycleName: string;
}

/** User-сообщение: данные сотрудника и аналитика по методике (комментарии анонимизированы). */
export function buildUserPrompt(subject: ReportPromptSubject, analytics: ReportAnalytics): string {
  return JSON.stringify(
    {
      сотрудник: { фио: subject.name, должность: subject.position ?? undefined },
      цикл: subject.cycleName,
      аналитика: analytics,
    },
    null,
    1,
  );
}
