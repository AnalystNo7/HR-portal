import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EvaluatorRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { fio } from '../oc360.helpers';
import {
  avg,
  buildAnalytics,
  round2,
  AnalyticsInput,
  DEFAULT_TARGET_LEVEL,
  ZONE_EPS,
} from './analytics';

@Injectable()
export class ResultsService {
  constructor(private prisma: PrismaService) {}

  /** Полная аналитика для HR (с поимённой расшифровкой открытых ответов руководителя/самооценки). */
  async getResults(cycleId: string, subjectId: string) {
    return this.computeResults(cycleId, subjectId, false, true);
  }

  /** Аналитика по методике для генерации отчёта (комментарии без имён). */
  async getAnalytics(cycleId: string, subjectId: string) {
    const res = await this.computeResults(cycleId, subjectId, true, true);
    return { subject: res.subject, analytics: res.analytics!, progress: res.progress };
  }

  /** Свои опубликованные результаты — агрегированно и анонимно. */
  async getMyResults(cycleId: string, subjectId: string, employeeId: string | null) {
    const subject = await this.prisma.cycle360Subject.findFirst({
      where: { id: subjectId, cycleId },
      select: { employeeId: true, resultsPublishedAt: true },
    });
    if (!subject) throw new NotFoundException('Subject not found');
    if (subject.employeeId !== employeeId) throw new ForbiddenException('Нет доступа');
    if (!subject.resultsPublishedAt) throw new ForbiddenException('Результаты ещё не опубликованы');
    const res = await this.computeResults(cycleId, subjectId, true);
    // отчёт виден сотруднику только в статусе READY
    const report = await this.prisma.cycle360Report.findUnique({ where: { subjectId } });
    return {
      ...res,
      report:
        report && report.status === 'READY'
          ? { sections: report.sections, generatedAt: report.generatedAt }
          : null,
    };
  }

  /** Список «моих» субъектов с признаком публикации (для вкладки сотрудника). */
  async listMySubjects(employeeId: string) {
    const subjects = await this.prisma.cycle360Subject.findMany({
      where: { employeeId, resultsPublishedAt: { not: null } },
      include: { cycle: { select: { id: true, name: true } } },
      orderBy: { resultsPublishedAt: 'desc' },
    });
    return subjects.map(s => ({ subjectId: s.id, cycle: s.cycle, publishedAt: s.resultsPublishedAt }));
  }

