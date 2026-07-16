import { PrismaService } from '../../prisma/prisma.service';

export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  /** Откуда взято основное значение baseUrl (для отображения в админке). */
  source: 'db' | 'env';
}

export interface LlmSettingsRaw {
  baseUrl: string | null;
  apiKey: string | null;
  model: string | null;
  temperature: number | null;
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

  return { baseUrl, apiKey, model, temperature, source: baseUrlDb ? 'db' : 'env' };
}

/** Читает singleton-строку настроек из БД (id="default"). */
export async function loadLlmSettings(prisma: PrismaService): Promise<LlmSettingsRaw | null> {
  const row = await prisma.llmSettings.findUnique({ where: { id: 'default' } });
  return row
    ? { baseUrl: row.baseUrl, apiKey: row.apiKey, model: row.model, temperature: row.temperature }
    : null;
}
