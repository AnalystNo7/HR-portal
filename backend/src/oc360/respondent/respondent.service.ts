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
      subjectId: r.subject.id,
      managerEditsPeers: r.subject.managerEditsPeers,
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

  // ─── Управление коллегами (для руководителя) ───
  async listPeers(subjectId: string, managerId: string) {
    const subject = await this.prisma.cycle360Subject.findUnique({
      where: { id: subjectId },
      include: { cycle: { select: { status: true } } },
    });
    if (!subject) throw new NotFoundException('Subject not found');
    if (!subject.managerEditsPeers) throw new ForbiddenException('Управление коллегами отключено');
    const mgr = await this.prisma.cycle360Respondent.findFirst({
      where: { subjectId, evaluatorId: managerId, role: 'MANAGER' },
    });
    if (!mgr) throw new ForbiddenException('Вы не являетесь руководителем этого сотрудника');
    const peers = await this.prisma.cycle360Respondent.findMany({
      where: { subjectId, role: 'PEER' },
      include: { evaluator: { select: { id: true, firstName: true, lastName: true, middleName: true } } },
    });
    return peers.map(p => ({ id: p.id, evaluator: p.evaluator, name: fio(p.evaluator), status: p.status }));
  }

  async addPeer(subjectId: string, managerId: string, evaluatorId: string) {
    const subject = await this.prisma.cycle360Subject.findUnique({
      where: { id: subjectId },
      include: { cycle: { select: { status: true } } },
    });
    if (!subject) throw new NotFoundException('Subject not found');
    if (subject.cycle.status !== 'ACTIVE') throw new BadRequestException('Оценка не активна');
    if (!subject.managerEditsPeers) throw new ForbiddenException('Управление коллегами отключено');
    const mgr = await this.prisma.cycle360Respondent.findFirst({
      where: { subjectId, evaluatorId: managerId, role: 'MANAGER' },
    });
    if (!mgr) throw new ForbiddenException('Вы не являетесь руководителем этого сотрудника');
    const existing = await this.prisma.cycle360Respondent.findUnique({
      where: { subjectId_evaluatorId_role: { subjectId, evaluatorId, role: 'PEER' } },
    });
    if (existing) throw new BadRequestException('Этот оценивающий уже добавлен');
    return this.prisma.cycle360Respondent.create({
      data: { subjectId, evaluatorId, role: 'PEER' },
      include: { evaluator: { select: { id: true, firstName: true, lastName: true, middleName: true } } },
    });
  }

  async removePeer(subjectId: string, managerId: string, respondentId: string) {
    const respondent = await this.prisma.cycle360Respondent.findFirst({
      where: { id: respondentId, subjectId, role: 'PEER' },
      include: { subject: { include: { cycle: { select: { status: true } } } } },
    });
    if (!respondent) throw new NotFoundException('Respondent not found');
    if (respondent.subject.cycle.status !== 'ACTIVE') throw new BadRequestException('Оценка не активна');
    if (!respondent.subject.managerEditsPeers) throw new ForbiddenException('Управление коллегами отключено');
    const mgr = await this.prisma.cycle360Respondent.findFirst({
      where: { subjectId, evaluatorId: managerId, role: 'MANAGER' },
    });
    if (!mgr) throw new ForbiddenException('Вы не являетесь руководителем этого сотрудника');
    await this.prisma.cycle360Respondent.delete({ where: { id: respondentId } });
    return { success: true };
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
