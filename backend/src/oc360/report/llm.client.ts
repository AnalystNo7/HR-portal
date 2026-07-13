import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

/**
 * Клиент OpenAI-совместимого chat-completions API на нативном fetch
 * (без новых зависимостей, по образцу Keycloak-вызовов в import.service.ts).
 * Конфигурация через env: LLM_BASE_URL, LLM_API_KEY, LLM_MODEL, LLM_TEMPERATURE.
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  private static readonly TIMEOUT_MS = 120_000;

  isConfigured(): boolean {
    return !!(process.env.LLM_BASE_URL && process.env.LLM_API_KEY && process.env.LLM_MODEL);
  }

  get model(): string {
    return process.env.LLM_MODEL || '';
  }

  /** Отправляет system+user и возвращает распарсенный JSON-объект из ответа модели. */
  async completeJson(system: string, user: string): Promise<unknown> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Генерация отчётов не настроена: задайте LLM_BASE_URL, LLM_API_KEY и LLM_MODEL',
      );
    }
    const body = {
      model: this.model,
      temperature: Number(process.env.LLM_TEMPERATURE ?? 0.3),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    };

    // response_format поддерживают не все совместимые провайдеры — при 400 повторяем без него
    let res = await this.post({ ...body, response_format: { type: 'json_object' } });
    if (res.status === 400) {
      this.logger.warn('LLM вернул 400 на response_format=json_object, повтор без него');
      res = await this.post(body);
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

  private async post(body: unknown): Promise<Response> {
    const baseUrl = (process.env.LLM_BASE_URL || '').replace(/\/+$/, '');
    try {
      return await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.LLM_API_KEY}`,
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
