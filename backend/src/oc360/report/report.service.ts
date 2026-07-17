import { BadGatewayException, BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Cycle360Report, Prisma, Report360Status } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { fio } from '../oc360.helpers';
import { ResultsService } from '../results/results.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { LlmService } from './llm.client';
import { buildSystemPrompt, buildUserPrompt } from './report.prompt';
import { isEmptySections, normalizeSections, Report360Sections } from './report.types';

export interface ReportDto {
  id: string;
  subjectId: string;
  status: Report360Status;
  sections: Report360Sections;
  model: string | null;
  generatedAt: Date | null;
  updatedAt: Date;
  /** Есть ли снимок «до генерации» — можно ли откатить кнопкой «Сброс». */
  canReset: boolean;
}

/** Снимок состояния отчёта до генерации (хранится в preGenSnapshot). */
interface PreGenSnapshot {
  existed: boolean;
  sections?: Report360Sections;
  status?: Report360Status;
  model?: string | null;
  generatedAt?: string | null;
}

function toDto(r: Cycle360Report): ReportDto {
  return {
    id: r.id,
    subjectId: r.subjectId,
    status: r.status,
    sections: r.sections as unknown as Report360Sections,
    model: r.model,
    generatedAt: r.generatedAt,
    updatedAt: r.updatedAt,
    canReset: r.preGenSnapshot != null,
  };
}

@Injectable()
export class ReportService {
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
    const raw = await this.llm.completeJson(
      buildSystemPrompt(analytics, ctx.methodology, ctx.docs),
      buildUserPrompt(
        { name: fio(subj.employee), position: subj.employee.position?.name ?? null, cycleName: subj.cycle.name },
        analytics,
      ),
    );
    const sections = normalizeSections(raw);
    if (isEmptySections(sections)) {
      throw new BadGatewayException('Модель вернула пустой отчёт — попробуйте ещё раз');
    }

    // снимок состояния до генерации — для кнопки «Сброс»
    const prev = await this.prisma.cycle360Report.findUnique({ where: { subjectId } });
    const snapshot: PreGenSnapshot = prev
      ? {
          existed: true,
          sections: prev.sections as unknown as Report360Sections,
          status: prev.status,
          model: prev.model,
          generatedAt: prev.generatedAt ? prev.generatedAt.toISOString() : null,
        }
      : { existed: false };

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
      },
      update: {
        sections: sections as any,
        status: 'DRAFT',
        model: cfg?.model ?? null,
        generatedAt: new Date(),
        authorId,
        preGenSnapshot: snapshot as any,
      },
    });
    return toDto(report);
  }

  /** Откат отчёта к состоянию до последней генерации (кнопка «Сброс»). */
  async reset(cycleId: string, subjectId: string, authorId: string | null): Promise<ReportDto | null> {
    await this.ensureSubject(cycleId, subjectId);
    const report = await this.prisma.cycle360Report.findUnique({ where: { subjectId } });
    if (!report || report.preGenSnapshot == null) {
      throw new BadRequestException('Нет предыдущего состояния для отката');
    }
    const snap = report.preGenSnapshot as unknown as PreGenSnapshot;

    // до генерации отчёта не было — возвращаемся к «Не создан»
    if (!snap.existed) {
      await this.prisma.cycle360Report.delete({ where: { subjectId } });
      return null;
    }

    // восстанавливаем прежнее содержимое и обнуляем снимок (откат израсходован)
    const restored = await this.prisma.cycle360Report.update({
      where: { subjectId },
      data: {
        sections: normalizeSections(snap.sections ?? {}) as any,
        status: snap.status ?? 'DRAFT',
        model: snap.model ?? null,
        generatedAt: snap.generatedAt ? new Date(snap.generatedAt) : null,
        authorId,
        preGenSnapshot: Prisma.DbNull,
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
