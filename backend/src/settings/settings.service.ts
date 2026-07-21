import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../oc360/report/llm.client';
import { clampMaxTokens, clampPartTimeouts, clampSplitParts, isValidPartTimeouts, loadLlmSettings, resolveLlmConfig, LlmConfig } from '../oc360/report/llm.config';

/** Пресет подключения к LLM (ключ наружу — только маской). */
export interface LlmPresetView {
  id: string;
  name: string;
  baseUrl: string;
  apiKeyMasked: string;
  apiKeySet: boolean;
  model: string;
  temperature: number | null;
  maxTokens: number | null;
  /** Генерация отчёта: null/1 — одним запросом, 2/3 — последовательными частями. */
  splitParts: number | null;
  /** Таймауты попыток по частям, сек; null-элемент = 300 с. */
  partTimeouts: (number | null)[];
  isActive: boolean;
}

export interface LlmPresetListView {
  presets: LlmPresetView[];
  /** Источник действующего подключения генерации: активный пресет БД / env / не настроено. */
  source: 'db' | 'env' | 'none';
}

export interface SaveLlmDto {
  name?: string | null;
  baseUrl?: string | null;
  apiKey?: string | null;
  model?: string | null;
  temperature?: number | null;
  maxTokens?: number | null;
  splitParts?: number | null;
  partTimeouts?: (number | null)[] | null;
  /** Для теста существующего пресета: подставить его сохранённый ключ. */
  presetId?: string;
}

function mask(key: string | null): string {
  if (!key) return '';
  const last4 = key.slice(-4);
  return `••••${last4}`;
}

