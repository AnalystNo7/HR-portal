import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as ExcelJS from 'exceljs';

export interface ParsedRow {
  rowNum: number;
  personnelNumber: string;
  lastName: string;
  firstName: string;
  middleName: string | null;
  email: string;
  position: string;
  department: string;
  hireDate: Date | null;
  managerFio: string | null;
  errors: string[];
}

export interface ImportResult {
  total: number;
  created: number;
  updated: number;
  errors: { row: number; personnelNumber: string; error: string }[];
  managerLinked: number;
  managerNotFound: { row: number; personnelNumber: string; managerFio: string }[];
  managerAmbiguous: { row: number; personnelNumber: string; managerFio: string }[];
  managersRoleAssigned: number;
  keycloakCreated: number;
  keycloakSkipped: number;
  keycloakErrors: { personnelNumber: string; error: string }[];
}

function normalizeFio(fio: string): string {
  return fio.trim().replace(/\s+/g, ' ').toLowerCase();
}

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(private prisma: PrismaService) {}

  async parseExcel(buffer: Buffer): Promise<ParsedRow[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.worksheets[0];
    if (!sheet) return [];

    const headerRow = sheet.getRow(1);
    const colMap: Record<string, number> = {};
    headerRow.eachCell((cell, colNumber) => {
      const val = String(cell.value ?? '').trim().toLowerCase();
      colMap[val] = colNumber;
    });

    const rows: ParsedRow[] = [];

    for (let i = 2; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      const cellVal = (key: string): string => {
        const col = colMap[key];
        if (!col) return '';
        const v = row.getCell(col).value;
        return String(v ?? '').trim();
      };

      const personnelNumber = cellVal('employee_number');
      const fio = cellVal('fio');
      const position = cellVal('position_name');
      const department = cellVal('department_name');
      const email = cellVal('email');
      const managerFio = cellVal('head_fio') || null;

      // Parse FIO
      const fioParts = fio.split(/\s+/);
      const lastName = fioParts[0] || '';
      const firstName = fioParts[1] || '';
      const middleName = fioParts[2] || null;

      // Parse hire date
      let hireDate: Date | null = null;
      const hireDateCol = colMap['data_priema'];
      if (hireDateCol) {
        const raw = row.getCell(hireDateCol).value;
        if (raw instanceof Date) {
          hireDate = raw;
        } else if (typeof raw === 'number') {
          // Excel serial number to JS Date
          hireDate = new Date((raw - 25569) * 86400 * 1000);
        } else if (typeof raw === 'string' && raw.trim()) {
          const parsed = new Date(raw.trim());
          if (!isNaN(parsed.getTime())) hireDate = parsed;
        }
      }

      // Validate
      const errors: string[] = [];
      if (!personnelNumber) errors.push('Нет табельного номера');
      if (!lastName || !firstName) errors.push('Нет ФИО');
      if (!email) errors.push('Нет email');
      if (!position) errors.push('Нет должности');
      if (!department) errors.push('Нет подразделения');

      // Skip completely empty rows
      if (!personnelNumber && !fio && !email) continue;

      rows.push({
        rowNum: i,
        personnelNumber,
        lastName,
        firstName,
        middleName,
        email,
        position,
        department,
        hireDate,
        managerFio,
        errors,
      });
    }

    return rows;
  }

  async executeImport(rows: ParsedRow[]): Promise<ImportResult> {
    const result: ImportResult = {
      total: rows.length,
      created: 0,
      updated: 0,
      errors: [],
      managerLinked: 0,
      managerNotFound: [],
      managerAmbiguous: [],
      managersRoleAssigned: 0,
      keycloakCreated: 0,
      keycloakSkipped: 0,
      keycloakErrors: [],
    };

    const validRows = rows.filter(r => r.errors.length === 0);

    // Resolve department/position strings to FK ids
    const deptNames = [...new Set(validRows.map(r => r.department))];
    const deptMap: Record<string, string> = {};
    for (const name of deptNames) {
      if (!name) continue;
      const dept = await this.prisma.department.upsert({
        where: { name },
        update: {},
        create: { name },
      });
      deptMap[name] = dept.id;
    }

    const posNames = [...new Set(validRows.map(r => r.position))];
    const posMap: Record<string, string> = {};
    for (const name of posNames) {
      if (!name) continue;
      const pos = await this.prisma.position.upsert({
        where: { name },
        update: {},
        create: { name },
      });
      posMap[name] = pos.id;
    }

    // Pass 1: Upsert employees
    for (const row of validRows) {
      try {
        const existing = await this.prisma.employee.findUnique({
          where: { personnelNumber: row.personnelNumber },
        });

        const departmentId = deptMap[row.department];
        const positionId = posMap[row.position];

        await this.prisma.employee.upsert({
          where: { personnelNumber: row.personnelNumber },
          update: {
            lastName: row.lastName,
            firstName: row.firstName,
            middleName: row.middleName,
            email: row.email,
            departmentId,
            positionId,
            hireDate: row.hireDate,
            managerFio: row.managerFio,
          },
          create: {
            personnelNumber: row.personnelNumber,
            lastName: row.lastName,
            firstName: row.firstName,
            middleName: row.middleName,
            email: row.email,
            departmentId,
            positionId,
            hireDate: row.hireDate,
            managerFio: row.managerFio,
          },
        });

        if (existing) {
          result.updated++;
        } else {
          result.created++;
        }
      } catch (e: any) {
        const msg = e.code === 'P2002'
          ? `Дубль уникального поля (${e.meta?.target?.join(', ') || 'unknown'})`
          : e.message;
        result.errors.push({ row: row.rowNum, personnelNumber: row.personnelNumber, error: msg });
      }
    }

    // Mark skipped rows with validation errors
    for (const row of rows) {
      if (row.errors.length > 0) {
        result.errors.push({
          row: row.rowNum,
          personnelNumber: row.personnelNumber || '—',
          error: row.errors.join('; '),
        });
      }
    }

    // Pass 2: Link managers by FIO, resolved to a unique employee record
    const allEmployees = await this.prisma.employee.findMany({
      select: { id: true, lastName: true, firstName: true, middleName: true },
    });
    const byFio = new Map<string, { id: string }[]>();
    for (const e of allEmployees) {
      const key = normalizeFio(`${e.lastName} ${e.firstName} ${e.middleName ?? ''}`);
      const list = byFio.get(key) ?? [];
      list.push({ id: e.id });
      byFio.set(key, list);
    }

    const headIds = new Set<string>();
    for (const row of validRows) {
      if (!row.managerFio) continue;

      const matches = byFio.get(normalizeFio(row.managerFio)) ?? [];

      if (matches.length === 1) {
        await this.prisma.employee.update({
          where: { personnelNumber: row.personnelNumber },
          data: { managerId: matches[0].id },
        });
        headIds.add(matches[0].id);
        result.managerLinked++;
      } else if (matches.length > 1) {
        result.managerAmbiguous.push({
          row: row.rowNum,
          personnelNumber: row.personnelNumber,
          managerFio: row.managerFio,
        });
      } else {
        result.managerNotFound.push({
          row: row.rowNum,
          personnelNumber: row.personnelNumber,
          managerFio: row.managerFio,
        });
      }
    }

    // Pass 3: Create Keycloak users
    await this.createKeycloakUsers(validRows, result);

    // Pass 4: Assign "manager" role to employees who have subordinates
    await this.assignManagerRoles(headIds, result);

    return result;
  }

  private async createKeycloakUsers(rows: ParsedRow[], result: ImportResult): Promise<void> {
    const keycloakUrl = process.env.KEYCLOAK_URL || 'http://localhost:8080';
    const realm = process.env.KEYCLOAK_REALM || 'hr-portal';
    const adminUser = process.env.KEYCLOAK_ADMIN || 'admin';
    const adminPass = process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin';

    // Get admin token
    let adminToken: string;
    try {
      const tokenRes = await fetch(
        `${keycloakUrl}/realms/master/protocol/openid-connect/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'password',
            client_id: 'admin-cli',
            username: adminUser,
            password: adminPass,
          }),
        },
      );
      if (!tokenRes.ok) {
        this.logger.error(`Keycloak admin auth failed: ${tokenRes.status}`);
        result.keycloakErrors.push({ personnelNumber: '*', error: `Не удалось авторизоваться в Keycloak: ${tokenRes.status}` });
        return;
      }
      const tokenData = await tokenRes.json();
      adminToken = tokenData.access_token;
    } catch (e: any) {
      this.logger.error(`Keycloak unreachable: ${e.message}`);
      result.keycloakErrors.push({ personnelNumber: '*', error: `Keycloak недоступен: ${e.message}` });
      return;
    }

    // Get employee role representation
    let employeeRole: any;
    try {
      const roleRes = await fetch(
        `${keycloakUrl}/admin/realms/${realm}/roles/employee`,
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      if (roleRes.ok) {
        employeeRole = await roleRes.json();
      }
    } catch {
      this.logger.warn('Could not fetch employee role from Keycloak');
    }

    const baseUrl = `${keycloakUrl}/admin/realms/${realm}/users`;

    for (const row of rows) {
      try {
        const defaultPassword = row.personnelNumber.replace(/\D/g, '') || row.personnelNumber;

        // Create user
        const createRes = await fetch(baseUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: row.email,
            email: row.email,
            firstName: row.firstName,
            lastName: row.lastName,
            enabled: true,
            credentials: [{
              type: 'password',
              value: defaultPassword,
              temporary: true,
            }],
          }),
        });

        if (createRes.status === 409) {
          // Link keycloakId and reset password for existing user
          const searchRes = await fetch(`${baseUrl}?email=${encodeURIComponent(row.email)}`, {
            headers: { Authorization: `Bearer ${adminToken}` },
          });
          if (searchRes.ok) {
            const users = await searchRes.json();
            if (users.length > 0) {
              const kcUserId = users[0].id;
              await this.prisma.employee.update({
                where: { personnelNumber: row.personnelNumber },
                data: { keycloakId: kcUserId },
              });
              await fetch(`${keycloakUrl}/admin/realms/${realm}/users/${kcUserId}/reset-password`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'password', value: defaultPassword, temporary: true }),
              });
            }
          }
          result.keycloakSkipped++;
          continue;
        }

        if (!createRes.ok) {
          const body = await createRes.text().catch(() => '');
          result.keycloakErrors.push({ personnelNumber: row.personnelNumber, error: `HTTP ${createRes.status}: ${body}` });
          continue;
        }

        // Get the created user's ID
        const searchRes = await fetch(`${baseUrl}?email=${encodeURIComponent(row.email)}`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        if (!searchRes.ok) {
          result.keycloakErrors.push({ personnelNumber: row.personnelNumber, error: 'Не удалось найти созданного пользователя' });
          continue;
        }
        const users = await searchRes.json();
        if (users.length === 0) {
          result.keycloakErrors.push({ personnelNumber: row.personnelNumber, error: 'Пользователь не найден после создания' });
          continue;
        }

        const kcUserId = users[0].id;

        // Assign employee role
        if (employeeRole) {
          await fetch(
            `${keycloakUrl}/admin/realms/${realm}/users/${kcUserId}/role-mappings/realm`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${adminToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify([employeeRole]),
            },
          );
        }

        // Link keycloakId in DB
        await this.prisma.employee.update({
          where: { personnelNumber: row.personnelNumber },
          data: { keycloakId: kcUserId },
        });

        result.keycloakCreated++;
      } catch (e: any) {
        result.keycloakErrors.push({ personnelNumber: row.personnelNumber, error: e.message });
      }
    }
  }

  private async assignManagerRoles(headIds: Set<string>, result: ImportResult): Promise<void> {
    if (headIds.size === 0) return;

    const keycloakUrl = process.env.KEYCLOAK_URL || 'http://localhost:8080';
    const realm = process.env.KEYCLOAK_REALM || 'hr-portal';
    const adminUser = process.env.KEYCLOAK_ADMIN || 'admin';
    const adminPass = process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin';

    let adminToken: string;
    try {
      const tokenRes = await fetch(
        `${keycloakUrl}/realms/master/protocol/openid-connect/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'password',
            client_id: 'admin-cli',
            username: adminUser,
            password: adminPass,
          }),
        },
      );
      if (!tokenRes.ok) {
        result.keycloakErrors.push({ personnelNumber: '*', error: `Не удалось авторизоваться в Keycloak: ${tokenRes.status}` });
        return;
      }
      adminToken = (await tokenRes.json()).access_token;
    } catch (e: any) {
      result.keycloakErrors.push({ personnelNumber: '*', error: `Keycloak недоступен: ${e.message}` });
      return;
    }

    // Get manager role representation
    let managerRole: any;
    try {
      const roleRes = await fetch(`${keycloakUrl}/admin/realms/${realm}/roles/manager`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!roleRes.ok) {
        result.keycloakErrors.push({ personnelNumber: '*', error: `Роль manager не найдена в Keycloak: ${roleRes.status}` });
        return;
      }
      managerRole = await roleRes.json();
    } catch (e: any) {
      result.keycloakErrors.push({ personnelNumber: '*', error: `Не удалось получить роль manager: ${e.message}` });
      return;
    }

    for (const headId of headIds) {
      try {
        const head = await this.prisma.employee.findUnique({
          where: { id: headId },
          select: { keycloakId: true, personnelNumber: true },
        });
        if (!head?.keycloakId) continue;

        await fetch(
          `${keycloakUrl}/admin/realms/${realm}/users/${head.keycloakId}/role-mappings/realm`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify([managerRole]),
          },
        );
        result.managersRoleAssigned++;
      } catch (e: any) {
        result.keycloakErrors.push({ personnelNumber: '*', error: `Роль manager: ${e.message}` });
      }
    }
  }
}
