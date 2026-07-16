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

  private static readonly TIMEOUT_MS = 120_000;

  constructor(private prisma: PrismaService) {}

  /** Итоговый конфиг: БД → env. null, если не заданы обязательные поля. */
  async getConfig(): Promise<LlmConfig | null> {
    return resolveLlmConfig(await loadLlmSettings(this.prisma));
  }

  async isConfigured(): Promise<boolean> {
    return (await this.getConfig()) != null;
  }

  /** Отправляет system+user и возвращает распарсенный JSON-объект из ответа модели. */
  async completeJson(system: string, user: string): Promise<unknown> {
    const cfg = await this.getConfig();
    if (!cfg) {
      throw new ServiceUnavailableException(
        'Генерация отчётов не настроена: задайте подключение к модели в панели администратора',
      );
    }
    const body = {
      model: cfg.model,
      temperature: cfg.temperature,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    };

    // response_format поддерживают не все совместимые провайдеры — при 400 повторяем без него
    let res = await this.post(cfg, { ...body, response_format: { type: 'json_object' } });
    if (res.status === 400) {
      this.logger.warn('LLM вернул 400 на response_format=json_object, повтор без него');
      res = await this.post(cfg, body);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`LLM HTTP ${res.status}: ${text.slice(0, 500)}`);
      throw new BadGatewayException(`Сервис генерации недоступен (HTTP ${res.status})`);
    }

    const data: any = await res.json().catch(() => null);
    const content: unknown = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      this.logger.error(`LLM: пустой ответ: ${JSON.stringify(data).slice(0, 500)}`);
      throw new BadGatewayException('Модель вернула пустой ответ');
    }
    return this.parseJson(content);
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

  private async post(cfg: LlmConfig, body: unknown): Promise<Response> {
    const baseUrl = cfg.baseUrl.replace(/\/+$/, '');
    try {
      return await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(LlmService.TIMEOUT_MS),
      });
    } catch (e: any) {
      const reason = e?.name === 'TimeoutError' ? 'таймаут запроса' : e?.message || 'сетевая ошибка';
      this.logger.error(`LLM недоступен: ${reason}`);
      throw new BadGatewayException(`Сервис генерации недоступен: ${reason}`);
    }
  }

  /** Извлекает первый JSON-объект из текста (модель может обернуть его в ```json ... ```). */
  private parseJson(content: string): unknown {
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    if (start === -1 || end <= start) {
      this.logger.warn(`LLM: в ответе нет JSON: ${content.slice(0, 300)}`);
      throw new BadGatewayException('Модель вернула некорректный ответ (нет JSON)');
    }
    try {
      return JSON.parse(content.slice(start, end + 1));
    } catch {
      this.logger.warn(`LLM: не удалось распарсить JSON: ${content.slice(0, 300)}`);
      throw new BadGatewayException('Модель вернула некорректный JSON');
    }
  }
}
