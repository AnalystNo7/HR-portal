import { BadGatewayException, BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cycle360Report, Report360Status } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { fio } from '../oc360.helpers';
import { ResultsService } from '../results/results.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { LlmService } from './llm.client';
import { buildSystemPrompt, buildUserPrompt, partsForCount } from './report.prompt';
import { isEmptySections, normalizeSections, Report360Sections } from './report.types';

export type ReportResetMode = 'initial' | 'previous';

export interface ReportDto {
  id: string;
  subjectId: string;
  status: Report360Status;
  sections: Report360Sections;
  model: string | null;
  generatedAt: Date | null;
  updatedAt: Date;
  /** Доступен ли откат к первоначальному состоянию (до всех генераций). */
  canResetInitial: boolean;
  /** Доступен ли откат к предыдущей версии (перед последней генерацией), если она отличается от первоначальной. */
  canResetPrevious: boolean;
}

/** Снимок состояния отчёта до генерации (хранится в preGenSnapshot/initialSnapshot). */
interface Snapshot {
  existed: boolean;
  sections?: Report360Sections;
  status?: Report360Status;
  model?: string | null;
  generatedAt?: string | null;
}

function toDto(r: Cycle360Report): ReportDto {
  const initial = r.initialSnapshot as unknown as Snapshot | null;
  const prev = r.preGenSnapshot as unknown as Snapshot | null;
  return {
    id: r.id,
    subjectId: r.subjectId,
    status: r.status,
    sections: r.sections as unknown as Report360Sections,
    model: r.model,
    generatedAt: r.generatedAt,
    updatedAt: r.updatedAt,
    canResetInitial: initial != null,
    // «предыдущая» показывается, только если отличается от первоначальной (после ≥2 генераций)
    canResetPrevious: prev != null && JSON.stringify(prev) !== JSON.stringify(initial),
  };
}

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);
  /** Идущие генерации (по subjectId) — защита от двойного запуска и двойного расхода LLM-токенов. */
  private readonly generating = new Set<string>();

  constructor(
    private prisma: PrismaService,
    private results: ResultsService,
    private llm: LlmService,
    private knowledge: KnowledgeService,
  ) {}

  async getReport(cycleId: string, subjectId: string) {
    const subject = await this.ensureSubject(cycleId, subjectId);
    const report = await this.prisma.cycle360Report.findUnique({ where: { subjectId: subject.id } });
    return { configured: await this.llm.isConfigured(), report: report ? toDto(report) : null };
  }

  /** Генерация черновика LLM. Повторный вызов перезаписывает черновик (статус → DRAFT). */
  async generate(cycleId: string, subjectId: string, authorId: string | null): Promise<ReportDto> {
    await this.ensureSubject(cycleId, subjectId);
    // защита от двойного запуска (двойной клик / параллельный запрос): пока идёт
    // генерация по этому субъекту — второй вызов отклоняется, а не тратит токены повторно
    if (this.generating.has(subjectId)) {
      throw new ConflictException('Генерация отчёта уже выполняется — дождитесь завершения');
    }
    this.generating.add(subjectId);
    try {
      return await this.runGenerate(cycleId, subjectId, authorId);
    } finally {
      this.generating.delete(subjectId);
    }
  }

  private async runGenerate(cycleId: string, subjectId: string, authorId: string | null): Promise<ReportDto> {
    // отчёт в READY неизменяем; проверяем ДО обращения к LLM, чтобы не тратить токены
    const current = await this.prisma.cycle360Report.findUnique({ where: { subjectId }, select: { status: true } });
    if (current?.status === 'READY') {
      throw new BadRequestException('Отчёт отмечен готовым к публикации — верните его в черновик, чтобы сгенерировать заново');
    }
    const { analytics, progress } = await this.results.getAnalytics(cycleId, subjectId);

    const externalDone = progress
      .filter(p => p.role !== 'SELF')
      .reduce((sum, p) => sum + p.completed, 0);
    if (externalDone === 0) {
      throw new BadRequestException('Недостаточно данных: нет завершённых оценок окружения');
    }

    const subj = await this.prisma.cycle360Subject.findUnique({
      where: { id: subjectId },
      include: {
        employee: {
          select: { firstName: true, lastName: true, middleName: true, id: true, position: { select: { name: true } } },
        },
        cycle: { select: { name: true } },
      },
    });
    if (!subj) throw new NotFoundException('Subject not found');

    const cfg = await this.llm.getConfig();
    // база знаний: кастомная/стандартная методика + активные документы
    const ctx = await this.knowledge.getGenerationContext();
    const userPrompt = buildUserPrompt(
      { name: fio(subj.employee), position: subj.employee.position?.name ?? null, cycleName: subj.cycle.name },
      analytics,
    );
    // генерация по частям (splitParts пресета): каждой части — свой запрос со своим
    // лимитом вывода. ПОСЛЕДОВАТЕЛЬНО: Gonka не допускает одновременных запросов
    // по одному ключу (429 too many concurrent requests). Ошибка любой = ошибка всей.
    const parts = partsForCount(cfg?.splitParts ?? 1);
    if (parts.length > 1) this.logger.log(`LLM: генерация отчёта из ${parts.length} частей (последовательно)`);
    const raw: Record<string, unknown> = {};
    for (const [i, keys] of parts.entries()) {
      const rawPart = await this.llm.completeJson(
        buildSystemPrompt(analytics, ctx.methodology, ctx.docs, keys),
        userPrompt,
        { timeoutSec: cfg?.partTimeouts[i] ?? null }, // таймаут попытки из пресета (своё поле у каждой части)
      );
      // из ответа каждой части берём ТОЛЬКО её разделы (модель могла вернуть лишние)
      const part = (rawPart ?? {}) as Record<string, unknown>;
      for (const k of keys) if (k in part) raw[k] = part[k];
    }
    const sections = normalizeSections(raw);
    if (isEmptySections(sections)) {
      throw new BadGatewayException('Модель вернула пустой отчёт — попробуйте ещё раз');
    }

    // снимок состояния до этой генерации — для кнопки «Сброс»
    const prev = await this.prisma.cycle360Report.findUnique({ where: { subjectId } });
    const snapshot: Snapshot = prev
      ? {
          existed: true,
          sections: prev.sections as unknown as Report360Sections,
          status: prev.status,
          model: prev.model,
          generatedAt: prev.generatedAt ? prev.generatedAt.toISOString() : null,
        }
      : { existed: false };
    // первоначальный снимок фиксируется один раз — на первой генерации (далее не перезаписывается)
    const initial = (prev?.initialSnapshot as any) ?? (snapshot as any);

    const report = await this.prisma.cycle360Report.upsert({
      where: { subjectId },
      create: {
        subjectId,
        sections: sections as any,
        status: 'DRAFT',
        model: cfg?.model ?? null,
        generatedAt: new Date(),
        authorId,
        preGenSnapshot: snapshot as any,
        initialSnapshot: initial,
      },
      update: {
        sections: sections as any,
        status: 'DRAFT',
        model: cfg?.model ?? null,
        generatedAt: new Date(),
        authorId,
        preGenSnapshot: snapshot as any,
        initialSnapshot: initial,
      },
    });
    return toDto(report);
  }

  /**
   * Откат отчёта: mode='initial' — к первоначальному состоянию (до всех генераций),
   * mode='previous' — к предыдущей версии (перед последней генерацией).
   * Снимки не обнуляются — якоря остаются точками восстановления до следующей генерации.
   */
  async reset(cycleId: string, subjectId: string, authorId: string | null, mode: ReportResetMode): Promise<ReportDto | null> {
    await this.ensureSubject(cycleId, subjectId);
    const report = await this.prisma.cycle360Report.findUnique({ where: { subjectId } });
    if (!report) {
      throw new BadRequestException('Отчёт ещё не создан — откатывать нечего');
    }
    if (report.status === 'READY') {
      throw new BadRequestException('Отчёт отмечен готовым к публикации — верните его в черновик, чтобы выполнить сброс');
    }
    let rawSnap = mode === 'initial' ? report.initialSnapshot : report.preGenSnapshot;
    // fallback: у «первоначального» нет снимка (переходные строки) — берём «предыдущий» якорь
    if (rawSnap == null && mode === 'initial') rawSnap = report.preGenSnapshot;
    if (rawSnap == null) {
      // сгенерированный отчёт без снимков: сброс = убрать текст LLM (возврат к «Не создан»)
      if (report.generatedAt != null) {
        await this.prisma.cycle360Report.delete({ where: { subjectId } });
        return null;
      }
      throw new BadRequestException('Нет состояния для отката');
    }
    const snap = rawSnap as unknown as Snapshot;

    // до генерации отчёта не было — возвращаемся к «Не создан»
    if (!snap.existed) {
      await this.prisma.cycle360Report.delete({ where: { subjectId } });
      return null;
    }

    // восстанавливаем содержимое выбранного снимка; снимки оставляем как есть
    const restored = await this.prisma.cycle360Report.update({
      where: { subjectId },
      data: {
        sections: normalizeSections(snap.sections ?? {}) as any,
        status: snap.status ?? 'DRAFT',
        model: snap.model ?? null,
        generatedAt: snap.generatedAt ? new Date(snap.generatedAt) : null,
        authorId,
      },
    });
    return toDto(restored);
  }

  /** Сохранение правок HR. Если отчёта ещё нет — создаёт его (ручное заполнение без ИИ). */
  async update(
    cycleId: string,
    subjectId: string,
    dto: { sections?: unknown; status?: Report360Status },
    authorId: string | null,
  ): Promise<ReportDto> {
    await this.ensureSubject(cycleId, subjectId);
    if (dto.status && dto.status !== 'DRAFT' && dto.status !== 'READY') {
      throw new BadRequestException('Некорректный статус отчёта');
    }
    // READY-отчёт неизменяем; разрешён только возврат в черновик
    const current = await this.prisma.cycle360Report.findUnique({ where: { subjectId }, select: { status: true } });
    if (current?.status === 'READY' && dto.status !== 'DRAFT') {
      throw new BadRequestException('Отчёт отмечен готовым к публикации — сначала верните его в черновик');
    }
    const report = await this.prisma.cycle360Report.upsert({
      where: { subjectId },
      create: {
        subjectId,
        sections: normalizeSections(dto.sections ?? {}) as any,
        status: dto.status ?? 'DRAFT',
        authorId,
      },
      update: {
        ...(dto.sections !== undefined ? { sections: normalizeSections(dto.sections) as any } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        authorId,
      },
    });
    return toDto(report);
  }

  async deleteReport(cycleId: string, subjectId: string) {
    await this.ensureSubject(cycleId, subjectId);
    const exists = await this.prisma.cycle360Report.findUnique({ where: { subjectId } });
    if (!exists) throw new NotFoundException('Отчёт ещё не создан');
    await this.prisma.cycle360Report.delete({ where: { subjectId } });
    return { success: true };
  }

  private async ensureSubject(cycleId: string, subjectId: string) {
    const subject = await this.prisma.cycle360Subject.findFirst({ where: { id: subjectId, cycleId } });
    if (!subject) throw new NotFoundException('Subject not found');
    return subject;
  }
}
