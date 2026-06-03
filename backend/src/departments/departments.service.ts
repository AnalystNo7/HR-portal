import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.department.findMany({ orderBy: { name: 'asc' } });
  }

  findById(id: string) {
    return this.prisma.department.findUnique({ where: { id } });
  }

  async create(data: { name: string }) {
    try {
      return await this.prisma.department.create({ data });
    } catch (e: any) {
      if (e.code === 'P2002') throw new ConflictException('Подразделение с таким названием уже существует');
      throw e;
    }
  }

  async update(id: string, data: { name: string }) {
    try {
      return await this.prisma.department.update({ where: { id }, data });
    } catch (e: any) {
      if (e.code === 'P2002') throw new ConflictException('Подразделение с таким названием уже существует');
      throw e;
    }
  }

  async remove(id: string) {
    const count = await this.prisma.employee.count({ where: { departmentId: id } });
    if (count > 0) {
      throw new BadRequestException(`Нельзя удалить: ${count} сотрудников в этом подразделении`);
    }
    await this.prisma.department.delete({ where: { id } });
    return { success: true };
  }
}
