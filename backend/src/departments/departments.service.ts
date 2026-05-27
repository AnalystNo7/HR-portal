import { Injectable, BadRequestException } from '@nestjs/common';
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

  create(data: { name: string }) {
    return this.prisma.department.create({ data });
  }

  update(id: string, data: { name: string }) {
    return this.prisma.department.update({ where: { id }, data });
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