const norm = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService, private llm: LlmService) {}

  private toView(row: {
    id: string; name: string | null; baseUrl: string | null; apiKey: string | null;
    model: string | null; temperature: number | null; maxTokens: number | null;
    splitParts: number | null; partTimeouts: unknown; isActive: boolean;
  }): LlmPresetView {
    return {
      id: row.id,
      name: row.name ?? 'Без названия',
      baseUrl: row.baseUrl ?? '',
      apiKeyMasked: mask(row.apiKey),
      apiKeySet: !!row.apiKey,
      model: row.model ?? '',
      temperature: row.temperature,
      maxTokens: row.maxTokens,
      splitParts: row.splitParts,
      partTimeouts: clampPartTimeouts(row.partTimeouts),
      isActive: row.isActive,
    };
  }

  /**
   * Ленивый бэкфилл легаси-настройки (id="default", до ввода пресетов):
   * если нет ни одного активного пресета, а легаси-строка с данными есть —
   * помечаем её активной с именем «Основная».
   */
  private async ensureActivePreset() {
    const active = await this.prisma.llmSettings.findFirst({ where: { isActive: true }, select: { id: true } });
    if (active) return;
    const legacy = await this.prisma.llmSettings.findUnique({ where: { id: 'default' } });
    if (legacy && (legacy.baseUrl || legacy.apiKey || legacy.model)) {
      await this.prisma.llmSettings.update({
        where: { id: 'default' },
        data: { isActive: true, name: legacy.name ?? 'Основная' },
      });
    }
  }

  /** Список пресетов + источник действующего подключения. */
  async listPresets(): Promise<LlmPresetListView> {
    await this.ensureActivePreset();
    const rows = await this.prisma.llmSettings.findMany({ orderBy: { updatedAt: 'desc' } });
    const effective = resolveLlmConfig(await loadLlmSettings(this.prisma));
    const presets = rows
      .filter(r => r.name != null || r.baseUrl || r.apiKey || r.model) // пустую легаси-строку не показываем
      .sort((a, b) => Number(b.isActive) - Number(a.isActive))
      .map(r => this.toView(r));
    return { presets, source: effective ? effective.source : 'none' };
  }

  /** Таймауты частей: строго 30–600 с (вне диапазона — отказ, не кламп); только видимые поля. */
  private partTimeoutsForSave(dto: SaveLlmDto): (number | null)[] {
    if (!isValidPartTimeouts(dto.partTimeouts)) {
      throw new BadRequestException('Таймаут запроса — от 30 до 600 секунд');
    }
    const list = Array.isArray(dto.partTimeouts) ? dto.partTimeouts : [];
    return list.slice(0, clampSplitParts(dto.splitParts) ?? 1).map(x => (typeof x === 'number' ? x : null));
  }

  /** Создание пресета. Первый созданный (при пустой БД) сразу становится активным. */
  async createPreset(dto: SaveLlmDto, adminId: string | null): Promise<LlmPresetListView> {
    const name = norm(dto.name);
    if (!name) throw new BadRequestException('Укажите название настройки');
    const partTimeouts = this.partTimeoutsForSave(dto); // валидация до обращений к БД
    const hasAny = await this.prisma.llmSettings.findFirst({ select: { id: true } });
    await this.prisma.llmSettings.create({
      data: {
        id: randomUUID(),
        name,
        baseUrl: norm(dto.baseUrl),
        apiKey: norm(dto.apiKey),
        model: norm(dto.model),
        temperature: dto.temperature != null && Number.isFinite(dto.temperature) ? dto.temperature : null,
        maxTokens: clampMaxTokens(dto.maxTokens),
        splitParts: clampSplitParts(dto.splitParts),
        partTimeouts,
        isActive: !hasAny,
        updatedById: adminId,
      },
    });
    return this.listPresets();
  }

  /** Правка пресета. Пустой apiKey не затирает сохранённый ключ. */
  async updatePreset(id: string, dto: SaveLlmDto, adminId: string | null): Promise<LlmPresetListView> {
    const partTimeouts = this.partTimeoutsForSave(dto); // валидация до обращений к БД
    const exists = await this.prisma.llmSettings.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Настройка не найдена');
    const apiKey = norm(dto.apiKey);
    await this.prisma.llmSettings.update({
      where: { id },
      data: {
        ...(norm(dto.name) ? { name: norm(dto.name) } : {}),
        baseUrl: norm(dto.baseUrl),
        model: norm(dto.model),
        temperature: dto.temperature != null && Number.isFinite(dto.temperature) ? dto.temperature : null,
        maxTokens: clampMaxTokens(dto.maxTokens),
        splitParts: clampSplitParts(dto.splitParts),
        partTimeouts,
        updatedById: adminId,
        ...(apiKey != null ? { apiKey } : {}), // ключ меняем только если прислан новый
      },
    });
    return this.listPresets();
  }

  /** Переключение активного пресета (активен всегда ровно один). */
  async activatePreset(id: string, adminId: string | null): Promise<LlmPresetListView> {
    const exists = await this.prisma.llmSettings.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Настройка не найдена');
    await this.prisma.$transaction([
      this.prisma.llmSettings.updateMany({ where: { isActive: true }, data: { isActive: false } }),
      this.prisma.llmSettings.update({ where: { id }, data: { isActive: true, updatedById: adminId } }),
    ]);
    return this.listPresets();
  }

  /** Удаление пресета. Активный удалить нельзя — сначала переключите на другой. */
  async deletePreset(id: string): Promise<LlmPresetListView> {
    const exists = await this.prisma.llmSettings.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Настройка не найдена');
    if (exists.isActive) throw new BadRequestException('Нельзя удалить активную настройку — сначала сделайте активной другую');
    await this.prisma.llmSettings.delete({ where: { id } });
    return this.listPresets();
  }

  /**
   * Проверка подключения. Поля из dto тестируются как есть; пустой ключ
   * добирается из пресета (dto.presetId) либо из действующего подключения.
   */
  async testLlm(dto: SaveLlmDto): Promise<{ ok: boolean; error?: string }> {
    let cfg: LlmConfig | null;
    const anyProvided = dto.baseUrl || dto.model || dto.apiKey;
    if (anyProvided) {
      const stored = dto.presetId
        ? await this.prisma.llmSettings.findUnique({ where: { id: dto.presetId } })
        : null;
      const db = stored ?? (await loadLlmSettings(this.prisma));
      cfg = resolveLlmConfig({
        baseUrl: (norm(dto.baseUrl) ?? db?.baseUrl) || null,
        apiKey: (norm(dto.apiKey) || db?.apiKey) || null,
        model: (norm(dto.model) ?? db?.model) || null,
        temperature: dto.temperature ?? db?.temperature ?? null,
        maxTokens: clampMaxTokens(dto.maxTokens) ?? db?.maxTokens ?? null,
        splitParts: clampSplitParts(dto.splitParts) ?? db?.splitParts ?? null,
        partTimeouts: dto.partTimeouts ?? db?.partTimeouts ?? null,
      });
    } else {
      cfg = await this.llm.getConfig();
    }
    if (!cfg) return { ok: false, error: 'Не заполнены обязательные поля (URL, ключ, модель)' };
    return this.llm.test(cfg);
  }
}
