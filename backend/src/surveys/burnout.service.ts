import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { fio } from '../oc360/oc360.helpers';
import { BurnoutScores, ispOf, levelsOf, validateScores } from './burnout.methodology';

export interface BurnoutDto extends BurnoutScores {
  takenAt: string;
  sourceUrl?: string | null;
  /** HR/admin могут вносить за сотрудника; сотрудник — только за себя. */
  employeeId?: string;
}

export interface BurnoutImportRow {
  rowNum: number;
  personnelNumber: string;
  email: string;
  employeeName: string | null;
  takenAt: string | null;
  exhaustion: number | null;
  depersonalization: number | null;
  reduction: number | null;
  errors: string[];
}

/** Замер + вычисленные уровни и ИСП (производные не хранятся — считаются на лету). */
function enrich(r: {
  id: string; employeeId: string; takenAt: Date; exhaustion: number;
  depersonalization: number; reduction: number; sourceUrl: string | null; source: string;
}) {
  const scores = { exhaustion: r.exhaustion, depersonalization: r.depersonalization, reduction: r.reduction };
  return { ...r, levels: levelsOf(scores), isp: ispOf(scores) };
}

@Injectable()
export class BurnoutService {
  constructor(private prisma: PrismaService) {}

  /** Свои замеры (по возрастанию даты — для динамики). */
  async myResults(employeeId: string | null) {
    if (!employeeId) throw new ForbiddenException('Сотрудник не найден по токену');
    const rows = await this.prisma.burnoutResult.findMany({
      where: { employeeId },
      orderBy: { takenAt: 'asc' },
    });
    return rows.map(enrich);
  }

  /** Внесение замера. Сотрудник — только за себя (владелец проверяется здесь). */
  async create(dto: BurnoutDto, currentEmployeeId: string | null, privileged: boolean) {
    const targetId = privileged && dto.employeeId ? dto.employeeId : currentEmployeeId;
    if (!targetId) throw new ForbiddenException('Сотрудник не найден по токену');
    if (!privileged && dto.employeeId && dto.employeeId !== currentEmployeeId) {
      throw new ForbiddenException('Можно вносить только свои результаты');
    }
    const errors = validateScores(dto);
    const takenAt = dto.takenAt ? new Date(dto.takenAt) : null;
    if (!takenAt || isNaN(takenAt.getTime())) errors.push('Не указана дата прохождения');
    if (errors.length) throw new BadRequestException(errors.join('; '));
    const row = await this.prisma.burnoutResult.create({
      data: {
        employeeId: targetId,
        takenAt: takenAt!,
        exhaustion: dto.exhaustion,
        depersonalization: dto.depersonalization,
        reduction: dto.reduction,
        sourceUrl: dto.sourceUrl?.trim() || null,
        source: 'MANUAL',
        createdById: currentEmployeeId,
      },
    });
    return enrich(row);
  }

  /** Правка/удаление — только HR/admin (решение заказчика 2026-08-17). */
  async update(id: string, dto: Partial<BurnoutDto>) {
    const existing = await this.prisma.burnoutResult.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Замер не найден');
    const scores: BurnoutScores = {
      exhaustion: dto.exhaustion ?? existing.exhaustion,
      depersonalization: dto.depersonalization ?? existing.depersonalization,
      reduction: dto.reduction ?? existing.reduction,
    };
    const errors = validateScores(scores);
    if (errors.length) throw new BadRequestException(errors.join('; '));
    const row = await this.prisma.burnoutResult.update({
      where: { id },
      data: {
        ...scores,
        ...(dto.takenAt ? { takenAt: new Date(dto.takenAt) } : {}),
        ...(dto.sourceUrl !== undefined ? { sourceUrl: dto.sourceUrl?.trim() || null } : {}),
      },
    });
    return enrich(row);
  }

  async remove(id: string) {
    const existing = await this.prisma.burnoutResult.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Замер не найден');
    await this.prisma.burnoutResult.delete({ where: { id } });
    return { success: true };
  }

