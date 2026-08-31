import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Cycle360Status, EvaluatorRole, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { fio } from '../oc360.helpers';

export interface CreateCycleDto {
  name: string;
  description?: string | null;
  year?: number;
  half?: number;
  scaleId: string;
  versionId?: string;
  competencyIds?: string[];
  targetLevel?: number | null;
}

export interface CycleListQuery {
  status?: Cycle360Status;
  page?: number;
  limit?: number;
}

export interface AddRespondentDto {
  evaluatorId: string;
  role: EvaluatorRole;
}

const ROLE_PRIORITY: EvaluatorRole[] = ['SELF', 'MANAGER', 'SUBORDINATE', 'PEER'];

const ROLE_LABELS: Record<EvaluatorRole, string> = {
  SELF: 'Самооценка',
  MANAGER: 'Руководитель',
  SUBORDINATE: 'Подчинённые',
  PEER: 'Коллеги',
};

@Injectable()
export class CycleService {
  constructor(private prisma: PrismaService) {}

  // ─── Список / детали ───────────────────────────
  async findAll(query: CycleListQuery) {
    const { status, page = 1, limit = 20 } = query;
    const where: Prisma.Cycle360WhereInput = {};
    if (status) where.status = status;

    const [rows, total] = await Promise.all([
      this.prisma.cycle360.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: { select: { subjects: true } },
          subjects: { select: { employee: { select: { department: { select: { name: true } } } } } },
        },
      }),
      this.prisma.cycle360.count({ where }),
    ]);
    const data = rows.map(({ subjects, ...rest }) => ({
      ...rest,
      departments: [...new Set(subjects.map(s => s.employee.department?.name ?? '—'))],
    }));
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    const cycle = await this.prisma.cycle360.findUnique({
      where: { id },
      include: {
        competencies: { orderBy: { order: 'asc' }, include: { indicators: { orderBy: { order: 'asc' } } } },
        scalePoints: { orderBy: { value: 'asc' } },
        subjects: {
          include: {
            employee: { select: { id: true, firstName: true, lastName: true, middleName: true } },
            respondents: { select: { id: true, role: true, status: true } },
          },
        },
      },
    });
    if (!cycle) throw new NotFoundException('Cycle not found');
    return cycle;
  }

  // ─── Создание + снапшот шаблона ────────────────
  async create(dto: CreateCycleDto, createdById: string | null) {
    const scale = await this.prisma.scaleTemplate.findUnique({
      where: { id: dto.scaleId },
      include: { points: true },
    });
    if (!scale) throw new NotFoundException('Scale not found');

    const version = dto.versionId
      ? await this.prisma.competencyVersion.findUnique({ where: { id: dto.versionId } })
      : await this.prisma.competencyVersion.findFirst({ where: { isDefault: true } });
    if (!version) throw new NotFoundException('Версия шаблона не найдена');

    const competencies = await this.prisma.competencyTemplate.findMany({
      where: {
        versionId: version.id,
        ...(dto.competencyIds?.length ? { id: { in: dto.competencyIds } } : { isActive: true }),
      },
      orderBy: { order: 'asc' },
      include: { indicators: { orderBy: { order: 'asc' } } },
    });
    if (competencies.length === 0) {
      throw new BadRequestException('Нужно выбрать хотя бы одну компетенцию');
    }
    if (!dto.year || (dto.half !== 1 && dto.half !== 2)) {
      throw new BadRequestException('Укажите год и полугодие');
    }

    return this.prisma.cycle360.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        year: dto.year,
        half: dto.half,
        targetLevel: dto.targetLevel ?? null,
        // снапшот формулировок открытых вопросов версии (null = дефолтные тексты)
        ...(version.openQuestions != null ? { openQuestions: version.openQuestions } : {}),
        createdById: createdById ?? null,
        scalePoints: { create: scale.points.map(p => ({ value: p.value, label: p.label })) },
        competencies: {
          create: competencies.map(c => ({
            sourceId: c.id,
            name: c.name,
            description: c.description,
            category: c.category,
            order: c.order,
            indicators: {
              create: c.indicators.map(i => ({ sourceId: i.id, text: i.text, description: i.description, order: i.order })),
            },
          })),
        },
      },
      include: {
        competencies: { orderBy: { order: 'asc' }, include: { indicators: { orderBy: { order: 'asc' } } } },
        scalePoints: { orderBy: { value: 'asc' } },
      },
    });
  }

  async update(
    id: string,
    dto: { name?: string; description?: string | null; year?: number; half?: number; targetLevel?: number | null },
  ) {
    await this.ensureNotClosed(id);
    return this.prisma.cycle360.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        year: dto.year,
        half: dto.half,
        targetLevel: dto.targetLevel,
      },
    });
  }

  /** Удаление запуска. Завершённый (CLOSED) может удалить только администратор. */
  async delete(id: string, roles: string[] = []) {
    const cycle = await this.prisma.cycle360.findUnique({ where: { id }, select: { status: true } });
    if (!cycle) throw new NotFoundException('Cycle not found');
    if (cycle.status === 'CLOSED' && !roles.includes('admin')) {
      throw new ForbiddenException('Завершённые запуски может удалять только администратор');
    }
    await this.prisma.cycle360.delete({ where: { id } });
    return { success: true };
  }

  async updateCompetency(id: string, competencyId: string, dto: { name?: string; description?: string | null; order?: number }) {
    await this.ensureDraft(id);
    const comp = await this.prisma.cycle360Competency.findFirst({ where: { id: competencyId, cycleId: id } });
    if (!comp) throw new NotFoundException('Competency not found');
    return this.prisma.cycle360Competency.update({
      where: { id: competencyId },
      data: { name: dto.name, description: dto.description, order: dto.order },
    });
  }

  async updateIndicator(id: string, indicatorId: string, dto: { text?: string; order?: number }) {
    await this.ensureDraft(id);
    const ind = await this.prisma.cycle360Indicator.findFirst({
      where: { id: indicatorId, competency: { cycleId: id } },
    });
    if (!ind) throw new NotFoundException('Indicator not found');
    return this.prisma.cycle360Indicator.update({
      where: { id: indicatorId },
      data: { text: dto.text, order: dto.order },
    });
  }

  // ─── Субъекты + авто-подбор оценивающих ────────
  async addSubjects(id: string, employeeIds: string[]) {
    const cycleStatus = await this.ensureNotClosed(id);
    if (!employeeIds?.length) throw new BadRequestException('Не выбраны сотрудники');

    const created = [];
    for (const employeeId of employeeIds) {
      const existing = await this.prisma.cycle360Subject.findUnique({
        where: { cycleId_employeeId: { cycleId: id, employeeId } },
      });
      if (existing) continue;

      const respondents = await this.suggestRespondents(employeeId);
      const subject = await this.prisma.cycle360Subject.create({
        data: {
          cycleId: id,
          employeeId,
          status: cycleStatus === 'ACTIVE' ? 'IN_PROGRESS' : 'PENDING',
          respondents: { create: respondents.map(r => ({ evaluatorId: r.evaluatorId, role: r.role })) },
        },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, middleName: true } },
          respondents: { select: { id: true, role: true, status: true } },
        },
      });
      created.push(subject);
    }
    return created;
  }

  async removeSubject(id: string, subjectId: string) {
    await this.ensureNotClosed(id);
    const subject = await this.prisma.cycle360Subject.findFirst({ where: { id: subjectId, cycleId: id } });
    if (!subject) throw new NotFoundException('Subject not found');
    await this.prisma.cycle360Subject.delete({ where: { id: subjectId } });
    return { success: true };
  }

  /** Авто-подбор из оргструктуры с дедупом по приоритету ролей. */
  async suggestRespondents(subjectEmployeeId: string): Promise<{ evaluatorId: string; role: EvaluatorRole }[]> {
    const subject = await this.prisma.employee.findUnique({
      where: { id: subjectEmployeeId },
      include: { subordinates: { select: { id: true } } },
    });
    if (!subject) throw new NotFoundException('Employee not found');

    const rows: { evaluatorId: string; role: EvaluatorRole }[] = [];
    rows.push({ evaluatorId: subject.id, role: 'SELF' });
    if (subject.managerId) rows.push({ evaluatorId: subject.managerId, role: 'MANAGER' });
    for (const s of subject.subordinates) rows.push({ evaluatorId: s.id, role: 'SUBORDINATE' });

    const subordinateIds = subject.subordinates.map(s => s.id);
    const exclude = [subject.id, ...(subject.managerId ? [subject.managerId] : []), ...subordinateIds];
    const peers = await this.prisma.employee.findMany({
      where: { departmentId: subject.departmentId, id: { notIn: exclude } },
      select: { id: true },
    });
    for (const p of peers) rows.push({ evaluatorId: p.id, role: 'PEER' });

    // дедуп: один человек — одна (наивысшая по приоритету) дорожка
    const seen = new Map<string, EvaluatorRole>();
    for (const r of rows) {
      const cur = seen.get(r.evaluatorId);
      if (!cur || ROLE_PRIORITY.indexOf(r.role) < ROLE_PRIORITY.indexOf(cur)) {
        seen.set(r.evaluatorId, r.role);
      }
    }
    return [...seen.entries()].map(([evaluatorId, role]) => ({ evaluatorId, role }));
  }

  // ─── Респонденты субъекта ──────────────────────
  async getRespondents(id: string, subjectId: string) {
    const subject = await this.prisma.cycle360Subject.findFirst({ where: { id: subjectId, cycleId: id } });
    if (!subject) throw new NotFoundException('Subject not found');
    const respondents = await this.prisma.cycle360Respondent.findMany({
      where: { subjectId },
      include: { evaluator: { select: { id: true, firstName: true, lastName: true, middleName: true } } },
    });
    return ROLE_PRIORITY.map(role => ({
      role,
      label: ROLE_LABELS[role],
      respondents: respondents
        .filter(r => r.role === role)
        .map(r => ({ id: r.id, status: r.status, evaluator: r.evaluator, name: fio(r.evaluator) })),
    }));
  }

  async addRespondent(id: string, subjectId: string, dto: AddRespondentDto) {
    await this.ensureNotClosed(id);
    const subject = await this.prisma.cycle360Subject.findFirst({ where: { id: subjectId, cycleId: id } });
    if (!subject) throw new NotFoundException('Subject not found');
    const existing = await this.prisma.cycle360Respondent.findUnique({
      where: { subjectId_evaluatorId_role: { subjectId, evaluatorId: dto.evaluatorId, role: dto.role } },
    });
    if (existing) throw new BadRequestException('Этот оценивающий уже добавлен в эту дорожку');
    return this.prisma.cycle360Respondent.create({
      data: { subjectId, evaluatorId: dto.evaluatorId, role: dto.role },
      include: { evaluator: { select: { id: true, firstName: true, lastName: true, middleName: true } } },
    });
  }

  async removeRespondent(id: string, respondentId: string) {
    await this.ensureNotClosed(id);
    const respondent = await this.prisma.cycle360Respondent.findFirst({
      where: { id: respondentId, subject: { cycleId: id } },
    });
    if (!respondent) throw new NotFoundException('Respondent not found');
    await this.prisma.cycle360Respondent.delete({ where: { id: respondentId } });
    return { success: true };
  }

  // ─── Жизненный цикл ────────────────────────────
  async activate(id: string) {
    const cycle = await this.prisma.cycle360.findUnique({
      where: { id },
      include: { subjects: { include: { respondents: true } } },
    });
    if (!cycle) throw new NotFoundException('Cycle not found');
    if (cycle.status !== 'DRAFT') throw new BadRequestException('Запуск уже активирован');
    if (cycle.subjects.length === 0) throw new BadRequestException('Нет сотрудников для оценки');

    await this.prisma.$transaction([
      this.prisma.cycle360.update({
        where: { id },
        data: { status: 'ACTIVE', startedAt: new Date() },
      }),
      this.prisma.cycle360Subject.updateMany({
        where: { cycleId: id },
        data: { status: 'IN_PROGRESS' },
      }),
      this.prisma.cycle360Subject.updateMany({
        where: { cycleId: id, managerEditsPeers: false },
        data: { peersConfirmed: true },
      }),
    ]);
    return this.findById(id);
  }

  // ─── Поимённая визуализация воркфлоу (HR/admin) ─
  async workflow(id: string, subjectId: string) {
    const subject = await this.prisma.cycle360Subject.findFirst({
      where: { id: subjectId, cycleId: id },
      include: {
        cycle: { select: { status: true } },
        employee: { select: { id: true, firstName: true, lastName: true, middleName: true } },
        respondents: {
          include: { evaluator: { select: { id: true, firstName: true, lastName: true, middleName: true } } },
        },
      },
    });
    if (!subject) throw new NotFoundException('Subject not found');

    const lanes = ROLE_PRIORITY.map(role => {
      const items = subject.respondents
        .filter(r => r.role === role)
        .map(r => ({ id: r.id, name: fio(r.evaluator), status: r.status }));
      const completed = items.filter(i => i.status === 'COMPLETED').length;
      return { role, label: ROLE_LABELS[role], items, completed, total: items.length, done: items.length > 0 && completed === items.length };
    });

    const allDone = lanes.filter(l => l.total > 0).every(l => l.done) && lanes.some(l => l.total > 0);
    let stage: 'DRAFT' | 'IN_PROGRESS' | 'RESULTS';
    if (subject.cycle.status === 'DRAFT') stage = 'DRAFT';
    else if (allDone) stage = 'RESULTS';
    else stage = 'IN_PROGRESS';

    return {
      subject: { id: subject.id, employee: subject.employee, name: fio(subject.employee), status: subject.status },
      cycleStatus: subject.cycle.status,
      stage,
      published: subject.resultsPublishedAt != null,
      managerEditsPeers: subject.managerEditsPeers,
      lanes,
    };
  }

  async updateSubject(cycleId: string, subjectId: string, dto: { managerEditsPeers?: boolean }) {
    await this.ensureNotClosed(cycleId);
    const subject = await this.prisma.cycle360Subject.findFirst({ where: { id: subjectId, cycleId } });
    if (!subject) throw new NotFoundException('Subject not found');
    return this.prisma.cycle360Subject.update({
      where: { id: subjectId },
      data: { managerEditsPeers: dto.managerEditsPeers },
    });
  }

  private async ensureNotClosed(id: string) {
    const cycle = await this.prisma.cycle360.findUnique({ where: { id }, select: { status: true } });
    if (!cycle) throw new NotFoundException('Cycle not found');
    if (cycle.status === 'CLOSED') {
      throw new BadRequestException('Изменения невозможны в завершённом воркфлоу');
    }
    return cycle.status;
  }

  private async ensureDraft(id: string) {
    const cycle = await this.prisma.cycle360.findUnique({ where: { id }, select: { status: true } });
    if (!cycle) throw new NotFoundException('Cycle not found');
    if (cycle.status !== 'DRAFT') {
      throw new BadRequestException('Изменения возможны только в статусе «черновик»');
    }
  }
}
