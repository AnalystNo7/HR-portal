import { PrismaService } from '../../prisma/prisma.service';

export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  /**
   * Лимит токенов ответа (max_tokens); null — лимит НЕ отправляется, размер ответа
   * решает провайдер (обычно максимум модели). Явный лимит нужен провайдерам,
   * у которых дефолт мал; reasoning-модели тратят токены на размышления,
   * при малом лимите ответ обрывается, не дойдя до JSON.
   */
  maxTokens: number | null;
  /** Число запросов генерации отчёта: 1 — одним, 2/3 — последовательными частями. */
  splitParts: number;
  /** Таймауты попыток по частям, сек; null-элемент = дефолт 300 с. */
  partTimeouts: (number | null)[];
  /** Откуда взято основное значение baseUrl (для отображения в админке). */
  source: 'db' | 'env';
}

export interface LlmSettingsRaw {
  baseUrl: string | null;
  apiKey: string | null;
  model: string | null;
  temperature: number | null;
  maxTokens: number | null;
  splitParts: number | null;
  /** Сырой Json из БД: ожидается массив (number|null)[]. */
  partTimeouts: unknown;
}

export const MIN_MAX_TOKENS = 256;
export const MAX_MAX_TOKENS = 128_000;

/** Кламп лимита токенов в допустимые пределы; null/NaN → null (взять дефолт). */
export function clampMaxTokens(v: number | null | undefined): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  return Math.min(MAX_MAX_TOKENS, Math.max(MIN_MAX_TOKENS, Math.round(v)));
}

/**
 * Потолок числа частей генерации. Восемь — раскладка, при которой на шлюзе с лимитом
 * вывода 4096 (GonkaRouter) оба раздела-пары идут по одному разбору на запрос:
 * сравнение по группам (3 пары) и сравнение с внешними группами (2 пары).
 * На семи частях сравнение с внешними оставалось целым и в 4096 не влезало.
 */
export const MAX_SPLIT_PARTS = 8;

/** Число частей генерации: только 1..MAX_SPLIT_PARTS; null/NaN → null (дефолт 1). */
export function clampSplitParts(v: number | null | undefined): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  return Math.min(MAX_SPLIT_PARTS, Math.max(1, Math.round(v)));
}

export const MIN_TIMEOUT_S = 30;
export const MAX_TIMEOUT_S = 600;

/**
 * Строгая проверка таймаутов при СОХРАНЕНИИ пресета: каждый заполненный элемент
 * должен быть целым числом 30–600. false — есть недопустимое значение
 * (сохранять нельзя, кламп не применяется — значение отклоняется).
 */
export function isValidPartTimeouts(v: unknown): boolean {
  if (v == null) return true;
  if (!Array.isArray(v)) return false;
  return v.every(x => x == null || (typeof x === 'number' && Number.isInteger(x) && x >= MIN_TIMEOUT_S && x <= MAX_TIMEOUT_S));
}

/**
 * Таймауты попыток по частям при ЧТЕНИИ конфига: не-массив → []; элемент-число —
 * округлить и клампнуть 30–600 с (страховка от старых/кривых данных в БД),
 * прочее → null (дефолт); максимум MAX_SPLIT_PARTS элементов.
 */
export function clampPartTimeouts(v: unknown): (number | null)[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, MAX_SPLIT_PARTS).map(x =>
    typeof x === 'number' && Number.isFinite(x)
      ? Math.min(MAX_TIMEOUT_S, Math.max(MIN_TIMEOUT_S, Math.round(x)))
      : null,
  );
}

const env = (k: string): string | null => {
  const v = process.env[k];
  return v && v.trim() ? v.trim() : null;
};

/**
 * Итоговый конфиг: значения из БД, пустые поля добираются из env.
 * null — если не заданы обязательные (baseUrl + apiKey + model) ни в БД, ни в env.
 */
export function resolveLlmConfig(db: LlmSettingsRaw | null): LlmConfig | null {
  const baseUrlDb = db?.baseUrl?.trim() || null;
  const apiKeyDb = db?.apiKey?.trim() || null;
  const modelDb = db?.model?.trim() || null;

  const baseUrl = baseUrlDb ?? env('LLM_BASE_URL');
  const apiKey = apiKeyDb ?? env('LLM_API_KEY');
  const model = modelDb ?? env('LLM_MODEL');
  if (!baseUrl || !apiKey || !model) return null;

  const tempRaw = db?.temperature ?? (env('LLM_TEMPERATURE') != null ? Number(env('LLM_TEMPERATURE')) : null);
  const temperature = tempRaw != null && Number.isFinite(tempRaw) ? tempRaw : 0.3;

  const tokensRaw = db?.maxTokens ?? (env('LLM_MAX_TOKENS') != null ? Number(env('LLM_MAX_TOKENS')) : null);
  const maxTokens = clampMaxTokens(tokensRaw); // null — лимит не отправляется

  const splitParts = clampSplitParts(db?.splitParts) ?? 1;
  const partTimeouts = clampPartTimeouts(db?.partTimeouts);

  return { baseUrl, apiKey, model, temperature, maxTokens, splitParts, partTimeouts, source: baseUrlDb ? 'db' : 'env' };
}

/**
 * Читает действующий пресет подключения: активную строку (isActive),
 * при её отсутствии — легаси-строку id="default" (настройки до ввода пресетов).
 */
export async function loadLlmSettings(prisma: PrismaService): Promise<LlmSettingsRaw | null> {
  const row =
    (await prisma.llmSettings.findFirst({ where: { isActive: true } })) ??
    (await prisma.llmSettings.findUnique({ where: { id: 'default' } }));
  return row
    ? { baseUrl: row.baseUrl, apiKey: row.apiKey, model: row.model, temperature: row.temperature, maxTokens: row.maxTokens, splitParts: row.splitParts, partTimeouts: row.partTimeouts }
    : null;
}
