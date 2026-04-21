import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface EmployeeListQuery {
  page?: number;
  limit?: number;
  search?: string;
  department?: string;
  managerId?: string;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: EmployeeListQuery) {
    const {
      page = 1,
      limit = 10,
      search,
      department,
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
        { position: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (department) where.department = department;
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
        workExperiences: { orderBy: { startDate: 'desc' } },
        educations: { orderBy: { yearCompleted: 'desc' } },
      },
    });
  }

  async getDepartments(): Promise<string[]> {
    const rows = await this.prisma.employee.findMany({
      select: { department: true },
      distinct: ['department'],
      orderBy: { department: 'asc' },
    });
    return rows.map((r) => r.department);
  }
}
