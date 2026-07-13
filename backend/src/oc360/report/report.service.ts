import { BadGatewayException, BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Cycle360Report, Report360Status } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { fio } from '../oc360.helpers';
import { ResultsService } from '../results/results.service';
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
  };
}

@Injectable()
export class ReportService {
  constructor(
    private prisma: PrismaService,
    private results: ResultsService,
    private llm: LlmService,
  ) {}

  async getReport(cycleId: string, subjectId: string) {
    const subject = await this.ensureSubject(cycleId, subjectId);
    const report = await this.prisma.cycle360Report.findUnique({ where: { subjectId: subject.id } });
    return { configured: this.llm.isConfigured(), report: report ? toDto(report) : null };
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

    const raw = await this.llm.completeJson(
      buildSystemPrompt(analytics),
      buildUserPrompt(
        { name: fio(subj.employee), position: subj.employee.position?.name ?? null, cycleName: subj.cycle.name },
        analytics,
      ),
    );
    const sections = normalizeSections(raw);
    if (isEmptySections(sections)) {
      throw new BadGatewayException('Модель вернула пустой отчёт — попробуйте ещё раз');
    }

    const report = await this.prisma.cycle360Report.upsert({
      where: { subjectId },
      create: {
        subjectId,
        sections: sections as any,
        status: 'DRAFT',
        model: this.llm.model,
        generatedAt: new Date(),
        authorId,
      },
      update: {
        sections: sections as any,
        status: 'DRAFT',
        model: this.llm.model,
        generatedAt: new Date(),
        authorId,
      },
    });
    return toDto(report);
  }

  async update(
    cycleId: string,
    subjectId: string,
    dto: { sections?: unknown; status?: Report360Status },
    authorId: string | null,
  ): Promise<ReportDto> {
    await this.ensureSubject(cycleId, subjectId);
    const exists = await this.prisma.cycle360Report.findUnique({ where: { subjectId } });
    if (!exists) throw new NotFoundException('Отчёт ещё не создан');
    if (dto.status && dto.status !== 'DRAFT' && dto.status !== 'READY') {
      throw new BadRequestException('Некорректный статус отчёта');
    }
    const report = await this.prisma.cycle360Report.update({
      where: { subjectId },
      data: {
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