  private async computeResults(
    cycleId: string,
    subjectId: string,
    anonymized: boolean,
    withAnalytics = false,
  ) {
    const subject = await this.prisma.cycle360Subject.findFirst({
      where: { id: subjectId, cycleId },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, middleName: true } },
        cycle: {
          include: {
            competencies: { orderBy: { order: 'asc' }, include: { indicators: { orderBy: { order: 'asc' } } } },
            scalePoints: { orderBy: { value: 'asc' } },
          },
        },
        respondents: {
          include: {
            responses: true,
            openAnswer: true,
            evaluator: { select: { id: true, firstName: true, lastName: true, middleName: true } },
          },
        },
      },
    });
    if (!subject) throw new NotFoundException('Subject not found');

    // indicator -> competency
    const indicatorToComp = new Map<string, string>();
    for (const c of subject.cycle.competencies) {
      for (const i of c.indicators) indicatorToComp.set(i.id, c.id);
    }

    // lane -> compId -> scores[]
    const perLane = new Map<EvaluatorRole, Map<string, number[]>>();
    const completed = subject.respondents.filter(r => r.status === 'COMPLETED');
    for (const r of completed) {
      let laneMap = perLane.get(r.role);
      if (!laneMap) { laneMap = new Map(); perLane.set(r.role, laneMap); }
      for (const resp of r.responses) {
        const compId = indicatorToComp.get(resp.indicatorId);
        if (!compId) continue;
        if (!laneMap.has(compId)) laneMap.set(compId, []);
        laneMap.get(compId)!.push(resp.score);
      }
    }

    const laneScores = (role: EvaluatorRole, compId: string) => perLane.get(role)?.get(compId) ?? [];

    const competencyResults = subject.cycle.competencies.map(c => {
      const self = avg(laneScores('SELF', c.id));
      const manager = avg(laneScores('MANAGER', c.id));
      const peers = avg(laneScores('PEER', c.id));
      const subordinates = avg(laneScores('SUBORDINATE', c.id));
      const othersScores = [
        ...laneScores('MANAGER', c.id),
        ...laneScores('PEER', c.id),
        ...laneScores('SUBORDINATE', c.id),
      ];
      const othersAvg = avg(othersScores);
      const gap = self != null && othersAvg != null ? round2(self - othersAvg) : null;
      // «Итоговая (средняя)» — среднее доступных групповых оценок (само + руководитель + коллеги + подчинённые)
      const total = avg([self, manager, peers, subordinates].filter((v): v is number => v != null));
      let zone: 'CONSENSUS' | 'BLIND_SPOT' | 'HIDDEN_POTENTIAL' | null = null;
      if (self != null && othersAvg != null) {
        if (self > othersAvg + ZONE_EPS) zone = 'BLIND_SPOT';
        else if (self < othersAvg - ZONE_EPS) zone = 'HIDDEN_POTENTIAL';
        else zone = 'CONSENSUS';
      }
      return { id: c.id, name: c.name, category: c.category, self, manager, peers, subordinates, othersAvg, total, gap, zone };
    });

    const allSelf = competencyResults.map(c => c.self).filter((v): v is number => v != null);
    const allOthers = competencyResults.map(c => c.othersAvg).filter((v): v is number => v != null);
    const selfAvg = avg(allSelf);
    const othersAvg = avg(allOthers);
    const overall = {
      selfAvg,
      othersAvg,
      gap: selfAvg != null && othersAvg != null ? round2(selfAvg - othersAvg) : null,
    };

    // открытые ответы по дорожкам; в анонимном виде PEER/SUBORDINATE без имён
    const openAnswers = (['SELF', 'MANAGER', 'PEER', 'SUBORDINATE'] as EvaluatorRole[]).map(role => {
      const anonymousLane = anonymized && (role === 'PEER' || role === 'SUBORDINATE');
      const items = completed
        .filter(r => r.role === role && r.openAnswer)
        .map(r => ({
          author: anonymousLane ? null : fio(r.evaluator),
          strengths: r.openAnswer!.strengths,
          toChange: r.openAnswer!.toChange,
          toDevelop: r.openAnswer!.toDevelop,
        }))
        .filter(a => a.strengths || a.toChange || a.toDevelop);
      return { role, items };
    });

    // прогресс по дорожкам (для HR-вида)
    const progress = (['SELF', 'MANAGER', 'PEER', 'SUBORDINATE'] as EvaluatorRole[]).map(role => {
      const all = subject.respondents.filter(r => r.role === role);
      return { role, completed: all.filter(r => r.status === 'COMPLETED').length, total: all.length };
    });

    // аналитика по методике (дисперсия, категории Δ, целевой уровень, выбросы) —
    // для HR-вида и промпта генерации отчёта; сотруднику не отдаётся
    let targetLevel: number | undefined;
    let analytics: ReturnType<typeof buildAnalytics> | undefined;
    if (withAnalytics) {
      targetLevel = subject.cycle.targetLevel ?? DEFAULT_TARGET_LEVEL;
      const indicatorText = new Map<string, string>();
      for (const c of subject.cycle.competencies) {
        for (const i of c.indicators) indicatorText.set(i.id, i.text);
      }
      // средние каждого респондента по компетенции + баллы индикаторов (для выбросов)
      const respondentMeans = new Map<string, Map<EvaluatorRole, number[]>>();
      const indicatorScores = new Map<string, { role: EvaluatorRole; indicatorText: string; score: number }[]>();
      for (const r of completed) {
        const perComp = new Map<string, number[]>();
        for (const resp of r.responses) {
          const compId = indicatorToComp.get(resp.indicatorId);
          if (!compId) continue;
          if (!perComp.has(compId)) perComp.set(compId, []);
          perComp.get(compId)!.push(resp.score);
          if (!indicatorScores.has(compId)) indicatorScores.set(compId, []);
          indicatorScores.get(compId)!.push({
            role: r.role,
            indicatorText: indicatorText.get(resp.indicatorId) ?? '',
            score: resp.score,
          });
        }
        for (const [compId, scores] of perComp) {
          if (!respondentMeans.has(compId)) respondentMeans.set(compId, new Map());
          const byRole = respondentMeans.get(compId)!;
          if (!byRole.has(r.role)) byRole.set(r.role, []);
          byRole.get(r.role)!.push(round2(scores.reduce((a, b) => a + b, 0) / scores.length));
        }
      }
      const roles = ['SELF', 'MANAGER', 'PEER', 'SUBORDINATE'] as EvaluatorRole[];
      const scaleValues = subject.cycle.scalePoints.map(p => p.value);
      const input: AnalyticsInput = {
        targetLevel,
        scaleMin: scaleValues.length ? Math.min(...scaleValues) : 1,
        scaleMax: scaleValues.length ? Math.max(...scaleValues) : 4,
        competencies: subject.cycle.competencies.map(c => ({
          id: c.id,
          name: c.name,
          category: c.category,
          description: c.description,
          scoresByRole: Object.fromEntries(
            roles.map(role => [role, laneScores(role, c.id)]),
          ) as Record<EvaluatorRole, number[]>,
          respondentMeansByRole: Object.fromEntries(
            roles.map(role => [role, respondentMeans.get(c.id)?.get(role) ?? []]),
          ) as Record<EvaluatorRole, number[]>,
          indicatorScores: indicatorScores.get(c.id) ?? [],
        })),
        openAnswers: roles.map(role => {
          const lane = completed.filter(r => r.role === role && r.openAnswer);
          return {
            role,
            strengths: lane.map(r => r.openAnswer!.strengths).filter((s): s is string => !!s),
            toChange: lane.map(r => r.openAnswer!.toChange).filter((s): s is string => !!s),
            toDevelop: lane.map(r => r.openAnswer!.toDevelop).filter((s): s is string => !!s),
          };
        }),
      };
      analytics = buildAnalytics(input);
    }

    return {
      // undefined-поля отбрасываются при JSON-сериализации (только для HR-вида)
      targetLevel,
      analytics,
      subject: { id: subject.id, employee: subject.employee, name: fio(subject.employee), status: subject.status },
      published: subject.resultsPublishedAt != null,
      scalePoints: subject.cycle.scalePoints,
      competencyResults,
      overall,
      openAnswers,
      progress,
    };
  }

  // ─── Публикация ────────────────────────────────
  async publish(cycleId: string, subjectId: string) {
    const subject = await this.ensureSubject(cycleId, subjectId);
    const updated = await this.prisma.cycle360Subject.update({
      where: { id: subject.id },
      data: { resultsPublishedAt: new Date(), status: 'PUBLISHED' },
    });
    const unpublished = await this.prisma.cycle360Subject.count({
      where: { cycleId, status: { not: 'PUBLISHED' } },
    });
    if (unpublished === 0) {
      await this.prisma.cycle360.update({
        where: { id: cycleId },
        data: { status: 'CLOSED', closedAt: new Date() },
      });
    }
    return updated;
  }

  async unpublish(cycleId: string, subjectId: string) {
    const subject = await this.ensureSubject(cycleId, subjectId);
    const respondents = await this.prisma.cycle360Respondent.findMany({
      where: { subjectId: subject.id }, select: { status: true },
    });
    const allDone = respondents.length > 0 && respondents.every(r => r.status === 'COMPLETED');
    const updated = await this.prisma.cycle360Subject.update({
      where: { id: subject.id },
      data: { resultsPublishedAt: null, status: allDone ? 'COMPLETED' : 'IN_PROGRESS' },
    });
    const cycle = await this.prisma.cycle360.findUnique({
      where: { id: cycleId }, select: { status: true },
    });
    if (cycle?.status === 'CLOSED') {
      await this.prisma.cycle360.update({
        where: { id: cycleId },
        data: { status: 'ACTIVE', closedAt: null },
      });
    }
    return updated;
  }

  private async ensureSubject(cycleId: string, subjectId: string) {
    const subject = await this.prisma.cycle360Subject.findFirst({ where: { id: subjectId, cycleId } });
    if (!subject) throw new NotFoundException('Subject not found');
    return subject;
  }
}
