import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type Role = 'employee' | 'manager' | 'hr' | 'admin';

const ROLE_TO_PERSONNEL: Record<Role, string> = {
  employee: 'ТН-004',
  manager: 'ТН-001',
  hr: 'ТН-003',
  admin: 'ТН-001',
};

@Injectable()
export class MeService {
  constructor(private prisma: PrismaService) {}

  async getByRole(role: Role) {
    const personnelNumber = ROLE_TO_PERSONNEL[role];
    if (!personnelNumber) {
      throw new NotFoundException(`Unknown role: ${role}`);
    }
    const employee = await this.prisma.employee.findUnique({
      where: { personnelNumber },
      include: { department: true, position: true },
    });
    if (!employee) {
      throw new NotFoundException(`No employee mapped for role "${role}"`);
    }
    return { ...employee, role };
  }

  async getByRoleAndEmail(role: Role, email: string) {
    let employee = await this.prisma.employee.findUnique({
      where: { email },
      include: { department: true, position: true },
    });

    if (!employee) {
      employee = await this.prisma.employee.findUnique({
        where: { personnelNumber: ROLE_TO_PERSONNEL[role] },
        include: { department: true, position: true },
      });
    }

    if (!employee) {
      throw new NotFoundException(`Employee not found for email "${email}" or role "${role}"`);
    }

    return { ...employee, role };
  }
}
