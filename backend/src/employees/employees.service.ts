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

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(query: EmployeeListQuery) {
    const {
      page = 1,
      limit = 10,
      search,
      department,
      departmentId,
      managerId,
      sortField = 'lastName',
      sortOrder = 'asc',
    } = query;

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
      [sortField]: sortOrder,
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
    departmentId: string;
    positionId: string;
    hireDate?: string;
    managerId?: string;
  }) {
    let employee;
    try {
      employee = await this.prisma.employee.create({
        data: {
          personnelNumber: data.personnelNumber,
          lastName: data.lastName,
          firstName: data.firstName,
          middleName: data.middleName ?? null,
          email: data.email,
          departmentId: data.departmentId,
          positionId: data.positionId,
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
      const token = await this.getKeycloakAdminToken();
      const kcId = await this.createKeycloakUser(employee, password, token);
      employee = await this.prisma.employee.update({
        where: { id: employee.id },
        data: { keycloakId: kcId },
        include: { department: true, position: true },
      });
    } catch (e: any) {
      this.logger.warn(`Не удалось создать учётную запись Keycloak для ${employee.personnelNumber}: ${e.message}`);
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
    if (data.departmentId !== undefined) updateData.departmentId = data.departmentId;
    if (data.positionId !== undefined) updateData.positionId = data.positionId;
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

  async remove(id: string) {
    await this.prisma.employee.delete({ where: { id } });
    return { success: true };
  }

  async resetKeycloakPassword(id: string, dto: { password?: string }) {
    const employee = await this.prisma.employee.findUnique({ where: { id } });
    if (!employee) throw new NotFoundException('Сотрудник не найден');

    // Пароль по умолчанию — только цифры из табельного номера (ЗЦЗЦ-00685 → 00685)
    const defaultPassword = employee.personnelNumber.replace(/\D/g, '');
    const password = dto.password?.trim() || defaultPassword;
    if (!password) {
      throw new BadRequestException('Не удалось определить пароль: в табельном номере нет цифр');
    }
    const token = await this.getKeycloakAdminToken();

    if (!employee.keycloakId) {
      const kcId = await this.createKeycloakUser(employee, password, token);
      await this.prisma.employee.update({ where: { id }, data: { keycloakId: kcId } });
      return { created: true, keycloakId: kcId };
    }

    await this.setKeycloakPassword(employee.keycloakId, password, token);
    return { created: false };
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

    // Логин (username) = цифры табельного номера; email сохраняем отдельно.
    const username = employee.personnelNumber.replace(/\D/g, '') || employee.personnelNumber;

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
