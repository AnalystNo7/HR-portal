import { Injectable, NotFoundException } from '@nestjs/common';
import { AppealStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateAppealDto {
  authorId?: string | null;
  direction: string;
  subject: string;
  text: string;
  isAnonymous?: boolean;
}

export interface CreateCommentDto {
  authorId: string;
  text: string;
}

export interface AppealListQuery {
  authorId?: string;
  status?: AppealStatus;
  direction?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class AppealsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: AppealListQuery) {
    const { authorId, status, direction, page = 1, limit = 20 } = query;
    const where: Prisma.AppealWhereInput = {};
    if (authorId) where.authorId = authorId;
    if (status) where.status = status;
    if (direction) where.direction = direction;

    const [data, total] = await Promise.all([
      this.prisma.appeal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          author: { select: { id: true, firstName: true, lastName: true, middleName: true } },
        },
      }),
      this.prisma.appeal.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    const appeal = await this.prisma.appeal.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, middleName: true } },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: {
            author: { select: { id: true, firstName: true, lastName: true, middleName: true } },
          },
        },
        files: true,
      },
    });
    if (!appeal) throw new NotFoundException('Appeal not found');
    return appeal;
  }

  create(dto: CreateAppealDto) {
    return this.prisma.appeal.create({
      data: {
        direction: dto.direction,
        subject: dto.subject,
        text: dto.text,
        isAnonymous: dto.isAnonymous ?? false,
        authorId: dto.isAnonymous ? null : dto.authorId ?? null,
        status: 'NEW',
      },
    });
  }

  async updateStatus(id: string, status: AppealStatus) {
    const exists = await this.prisma.appeal.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Appeal not found');
    return this.prisma.appeal.update({ where: { id }, data: { status } });
  }

  async addComment(id: string, dto: CreateCommentDto) {
    const exists = await this.prisma.appeal.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Appeal not found');
    return this.prisma.appealComment.create({
      data: {
        appealId: id,
        authorId: dto.authorId,
        text: dto.text,
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, middleName: true } },
      },
    });
  }
}
