import { Injectable } from '@nestjs/common';
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

@Injectable()
export class EmployeesService {
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
        include: { department: true, position: true },
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

  create(data: {
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
    return this.prisma.employee.create({
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

    return this.prisma.employee.update({
      where: { id },
      data: updateData,
      include: { department: true, position: true },
    });
  }

  async remove(id: string) {
    await this.prisma.employee.delete({ where: { id } });
    return { success: true };
  }
}
