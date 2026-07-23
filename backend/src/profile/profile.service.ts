import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface WorkExperienceDto {
  company: string;
  position: string;
  startDate: string;
  endDate?: string | null;
  isCurrent?: boolean;
  description?: string | null;
}

export interface EducationDto {
  institution: string;
  specialization?: string | null;
  level: string;
  yearCompleted?: number | null;
  type?: 'BASIC' | 'ADDITIONAL';
}

@Injectable()
export class ProfileService {
  constructor(private prisma: PrismaService) {}

  getWorkExperiences(employeeId: string) {
    return this.prisma.workExperience.findMany({
      where: { employeeId },
      orderBy: { startDate: 'desc' },
    });
  }

  createWorkExperience(employeeId: string, dto: WorkExperienceDto) {
    return this.prisma.workExperience.create({
      data: {
        employeeId,
        company: dto.company,
        position: dto.position,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        isCurrent: dto.isCurrent ?? false,
        description: dto.description ?? null,
      },
    });
  }

  // запись изменяется/удаляется только в рамках своего employeeId (защита от IDOR по :id)
  async updateWorkExperience(id: string, employeeId: string, dto: WorkExperienceDto) {
    const exists = await this.prisma.workExperience.findFirst({ where: { id, employeeId } });
    if (!exists) throw new NotFoundException('Work experience not found');
    return this.prisma.workExperience.update({
      where: { id },
      data: {
        company: dto.company,
        position: dto.position,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        isCurrent: dto.isCurrent ?? false,
        description: dto.description ?? null,
      },
    });
  }

  async deleteWorkExperience(id: string, employeeId: string) {
    const exists = await this.prisma.workExperience.findFirst({ where: { id, employeeId } });
    if (!exists) throw new NotFoundException('Work experience not found');
    await this.prisma.workExperience.delete({ where: { id } });
    return { success: true };
  }

  getEducations(employeeId: string) {
    return this.prisma.education.findMany({
      where: { employeeId },
      orderBy: { yearCompleted: 'desc' },
    });
  }

  createEducation(employeeId: string, dto: EducationDto) {
    return this.prisma.education.create({
      data: {
        employeeId,
        institution: dto.institution,
        specialization: dto.specialization ?? null,
        level: dto.level,
        yearCompleted: dto.yearCompleted ?? null,
        type: dto.type ?? 'BASIC',
      },
    });
  }

  async updateEducation(id: string, employeeId: string, dto: EducationDto) {
    const exists = await this.prisma.education.findFirst({ where: { id, employeeId } });
    if (!exists) throw new NotFoundException('Education not found');
    return this.prisma.education.update({
      where: { id },
      data: {
        institution: dto.institution,
        specialization: dto.specialization ?? null,
        level: dto.level,
        yearCompleted: dto.yearCompleted ?? null,
        type: dto.type ?? 'BASIC',
      },
    });
  }

  async deleteEducation(id: string, employeeId: string) {
    const exists = await this.prisma.education.findFirst({ where: { id, employeeId } });
    if (!exists) throw new NotFoundException('Education not found');
    await this.prisma.education.delete({ where: { id } });
    return { success: true };
  }
}
