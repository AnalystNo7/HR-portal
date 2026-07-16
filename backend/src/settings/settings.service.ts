import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../oc360/report/llm.client';
import { loadLlmSettings, resolveLlmConfig, LlmConfig } from '../oc360/report/llm.config';

export interface LlmSettingsView {
  baseUrl: string;
  apiKeyMasked: string;
  apiKeySet: boolean;
  model: string;
  temperature: number | null;
  configured: boolean;
  /** Источник действующего подключения. */
  source: 'db' | 'env' | 'none';
}

export interface SaveLlmDto {
  baseUrl?: string | null;
  apiKey?: string | null;
  model?: string | null;
  temperature?: number | null;
}

function mask(key: string | null): string {
  if (!key) return '';
  const last4 = key.slice(-4);
  return `••••${last4}`;
}

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService, private llm: LlmService) {}

  /** Вид для админки: сохранённые в БД значения, ключ маскируется. */
  async getLlmView(): Promise<LlmSettingsView> {
    const db = await loadLlmSettings(this.prisma);
    const effective = resolveLlmConfig(db);
    return {
      baseUrl: db?.baseUrl ?? '',
      apiKeyMasked: mask(db?.apiKey ?? null),
      apiKeySet: !!db?.apiKey,
      model: db?.model ?? '',
      temperature: db?.temperature ?? null,
      configured: effective != null,
      source: effective ? effective.source : 'none',
    };
  }

  /** Upsert строки настроек. Пустой apiKey не затирает сохранённый ключ. */
  async saveLlm(dto: SaveLlmDto, adminId: string | null): Promise<LlmSettingsView> {
    const norm = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);
    const baseUrl = norm(dto.baseUrl);
    const model = norm(dto.model);
    const apiKey = norm(dto.apiKey); // undefined/пусто → не менять
    const temperature =
      dto.temperature != null && Number.isFinite(dto.temperature) ? dto.temperature : null;

    await this.prisma.llmSettings.upsert({
      where: { id: 'default' },
      create: { id: 'default', baseUrl, model, temperature, apiKey, updatedById: adminId },
      update: {
        baseUrl,
        model,
        temperature,
        updatedById: adminId,
        ...(apiKey != null ? { apiKey } : {}), // ключ меняем только если прислан новый
      },
    });
    return this.getLlmView();
  }

  /**
   * Проверка подключения. Если в dto есть baseUrl/apiKey/model — тестируем их
   * (до сохранения); иначе — действующий конфиг (БД→env). Пустой apiKey в dto
   * подставляется из сохранённого.
   */
  async testLlm(dto: SaveLlmDto): Promise<{ ok: boolean; error?: string }> {
    let cfg: LlmConfig | null;
    const anyProvided = dto.baseUrl || dto.model || dto.apiKey;
    if (anyProvided) {
      const db = await loadLlmSettings(this.prisma);
      cfg = resolveLlmConfig({
        baseUrl: (dto.baseUrl ?? db?.baseUrl) || null,
        apiKey: (dto.apiKey || db?.apiKey) || null,
        model: (dto.model ?? db?.model) || null,
        temperature: dto.temperature ?? db?.temperature ?? null,
      });
    } else {
      cfg = await this.llm.getConfig();
    }
    if (!cfg) return { ok: false, error: 'Не заполнены обязательные поля (URL, ключ, модель)' };
    return this.llm.test(cfg);
  }
}
