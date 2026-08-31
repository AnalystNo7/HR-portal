import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CompetencyDto {
  name: string;
  description?: string | null;
  category?: string;
  order?: number;
  isActive?: boolean;
  versionId?: string;
}

export interface VersionDto {
  name: string;
  isDefault?: boolean;
  sourceVersionId?: string;
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
  description?: string | null;
  isDefault?: boolean;
  points: ScalePointDto[];
}

@Injectable()
export class TemplateService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    return this.ensureDefaultVersion().catch(e =>
      console.error('oc360 version backfill failed', e),
    );
  }

  // ─── Версии ────────────────────────────────────
  // Гарантирует ровно одну версию по умолчанию и что у каждой компетенции есть версия.
  private async ensureDefaultVersion() {
    return this.prisma.$transaction(async tx => {
      let def = await tx.competencyVersion.findFirst({ where: { isDefault: true } });
      if (!def) {
        const earliest = await tx.competencyVersion.findFirst({ orderBy: { createdAt: 'asc' } });
        def = earliest
          ? await tx.competencyVersion.update({ where: { id: earliest.id }, data: { isDefault: true } })
          : await tx.competencyVersion.create({ data: { name: 'Версия 1', isDefault: true } });
      }
      await tx.competencyTemplate.updateMany({ where: { versionId: null }, data: { versionId: def.id } });
      return def;
    });
  }

  async listVersions() {
    await this.ensureDefaultVersion();
    return this.prisma.competencyVersion.findMany({
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { competencies: true } } },
    });
  }

  async createVersion(dto: VersionDto) {
    return this.prisma.$transaction(async tx => {
      if (dto.isDefault) {
        await tx.competencyVersion.updateMany({ data: { isDefault: false } });
      }
      const version = await tx.competencyVersion.create({
        data: { name: dto.name, isDefault: dto.isDefault ?? false },
      });
      if (dto.sourceVersionId) {
        const source = await tx.competencyTemplate.findMany({
          where: { versionId: dto.sourceVersionId },
          orderBy: { order: 'asc' },
          include: { indicators: { orderBy: { order: 'asc' } } },
        });
        for (const c of source) {
          await tx.competencyTemplate.create({
            data: {
              versionId: version.id,
              name: c.name,
              description: c.description,
              category: c.category,
              order: c.order,
              isActive: c.isActive,
              indicators: { create: c.indicators.map(i => ({ text: i.text, order: i.order })) },
            },
          });
        }
      }
      return tx.competencyVersion.findUnique({
        where: { id: version.id },
        include: { _count: { select: { competencies: true } } },
      });
    });
  }

  async updateVersion(id: string, dto: Partial<VersionDto>) {
    await this.ensureVersion(id);
    return this.prisma.$transaction(async tx => {
      if (dto.isDefault === true) {
        await tx.competencyVersion.updateMany({ where: { id: { not: id } }, data: { isDefault: false } });
      }
      return tx.competencyVersion.update({
        where: { id },
        data: { name: dto.name, isDefault: dto.isDefault === true ? true : undefined },
        include: { _count: { select: { competencies: true } } },
      });
    });
  }

  async deleteVersion(id: string) {
    const version = await this.prisma.competencyVersion.findUnique({ where: { id } });
    if (!version) throw new NotFoundException('Version not found');
    if (version.isDefault) {
      throw new BadRequestException('Нельзя удалить версию по умолчанию — сначала назначьте другую');
    }
    await this.prisma.competencyVersion.delete({ where: { id } });
    return { success: true };
  }

  private async ensureVersion(id: string) {
    const exists = await this.prisma.competencyVersion.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Version not found');
  }

  // ─── Компетенции ───────────────────────────────
  async listCompetencies(versionId?: string) {
    const vid = versionId ?? (await this.ensureDefaultVersion()).id;
    return this.prisma.competencyTemplate.findMany({
      where: { versionId: vid },
      orderBy: { order: 'asc' },
      include: { indicators: { orderBy: { order: 'asc' } } },
    });
  }

  async createCompetency(dto: CompetencyDto) {
    const vid = dto.versionId ?? (await this.ensureDefaultVersion()).id;
    return this.prisma.competencyTemplate.create({
      data: {
        versionId: vid,
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
    // без явного order — в конец списка (order=0 ставил новый индикатор в непредсказуемое
    // место); max+1 и вставка в одной транзакции — конкурентные добавления не дублируют order
    return this.prisma.$transaction(async tx => {
      const order = dto.order ?? (((await tx.indicatorTemplate.aggregate({
        where: { competencyId }, _max: { order: true },
      }))._max.order ?? -1) + 1);
      return tx.indicatorTemplate.create({
        data: { competencyId, text: dto.text, order },
      });
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
          description: dto.description ?? null,
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
        data: { name: dto.name, description: dto.description, isDefault: dto.isDefault },
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
