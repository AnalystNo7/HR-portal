import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { fio } from '../oc360.helpers';

export interface SubmitDto {
  scores: { indicatorId: string; score: number }[];
  openAnswer?: { strengths?: string | null; toChange?: string | null; toDevelop?: string | null };
  submit?: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  SELF: 'Самооценка',
  MANAGER: 'Оценка как руководитель',
  SUBORDINATE: 'Оценка руководителя',
  PEER: 'Оценка коллеги',
};

@Injectable()
export class RespondentService {
  constructor(private prisma: PrismaService) {}

  /** «Мои оценки»: назначения текущего сотрудника в активных запусках. */
  async listMine(employeeId: string) {
    const rows = await this.prisma.cycle360Respondent.findMany({
      where: { evaluatorId: employeeId, subject: { cycle: { status: 'ACTIVE' } } },
      include: {
        subject: {
          include: {
            employee: { select: { id: true, firstName: true, lastName: true, middleName: true } },
            cycle: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(r => ({
      id: r.id,
      role: r.role,
      roleLabel: ROLE_LABELS[r.role],
      status: r.status,
      cycle: r.subject.cycle,
      subject: { id: r.subject.employee.id, name: fio(r.subject.employee) },
      isSelf: r.role === 'SELF',
    }));
  }

  /** Форма для заполнения. Доступ: владелец (evaluator) или HR/admin. */
  async getForm(respondentId: string, employeeId: string | null, isHrAdmin: boolean) {
    const respondent = await this.prisma.cycle360Respondent.findUnique({
      where: { id: respondentId },
      include: {
        subject: {
          include: {
            employee: { select: { id: true, firstName: true, lastName: true, middleName: true } },
            cycle: {
              include: {
                competencies: { orderBy: { order: 'asc' }, include: { indicators: { orderBy: { order: 'asc' } } } },
                scalePoints: { orderBy: { value: 'asc' } },
              },
            },
          },
        },
        responses: true,
        openAnswer: true,
      },
    });
    if (!respondent) throw new NotFoundException('Assignment not found');
    if (!isHrAdmin && respondent.evaluatorId !== employeeId) {
      throw new ForbiddenException('Нет доступа к этой оценке');
    }

    const scores: Record<string, number> = {};
    for (const r of respondent.responses) scores[r.indicatorId] = r.score;

    return {
      id: respondent.id,
      role: respondent.role,
      roleLabel: ROLE_LABELS[respondent.role],
      status: respondent.status,
      cycle: { id: respondent.subject.cycle.id, name: respondent.subject.cycle.name },
      subject: { id: respondent.subject.employee.id, name: fio(respondent.subject.employee) },
      competencies: respondent.subject.cycle.competencies,
      scalePoints: respondent.subject.cycle.scalePoints,
      scores,
      openAnswer: respondent.openAnswer
        ? {
            strengths: respondent.openAnswer.strengths,
            toChange: respondent.openAnswer.toChange,
            toDevelop: respondent.openAnswer.toDevelop,
          }
        : { strengths: null, toChange: null, toDevelop: null },
    };
  }

  /** Сохранение черновика / финальная отправка. */
  async submit(respondentId: string, employeeId: string | null, isHrAdmin: boolean, dto: SubmitDto) {
    const respondent = await this.prisma.cycle360Respondent.findUnique({
      where: { id: respondentId },
      include: { subject: { include: { cycle: { select: { status: true } } } } },
    });
    if (!respondent) throw new NotFoundException('Assignment not found');
    if (!isHrAdmin && respondent.evaluatorId !== employeeId) {
      throw new ForbiddenException('Нет доступа к этой оценке');
    }
    if (respondent.subject.cycle.status !== 'ACTIVE') {
      throw new BadRequestException('Оценка доступна только в активном запуске');
    }

    await this.prisma.$transaction(async tx => {
      for (const s of dto.scores ?? []) {
        await tx.indicatorResponse.upsert({
          where: { respondentId_indicatorId: { respondentId, indicatorId: s.indicatorId } },
          update: { score: s.score },
          create: { respondentId, indicatorId: s.indicatorId, score: s.score },
        });
      }
      if (dto.openAnswer) {
        await tx.cycle360OpenAnswer.upsert({
          where: { respondentId },
          update: {
            strengths: dto.openAnswer.strengths,
            toChange: dto.openAnswer.toChange,
            toDevelop: dto.openAnswer.toDevelop,
          },
          create: {
            respondentId,
            strengths: dto.openAnswer.strengths,
            toChange: dto.openAnswer.toChange,
            toDevelop: dto.openAnswer.toDevelop,
          },
        });
      }
      await tx.cycle360Respondent.update({
        where: { id: respondentId },
        data: dto.submit
          ? { status: 'COMPLETED', submittedAt: new Date() }
          : { status: 'IN_PROGRESS' },
      });
    });

    if (dto.submit) await this.refreshSubjectStatus(respondent.subjectId);
    return { success: true, submitted: !!dto.submit };
  }

  /** Если все оценивающие завершили — субъект COMPLETED. */
  private async refreshSubjectStatus(subjectId: string) {
    const respondents = await this.prisma.cycle360Respondent.findMany({
      where: { subjectId },
      select: { status: true },
    });
    const allDone = respondents.length > 0 && respondents.every(r => r.status === 'COMPLETED');
    const subject = await this.prisma.cycle360Subject.findUnique({ where: { id: subjectId }, select: { status: true } });
    if (!subject || subject.status === 'PUBLISHED') return;
    await this.prisma.cycle360Subject.update({
      where: { id: subjectId },
      data: { status: allDone ? 'COMPLETED' : 'IN_PROGRESS' },
    });
  }
}
