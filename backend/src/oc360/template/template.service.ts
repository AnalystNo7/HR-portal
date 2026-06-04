import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CompetencyDto {
  name: string;
  description?: string | null;
  category?: string;
  order?: number;
  isActive?: boolean;
}

export interface IndicatorDto {
  text: string;
  order?: number;
}

export interface ScalePointDto {
  value: number;
  label: string;
}

export interface ScaleDto {
  name: string;
  isDefault?: boolean;
  points: ScalePointDto[];
}

@Injectable()
export class TemplateService {
  constructor(private prisma: PrismaService) {}

  // ─── Компетенции ───────────────────────────────
  listCompetencies() {
    return this.prisma.competencyTemplate.findMany({
      orderBy: { order: 'asc' },
      include: { indicators: { orderBy: { order: 'asc' } } },
    });
  }

  createCompetency(dto: CompetencyDto) {
    return this.prisma.competencyTemplate.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        category: dto.category ?? '',
        order: dto.order ?? 0,
        isActive: dto.isActive ?? true,
      },
      include: { indicators: { orderBy: { order: 'asc' } } },
    });
  }

  async updateCompetency(id: string, dto: Partial<CompetencyDto>) {
    await this.ensureCompetency(id);
    return this.prisma.competencyTemplate.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        category: dto.category,
        order: dto.order,
        isActive: dto.isActive,
      },
      include: { indicators: { orderBy: { order: 'asc' } } },
    });
  }

  async deleteCompetency(id: string) {
    await this.ensureCompetency(id);
    await this.prisma.competencyTemplate.delete({ where: { id } });
    return { success: true };
  }

  // ─── Индикаторы ────────────────────────────────
  async addIndicator(competencyId: string, dto: IndicatorDto) {
    await this.ensureCompetency(competencyId);
    return this.prisma.indicatorTemplate.create({
      data: { competencyId, text: dto.text, order: dto.order ?? 0 },
    });
  }

  async updateIndicator(id: string, dto: Partial<IndicatorDto>) {
    const exists = await this.prisma.indicatorTemplate.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Indicator not found');
    return this.prisma.indicatorTemplate.update({
      where: { id },
      data: { text: dto.text, order: dto.order },
    });
  }

  async deleteIndicator(id: string) {
    const exists = await this.prisma.indicatorTemplate.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Indicator not found');
    await this.prisma.indicatorTemplate.delete({ where: { id } });
    return { success: true };
  }

  // ─── Шкалы ─────────────────────────────────────
  listScales() {
    return this.prisma.scaleTemplate.findMany({
      orderBy: { createdAt: 'asc' },
      include: { points: { orderBy: { value: 'asc' } } },
    });
  }

  async createScale(dto: ScaleDto) {
    return this.prisma.$transaction(async tx => {
      if (dto.isDefault) {
        await tx.scaleTemplate.updateMany({ data: { isDefault: false } });
      }
      return tx.scaleTemplate.create({
        data: {
          name: dto.name,
          isDefault: dto.isDefault ?? false,
          points: { create: dto.points.map(p => ({ value: p.value, label: p.label })) },
        },
        include: { points: { orderBy: { value: 'asc' } } },
      });
    });
  }

  async updateScale(id: string, dto: Partial<ScaleDto>) {
    const exists = await this.prisma.scaleTemplate.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Scale not found');
    return this.prisma.$transaction(async tx => {
      if (dto.isDefault) {
        await tx.scaleTemplate.updateMany({ where: { id: { not: id } }, data: { isDefault: false } });
      }
      if (dto.points) {
        await tx.scalePointTemplate.deleteMany({ where: { scaleId: id } });
        await tx.scalePointTemplate.createMany({
          data: dto.points.map(p => ({ scaleId: id, value: p.value, label: p.label })),
        });
      }
      return tx.scaleTemplate.update({
        where: { id },
        data: { name: dto.name, isDefault: dto.isDefault },
        include: { points: { orderBy: { value: 'asc' } } },
      });
    });
  }

  async deleteScale(id: string) {
    const exists = await this.prisma.scaleTemplate.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Scale not found');
    await this.prisma.scaleTemplate.delete({ where: { id } });
    return { success: true };
  }

  private async ensureCompetency(id: string) {
    const exists = await this.prisma.competencyTemplate.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Competency not found');
  }
}