  /** HR/admin: последний замер каждого сотрудника + история по запросу. */
  async overview(departmentId?: string) {
    const employees = await this.prisma.employee.findMany({
      where: departmentId ? { departmentId } : undefined,
      select: {
        id: true, lastName: true, firstName: true, middleName: true,
        department: { select: { name: true } },
        burnoutResults: { orderBy: { takenAt: 'desc' }, take: 1 },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    return employees.map(e => ({
      employeeId: e.id,
      name: fio(e),
      department: e.department?.name ?? '—',
      last: e.burnoutResults[0] ? enrich(e.burnoutResults[0]) : null,
    }));
  }

  async history(employeeId: string) {
    const rows = await this.prisma.burnoutResult.findMany({
      where: { employeeId },
      orderBy: { takenAt: 'asc' },
    });
    return rows.map(enrich);
  }

  /**
   * Руководитель: подчинённые с уровнями последнего замера БЕЗ баллов и ИСП —
   * фильтрация на сервере, а не в UI (иначе обходится прямым запросом).
   */
  async teamLevels(managerEmployeeId: string | null) {
    if (!managerEmployeeId) throw new ForbiddenException('Сотрудник не найден по токену');
    const team = await this.prisma.employee.findMany({
      where: { managerId: managerEmployeeId },
      select: {
        id: true, lastName: true, firstName: true, middleName: true,
        burnoutResults: { orderBy: { takenAt: 'desc' }, take: 1 },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    return team.map(e => {
      const last = e.burnoutResults[0];
      return {
        employeeId: e.id,
        name: fio(e),
        takenAt: last?.takenAt ?? null,
        levels: last
          ? levelsOf({ exhaustion: last.exhaustion, depersonalization: last.depersonalization, reduction: last.reduction })
          : null,
      };
    });
  }

  // ─── Excel-загрузка (паттерн импорта сотрудников: предпросмотр → выполнение) ───

  /** Колонки: employee_number ИЛИ email; date; exhaustion; depersonalization; reduction. */
  async parseExcel(buffer: Buffer): Promise<BurnoutImportRow[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.worksheets[0];
    if (!sheet) return [];

    const colMap: Record<string, number> = {};
    sheet.getRow(1).eachCell((cell, colNumber) => {
      colMap[String(cell.value ?? '').trim().toLowerCase()] = colNumber;
    });

    const rows: BurnoutImportRow[] = [];
    for (let i = 2; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      const cellVal = (key: string): string => {
        const col = colMap[key];
        if (!col) return '';
        return String(row.getCell(col).value ?? '').trim();
      };
      const num = (key: string): number | null => {
        const raw = cellVal(key);
        if (!raw) return null;
        const n = Number(raw.replace(',', '.'));
        return Number.isFinite(n) ? n : null;
      };

      const personnelNumber = cellVal('employee_number');
      const email = cellVal('email');
      const exhaustion = num('exhaustion');
      const depersonalization = num('depersonalization');
      const reduction = num('reduction');

      // дата: Date-ячейка, excel-серийный номер или строка
      let takenAt: string | null = null;
      const dateCol = colMap['date'];
      if (dateCol) {
        const raw = row.getCell(dateCol).value;
        if (raw instanceof Date) takenAt = raw.toISOString();
        else if (typeof raw === 'number') takenAt = new Date((raw - 25569) * 86400 * 1000).toISOString();
        else if (typeof raw === 'string' && raw.trim()) {
          const parsed = new Date(raw.trim());
          if (!isNaN(parsed.getTime())) takenAt = parsed.toISOString();
        }
      }

      if (!personnelNumber && !email && exhaustion == null) continue; // пустая строка

      const errors: string[] = [];
      let employeeName: string | null = null;
      const employee = personnelNumber
        ? await this.prisma.employee.findUnique({ where: { personnelNumber } })
        : email
          ? await this.prisma.employee.findUnique({ where: { email } })
          : null;
      if (!employee) errors.push('Сотрудник не найден (по табельному/email)');
      else employeeName = fio(employee);
      if (!takenAt) errors.push('Нет даты (колонка date)');
      if (exhaustion == null || depersonalization == null || reduction == null) {
        errors.push('Не все баллы заполнены (exhaustion, depersonalization, reduction)');
      } else {
        errors.push(...validateScores({ exhaustion, depersonalization, reduction }));
      }

      rows.push({
        rowNum: i, personnelNumber, email, employeeName,
        takenAt, exhaustion, depersonalization, reduction, errors,
      });
    }
    return rows;
  }

  async executeImport(rows: BurnoutImportRow[], currentEmployeeId: string | null) {
    const result = { total: rows.length, created: 0, errors: [] as { row: number; error: string }[] };
    for (const row of rows) {
      if (row.errors.length) {
        result.errors.push({ row: row.rowNum, error: row.errors.join('; ') });
        continue;
      }
      const employee = row.personnelNumber
        ? await this.prisma.employee.findUnique({ where: { personnelNumber: row.personnelNumber } })
        : await this.prisma.employee.findUnique({ where: { email: row.email } });
      if (!employee) {
        result.errors.push({ row: row.rowNum, error: 'Сотрудник не найден' });
        continue;
      }
      await this.prisma.burnoutResult.create({
        data: {
          employeeId: employee.id,
          takenAt: new Date(row.takenAt!),
          exhaustion: row.exhaustion!,
          depersonalization: row.depersonalization!,
          reduction: row.reduction!,
          source: 'IMPORT',
          createdById: currentEmployeeId,
        },
      });
      result.created++;
    }
    return result;
  }
}
