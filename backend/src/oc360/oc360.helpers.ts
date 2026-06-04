import { PrismaService } from '../prisma/prisma.service';

export interface PersonRef {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
}

export function fio(p: PersonRef): string {
  return [p.lastName, p.firstName, p.middleName].filter(Boolean).join(' ');
}

/**
 * Текущий сотрудник. В реальном режиме — по email из Keycloak-токена (req.user).
 * В mock-режиме токена нет, поэтому поддерживаем явный fallback на employeeId
 * (frontend знает id текущего сотрудника через /me) — по образцу MeController.
 */
export async function resolveCurrentEmployeeId(
  prisma: PrismaService,
  req: any,
  fallbackEmployeeId?: string,
): Promise<string | null> {
  const email: string | undefined = req?.user?.email;
  if (email) {
    const emp = await prisma.employee.findUnique({ where: { email }, select: { id: true } });
    if (emp) return emp.id;
  }
  return fallbackEmployeeId ?? null;
}

export function isHrOrAdmin(req: any): boolean {
  const roles: string[] = req?.user?.roles ?? [];
  return roles.includes('hr') || roles.includes('admin');
}
