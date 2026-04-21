import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type Role = 'employee' | 'manager' | 'hr';

const ROLE_TO_PERSONNEL: Record<Role, string> = {
  employee: 'ТН-004',
  manager: 'ТН-001',
  hr: 'ТН-003',
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
    });
    if (!employee) {
      throw new NotFoundException(`No employee mapped for role "${role}" (${personnelNumber})`);
    }
    return { ...employee, role };
  }
}
