import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PositionsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.position.findMany({ orderBy: { name: 'asc' } });
  }

  findById(id: string) {
    return this.prisma.position.findUnique({ where: { id } });
  }

  async create(data: { name: string }) {
    try {
      return await this.prisma.position.create({ data });
    } catch (e: any) {
      if (e.code === 'P2002') throw new ConflictException('Должность с таким названием уже существует');
      throw e;
    }
  }

  async update(id: string, data: { name: string }) {
    try {
      return await this.prisma.position.update({ where: { id }, data });
    } catch (e: any) {
      if (e.code === 'P2002') throw new ConflictException('Должность с таким названием уже существует');
      throw e;
    }
  }

  async remove(id: string) {
    const count = await this.prisma.employee.count({ where: { positionId: id } });
    if (count > 0) {
      throw new BadRequestException(`Нельзя удалить: ${count} сотрудников на этой должности`);
    }
    await this.prisma.position.delete({ where: { id } });
    return { success: true };
  }
}
