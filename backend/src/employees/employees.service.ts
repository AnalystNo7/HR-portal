import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface EmployeeListQuery {
  page?: number;
  limit?: number;
  search?: string;
  department?: string;
  departmentId?: string;
  managerId?: string;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
}

function normalizeFio(fio: string): string {
  return fio.trim().replace(/\s+/g, ' ').toLowerCase();
}

const MAX_PAGE_SIZE = 100;
/** Разрешённые поля сортировки (защита от произвольного orderBy). */
const SORTABLE = new Set(['lastName', 'firstName', 'middleName', 'email', 'hireDate', 'createdAt']);

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(query: EmployeeListQuery) {
    const {
      page = 1,
      search,
      department,
      departmentId,
      managerId,
      sortField = 'lastName',
      sortOrder = 'asc',
    } = query;
    const limit = Math.min(Math.max(query.limit ?? 10, 1), MAX_PAGE_SIZE);
    const safeSortField = SORTABLE.has(sortField) ? sortField : 'lastName';
    const safeSortOrder = sortOrder === 'desc' ? 'desc' : 'asc';

    const where: Prisma.EmployeeWhereInput = {};

    if (search) {
      where.OR = [
        { lastName: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { middleName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { position: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (department) where.department = { name: department };
    if (departmentId) where.departmentId = departmentId;
    if (managerId) where.managerId = managerId;

    const orderBy: Prisma.EmployeeOrderByWithRelationInput = {
      [safeSortField]: safeSortOrder,
    };

    const [data, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          department: true,
          position: true,
          manager: { select: { id: true, lastName: true, firstName: true, middleName: true } },
        },
      }),
      this.prisma.employee.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  findById(id: string) {
    return this.prisma.employee.findUnique({
      where: { id },
      include: {
        department: true,
        position: true,
        workExperiences: { orderBy: { startDate: 'desc' } },
        educations: { orderBy: { yearCompleted: 'desc' } },
      },
    });
  }

  async getDepartments(): Promise<string[]> {
    const rows = await this.prisma.department.findMany({
      orderBy: { name: 'asc' },
    });
    return rows.map((r) => r.name);
  }

  async create(data: {
    personnelNumber: string;
    lastName: string;
    firstName: string;
    middleName?: string;
    email: string;
    departmentId?: string;
    positionId?: string;
    hireDate?: string;
    managerId?: string;
  }) {
    // минимум проверяется на сервере — UI-валидация обходится прямым запросом
    const missing: string[] = [];
    if (!data.personnelNumber?.trim()) missing.push('табельный номер');
    if (!data.lastName?.trim()) missing.push('фамилия');
    if (!data.firstName?.trim()) missing.push('имя');
    if (!data.email?.trim()) missing.push('email');
    if (missing.length) {
      throw new BadRequestException(`Не заполнены обязательные поля: ${missing.join(', ')}`);
    }
    let employee;
    try {
      employee = await this.prisma.employee.create({
        data: {
          personnelNumber: data.personnelNumber,
          lastName: data.lastName,
          firstName: data.firstName,
          middleName: data.middleName ?? null,
          email: data.email,
          departmentId: data.departmentId || null,
          positionId: data.positionId || null,
          hireDate: data.hireDate ? new Date(data.hireDate) : null,
          managerId: data.managerId ?? null,
        },
        include: { department: true, position: true },
      });
    } catch (e: any) {
      throw this.mapUniqueError(e);
    }

    // Заводим учётную запись в Keycloak, чтобы сотрудник мог войти
    // (логин = email, временный пароль = цифры табельного номера, роль employee).
    // Best-effort: если Keycloak недоступен, сотрудник всё равно создан, доступ
    // можно выдать позже через reset-password.
    try {
      const password = employee.personnelNumber.replace(/\D/g, '') || employee.personnelNumber;
      this.logger.log(`Создаём учётку Keycloak: username=${employee.email}, email=${employee.email}, KEYCLOAK_URL=${process.env.KEYCLOAK_URL || 'http://localhost:8080 (default)'}`);
      const token = await this.getKeycloakAdminToken();
      const kcId = await this.createKeycloakUser(employee, password, token);
      employee = await this.prisma.employee.update({
        where: { id: employee.id },
        data: { keycloakId: kcId },
        include: { department: true, position: true },
      });
      this.logger.log(`Учётка Keycloak создана: keycloakId=${kcId}`);
    } catch (e: any) {
      this.logger.error(`НЕ удалось создать учётную запись Keycloak для ${employee.personnelNumber}: ${e.message}`, e.stack);
    }

    return employee;
  }

  private mapUniqueError(e: any): any {
    if (e?.code !== 'P2002') return e;
    const target = (e.meta?.target as string[] | string | undefined);
    const t = Array.isArray(target) ? target.join(',') : (target ?? '');
    if (t.includes('personnel')) return new ConflictException('Сотрудник с таким табельным номером уже существует');
    if (t.includes('email')) return new ConflictException('Сотрудник с таким email уже существует');
    return new ConflictException('Сотрудник с таким табельным номером или email уже существует');
  }

  async update(id: string, data: Partial<{
    personnelNumber: string;
    lastName: string;
    firstName: string;
    middleName: string;
    email: string;
    departmentId: string;
    positionId: string;
    hireDate: string;
    managerId: string;
  }>) {
    const updateData: Record<string, unknown> = {};
    if (data.personnelNumber !== undefined) updateData.personnelNumber = data.personnelNumber;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.middleName !== undefined) updateData.middleName = data.middleName;
    if (data.email !== undefined) updateData.email = data.email;
    // пустая строка из формы = «очистить поле» → NULL (поля опциональные)
    if (data.departmentId !== undefined) updateData.departmentId = data.departmentId || null;
    if (data.positionId !== undefined) updateData.positionId = data.positionId || null;
    if (data.hireDate !== undefined) updateData.hireDate = new Date(data.hireDate);
    if (data.managerId !== undefined) updateData.managerId = data.managerId;

    try {
      return await this.prisma.employee.update({
        where: { id },
        data: updateData,
        include: { department: true, position: true },
      });
    } catch (e: any) {
      throw this.mapUniqueError(e);
    }
  }

  async remove(id: string, deleteKeycloak = false) {
    const employee = await this.prisma.employee.findUnique({ where: { id } });
    if (!employee) throw new NotFoundException('Сотрудник не найден');

    // Best-effort: ошибка Keycloak не мешает удалению из БД.
    if (deleteKeycloak && employee.keycloakId) {
      try {
        const token = await this.getKeycloakAdminToken();
        await this.deleteKeycloakUser(employee.keycloakId, token);
        this.logger.log(`Учётка Keycloak удалена: ${employee.keycloakId}`);
      } catch (e: any) {
        this.logger.error(`Не удалось удалить учётку Keycloak ${employee.keycloakId}: ${e.message}`);
      }
    }

    await this.prisma.employee.delete({ where: { id } });
    return { success: true };
  }

  private async deleteKeycloakUser(keycloakId: string, token: string) {
    const keycloakUrl = process.env.KEYCLOAK_URL || 'http://localhost:8080';
    const realm = process.env.KEYCLOAK_REALM || 'hr-portal';
    const res = await fetch(`${keycloakUrl}/admin/realms/${realm}/users/${keycloakId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    // 404 — пользователя уже нет, считаем успехом.
    if (!res.ok && res.status !== 404) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${body}`);
    }
  }

  async resetKeycloakPassword(id: string, dto: { password?: string }) {
    const employee = await this.prisma.employee.findUnique({ where: { id } });
    if (!employee) throw new NotFoundException('Сотрудник не найден');

    // Логин (username) = email; пароль по умолчанию — цифры табельного (ЗЦЗЦ-00685 → 00685)
    const username = employee.email;
    const password = dto.password?.trim() || employee.personnelNumber.replace(/\D/g, '');
    if (!password) {
      throw new BadRequestException('Не удалось определить пароль: в табельном номере нет цифр');
    }
    this.logger.log(`reset-password: ${employee.personnelNumber} (username=${username}), keycloakId=${employee.keycloakId ?? 'нет'}, KEYCLOAK_URL=${process.env.KEYCLOAK_URL || 'http://localhost:8080 (default)'}`);
    const token = await this.getKeycloakAdminToken();

    // Если в БД есть keycloakId, но в Keycloak такого пользователя уже нет
    // (например, удалили вручную) — считаем, что учётки нет, и создаём заново.
    const hasLiveAccount = employee.keycloakId
      ? await this.keycloakUserExists(employee.keycloakId, token)
      : false;

    if (!hasLiveAccount) {
      const kcId = await this.createKeycloakUser(employee, password, token);
      await this.prisma.employee.update({ where: { id }, data: { keycloakId: kcId } });
      this.logger.log(`Учётка Keycloak создана: keycloakId=${kcId}`);
      return { created: true, keycloakId: kcId };
    }

    // Учётка существует: приводим username к цифрам табельного и ставим пароль.
    await this.ensureKeycloakUsername(employee.keycloakId!, username, token);
    await this.setKeycloakPassword(employee.keycloakId!, password, token);
    this.logger.log(`Пароль обновлён, username синхронизирован: keycloakId=${employee.keycloakId}`);
    return { created: false };
  }

  private async keycloakUserExists(keycloakId: string, token: string): Promise<boolean> {
    const keycloakUrl = process.env.KEYCLOAK_URL || 'http://localhost:8080';
    const realm = process.env.KEYCLOAK_REALM || 'hr-portal';
    const res = await fetch(`${keycloakUrl}/admin/realms/${realm}/users/${keycloakId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  }

  private async ensureKeycloakUsername(keycloakId: string, username: string, token: string) {
    const keycloakUrl = process.env.KEYCLOAK_URL || 'http://localhost:8080';
    const realm = process.env.KEYCLOAK_REALM || 'hr-portal';
    const base = `${keycloakUrl}/admin/realms/${realm}/users/${keycloakId}`;

    const getRes = await fetch(base, { headers: { Authorization: `Bearer ${token}` } });
    if (!getRes.ok) return;
    const user = await getRes.json();
    if ((user.username ?? '').toLowerCase() === username.toLowerCase()) return;

    await fetch(base, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...user, username }),
    });
    this.logger.log(`username обновлён на ${username} (keycloakId=${keycloakId})`);
  }

  // Detected managers (employees referenced by others' managerFio) with their
  // candidate subordinates. Optionally narrowed to a single manager (window A).
  async getManagerMapping(managerId?: string) {
    const employees = await this.prisma.employee.findMany({
      include: { department: true, position: true },
    });

    const byFio = new Map<string, typeof employees>();
    for (const e of employees) {
      const key = normalizeFio(`${e.lastName} ${e.firstName} ${e.middleName ?? ''}`);
      const list = byFio.get(key) ?? [];
      list.push(e);
      byFio.set(key, list);
    }

    const entries = new Map<string, { manager: (typeof employees)[number]; candidates: { employee: (typeof employees)[number]; checked: boolean }[] }>();
    for (const sub of employees) {
      if (!sub.managerFio) continue;
      const managers = byFio.get(normalizeFio(sub.managerFio)) ?? [];
      for (const m of managers) {
        if (m.id === sub.id) continue;
        if (managerId && m.id !== managerId) continue;
        let entry = entries.get(m.id);
        if (!entry) {
          entry = { manager: m, candidates: [] };
          entries.set(m.id, entry);
        }
        entry.candidates.push({ employee: sub, checked: sub.managerId === m.id });
      }
    }

    return Array.from(entries.values());
  }

  // Apply manager↔subordinate links: set managerId for checked, unlink the rest,
  // assign the Keycloak "manager" role to managers that gain subordinates.
  async applyManagerMapping(entries: { managerId: string; subordinateIds: string[] }[]) {
    let token: string | null = null;

    for (const { managerId, subordinateIds } of entries) {
      if (subordinateIds.length > 0) {
        await this.prisma.employee.updateMany({
          where: { id: { in: subordinateIds } },
          data: { managerId },
        });
      }

      // Unlink employees previously under this manager but now unchecked
      const unlinkWhere = subordinateIds.length
        ? { managerId, id: { notIn: subordinateIds } }
        : { managerId };
      await this.prisma.employee.updateMany({
        where: unlinkWhere,
        data: { managerId: null },
      });

      if (subordinateIds.length > 0) {
        const manager = await this.prisma.employee.findUnique({
          where: { id: managerId },
          select: { keycloakId: true },
        });
        if (manager?.keycloakId) {
          try {
            if (!token) token = await this.getKeycloakAdminToken();
            await this.assignRealmRole(manager.keycloakId, 'manager', token);
          } catch (e: any) {
            this.logger.warn(`Could not assign manager role: ${e.message}`);
          }
        }
      }
    }

    return { success: true };
  }

  private async assignRealmRole(keycloakId: string, roleName: string, token: string) {
    const keycloakUrl = process.env.KEYCLOAK_URL || 'http://localhost:8080';
    const realm = process.env.KEYCLOAK_REALM || 'hr-portal';

    const roleRes = await fetch(`${keycloakUrl}/admin/realms/${realm}/roles/${roleName}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!roleRes.ok) throw new Error(`Роль ${roleName} не найдена: HTTP ${roleRes.status}`);
    const role = await roleRes.json();

    await fetch(`${keycloakUrl}/admin/realms/${realm}/users/${keycloakId}/role-mappings/realm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([role]),
    });
  }

  private async getKeycloakAdminToken(): Promise<string> {
    const keycloakUrl = process.env.KEYCLOAK_URL || 'http://localhost:8080';
    const adminUser = process.env.KEYCLOAK_ADMIN || 'admin';
    const adminPass = process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin';

    try {
      const res = await fetch(`${keycloakUrl}/realms/master/protocol/openid-connect/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'password',
          client_id: 'admin-cli',
          username: adminUser,
          password: adminPass,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.access_token;
    } catch (e: any) {
      this.logger.error(`Keycloak admin auth failed: ${e.message}`);
      throw new BadRequestException(`Не удалось авторизоваться в Keycloak: ${e.message}`);
    }
  }

  private async createKeycloakUser(
    employee: { email: string; firstName: string; lastName: string; personnelNumber: string },
    password: string,
    token: string,
  ): Promise<string> {
    const keycloakUrl = process.env.KEYCLOAK_URL || 'http://localhost:8080';
    const realm = process.env.KEYCLOAK_REALM || 'hr-portal';
    const baseUrl = `${keycloakUrl}/admin/realms/${realm}/users`;

    // Логин (username) = email; пароль = цифры табельного.
    const username = employee.email;

    const createRes = await fetch(baseUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        email: employee.email,
        firstName: employee.firstName,
        lastName: employee.lastName,
        enabled: true,
        credentials: [{ type: 'password', value: password, temporary: true }],
      }),
    });

    if (createRes.status !== 201 && createRes.status !== 409) {
      const body = await createRes.text().catch(() => '');
      throw new BadRequestException(`Ошибка создания пользователя Keycloak: HTTP ${createRes.status} ${body}`);
    }

    const searchRes = await fetch(`${baseUrl}?email=${encodeURIComponent(employee.email)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!searchRes.ok) throw new BadRequestException('Не удалось найти пользователя в Keycloak');
    const users = await searchRes.json();
    if (users.length === 0) throw new BadRequestException('Пользователь не найден после создания');
    const kcUserId = users[0].id;

    if (createRes.status === 409) {
      await this.setKeycloakPassword(kcUserId, password, token);
    }

    try {
      const roleRes = await fetch(`${keycloakUrl}/admin/realms/${realm}/roles/employee`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (roleRes.ok) {
        const employeeRole = await roleRes.json();
        await fetch(`${keycloakUrl}/admin/realms/${realm}/users/${kcUserId}/role-mappings/realm`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify([employeeRole]),
        });
      }
    } catch {
      this.logger.warn('Could not assign employee role');
    }

    return kcUserId;
  }

  private async setKeycloakPassword(keycloakId: string, password: string, token: string) {
    const keycloakUrl = process.env.KEYCLOAK_URL || 'http://localhost:8080';
    const realm = process.env.KEYCLOAK_REALM || 'hr-portal';

    const res = await fetch(
      `${keycloakUrl}/admin/realms/${realm}/users/${keycloakId}/reset-password`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'password', value: password, temporary: true }),
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new BadRequestException(`Ошибка сброса пароля: HTTP ${res.status} ${body}`);
    }
  }
}
