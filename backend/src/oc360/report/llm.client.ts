import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmConfig, loadLlmSettings, resolveLlmConfig } from './llm.config';

/**
 * Клиент OpenAI-совместимого chat-completions API на нативном fetch
 * (без новых зависимостей, по образцу Keycloak-вызовов в import.service.ts).
 * Конфигурация: настройки из БД (админка) с fallback на env
 * (LLM_BASE_URL, LLM_API_KEY, LLM_MODEL, LLM_TEMPERATURE).
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  // до 5 минут: reasoning-модели (Gonka MiniMax-M2) долго «думают» перед ответом
  private static readonly TIMEOUT_MS = 300_000;

  // пауза перед повтором при 429 «too many concurrent requests»: чужая генерация
  // (другой HR) успеет освободить слот провайдера
  private static readonly RETRY_429_DELAY_MS = 15_000;

  // пауза перед повтором при ошибке шлюза (5xx): ждать освобождения слота, как при 429,
  // не нужно — это не лимит параллельности, а обрыв на стороне прокси провайдера
  private static readonly RETRY_5XX_DELAY_MS = 5_000;

  constructor(private prisma: PrismaService) {}

  /** Итоговый конфиг: БД → env. null, если не заданы обязательные поля. */
  async getConfig(): Promise<LlmConfig | null> {
    return resolveLlmConfig(await loadLlmSettings(this.prisma));
  }

  async isConfigured(): Promise<boolean> {
    return (await this.getConfig()) != null;
  }

  /**
   * Отправляет system+user и возвращает распарсенный JSON-объект из ответа модели.
   * opts.timeoutSec — таймаут одной попытки (из пресета, по части); null/нет — 300 с.
   */
  async completeJson(system: string, user: string, opts?: { timeoutSec?: number | null }): Promise<unknown> {
    const timeoutMs = (opts?.timeoutSec ?? LlmService.TIMEOUT_MS / 1000) * 1000;
    const cfg = await this.getConfig();
    if (!cfg) {
      throw new ServiceUnavailableException(
        'Генерация отчётов не настроена: задайте подключение к модели в панели администратора',
      );
    }
    const body = {
      model: cfg.model,
      temperature: cfg.temperature,
      // без лимита ключ не отправляем — размер ответа решает провайдер
      ...(cfg.maxTokens != null ? { max_tokens: cfg.maxTokens } : {}),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    };
    // размер промпта — ДО запроса, чтобы строка была видна и при таймауте;
    // оценка токенов грубая: кириллица ≈ 2–4 символа на токен, берём /3
    this.logger.log(
      `LLM: запрос — system=${system.length} симв., user=${user.length} симв., ` +
      `всего ≈${Math.round((system.length + user.length) / 3)} токенов, ` +
      `модель=${cfg.model}, max_tokens=${cfg.maxTokens ?? 'без лимита'}, таймаут=${timeoutMs / 1000}с`,
    );

    // 1 автоповтор ТОЛЬКО при таймауте: ноды Gonka — «лотерея», повтор того же
    // запроса часто попадает на живую ноду (наблюдалось: 300с таймаут → 84с успех)
    let res: Response;
    try {
      res = await this.postJson(cfg, body, timeoutMs);
    } catch (e: any) {
      if (!/таймаут/.test(e?.message ?? '')) throw e;
      this.logger.warn('LLM: таймаут, автоповтор (нода могла зависнуть)');
      res = await this.postJson(cfg, body, timeoutMs);
    }
    // 1 повтор при 429: провайдер не допускает одновременных запросов по ключу —
    // параллельная генерация другого сотрудника освободит слот за паузу
    if (res.status === 429) {
      this.logger.warn(`LLM: 429 (лимит одновременных запросов), пауза ${LlmService.RETRY_429_DELAY_MS / 1000}с и повтор`);
      await new Promise(r => setTimeout(r, LlmService.RETRY_429_DELAY_MS));
      res = await this.postJson(cfg, body, timeoutMs);
    }
    // 1 повтор при ошибке шлюза: перед провайдером стоит прокси (у GonkaRouter —
    // Cloudflare) со своим таймаутом ~2 мин, короче нашего. Долгая генерация приходит
    // как 524 HTML-страницей — модель при этом не отказала, и повтор обычно проходит
    // (наблюдалось: та же часть 125с → 524, а в соседнем прогоне 75с → stop).
    if (res.status >= 500) {
      this.logger.warn(`LLM: HTTP ${res.status} от шлюза (не ответ модели), пауза ${LlmService.RETRY_5XX_DELAY_MS / 1000}с и повтор`);
      await new Promise(r => setTimeout(r, LlmService.RETRY_5XX_DELAY_MS));
      res = await this.postJson(cfg, body, timeoutMs);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`LLM HTTP ${res.status}: ${text.slice(0, 500)}`);
      throw new BadGatewayException(`Сервис генерации недоступен (HTTP ${res.status})`);
    }

    const data: any = await res.json().catch(() => null);
    // расход токенов и причина остановки — для диагностики обрывов на рассуждениях;
    // finish_reason=length означает, что ответ обрезан лимитом (в т.ч. потолком провайдера)
    const usage = data?.usage ?? {};
    const finishReason = data?.choices?.[0]?.finish_reason ?? '—';
    this.logger.log(
      `LLM: модель=${cfg.model}, finish_reason=${finishReason}, ` +
      `prompt=${usage.prompt_tokens ?? '—'}, completion=${usage.completion_tokens ?? '—'}, ` +
      `total=${usage.total_tokens ?? '—'}, запрошенный max_tokens=${cfg.maxTokens ?? 'без лимита'}`,
    );
    const msg = data?.choices?.[0]?.message;
    // reasoning-модели кладут рассуждения в content (<think>…</think>) либо в reasoning_content;
    // ответ ищем сначала в content, при пустом — в reasoning_content как запас.
    const content: unknown = msg?.content;
    const fallback: unknown = msg?.reasoning_content ?? msg?.reasoning;
    const raw = typeof content === 'string' && content.trim() ? content
      : typeof fallback === 'string' && fallback.trim() ? fallback
      : null;
    if (!raw) {
      this.logger.error(`LLM: пустой ответ: ${JSON.stringify(data).slice(0, 500)}`);
      throw new BadGatewayException('Модель вернула пустой ответ');
    }
    return this.parseJson(raw);
  }

  /**
   * Пробное подключение к модели заданным конфигом (для кнопки «Проверить подключение»).
   * Возвращает {ok:false, error} вместо исключения, чтобы UI показал текст ошибки.
   */
  async test(cfg: LlmConfig): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await this.post(cfg, {
        model: cfg.model,
        temperature: cfg.temperature,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { ok: false, error: `HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}` };
      }
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'сетевая ошибка' };
    }
  }

  /** POST с response_format=json_object; не все провайдеры его поддерживают — при 400 повтор без него. */
  private async postJson(cfg: LlmConfig, body: Record<string, unknown>, timeoutMs = LlmService.TIMEOUT_MS): Promise<Response> {
    const res = await this.post(cfg, { ...body, response_format: { type: 'json_object' } }, timeoutMs);
    if (res.status !== 400) return res;
    this.logger.warn('LLM вернул 400 на response_format=json_object, повтор без него');
    return this.post(cfg, body, timeoutMs);
  }

  private async post(cfg: LlmConfig, body: unknown, timeoutMs = LlmService.TIMEOUT_MS): Promise<Response> {
    const baseUrl = cfg.baseUrl.replace(/\/+$/, '');
    try {
      return await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e: any) {
      // fetch кладёт в message только «fetch failed», а настоящую причину (ENOTFOUND —
      // не резолвится домен, ETIMEDOUT/UND_ERR_CONNECT_TIMEOUT — не доходит соединение,
      // ECONNREFUSED — порт закрыт) прячет в e.cause. Без кода по логу не отличить
      // «провайдер лежит» от «сеть до провайдера закрыта» (см. LESSONS 2026-07-28).
      // Текст таймаута НЕ трогаем: по нему ветка автоповтора в completeJson узнаёт таймаут.
      const code = e?.cause?.code ?? e?.code ?? null;
      const reason = e?.name === 'TimeoutError'
        ? 'таймаут запроса'
        : `${e?.message || 'сетевая ошибка'}${code ? ` (${code})` : ''}`;
      this.logger.error(`LLM недоступен: ${reason}`);
      throw new BadGatewayException(`Сервис генерации недоступен: ${reason}`);
    }
  }

  /** Извлекает JSON-объект из ответа модели (см. extractJsonObject); логирует и оборачивает ошибки. */
  private parseJson(content: string): unknown {
    try {
      return extractJsonObject(content);
    } catch (e: any) {
      this.logger.warn(`LLM: ${e?.message ?? 'ошибка разбора'}: ${content.slice(0, 300)}`);
      throw new BadGatewayException(e?.message ?? 'Модель вернула некорректный ответ');
    }
  }
}

/**
 * Убирает рассуждения reasoning-моделей: закрытые блоки <think>…</think> и
 * «висячий» незакрытый <think> при обрыве ответа. Остаётся финальный ответ модели.
 */
export function stripReasoning(content: string): string {
  let s = content.replace(/<think>[\s\S]*?<\/think>/gi, '');
  const open = s.search(/<think>/i);
  if (open !== -1) s = s.slice(0, open); // незакрытый <think> — дальше только рассуждения
  return s.trim();
}

/**
 * Достаёт первый JSON-объект из ответа модели. Сначала срезает рассуждения
 * (иначе фигурные скобки внутри <think> ломают разбор), затем берёт объект по скобкам.
 * Бросает Error с человеко-понятным сообщением при неудаче.
 */
export function extractJsonObject(content: string): unknown {
  const cleaned = stripReasoning(content);
  if (!cleaned) throw new Error('Модель вернула только рассуждения без JSON (увеличьте лимит токенов или смените модель)');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('Модель вернула ответ без JSON');
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw new Error('Модель вернула некорректный JSON');
  }
}
