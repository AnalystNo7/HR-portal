import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AppealStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppealDto, CreateCommentDto } from './appeals.dto';

export { CreateAppealDto, CreateCommentDto };

const MAX_PAGE_SIZE = 100;

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
    const { authorId, status, direction, page = 1 } = query;
    const limit = Math.min(Math.max(query.limit ?? 20, 1), MAX_PAGE_SIZE);
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

  /** viewer: null-privileged — доступ только к своим неанонимным обращениям. */
  async findById(id: string, viewer: { employeeId: string | null; privileged: boolean }) {
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
    // не-HR видит только своё неанонимное обращение
    if (!viewer.privileged && (appeal.authorId == null || appeal.authorId !== viewer.employeeId)) {
      throw new ForbiddenException('Нет доступа к этому обращению');
    }
    return appeal;
  }

  /** authorId берётся из токена (не из тела); анонимные сохраняются без автора. */
  create(dto: CreateAppealDto, authorId: string | null) {
    return this.prisma.appeal.create({
      data: {
        direction: dto.direction,
        subject: dto.subject,
        text: dto.text,
        isAnonymous: dto.isAnonymous ?? false,
        authorId: dto.isAnonymous ? null : authorId,
        status: 'NEW',
      },
    });
  }

  async updateStatus(id: string, status: AppealStatus) {
    const exists = await this.prisma.appeal.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Appeal not found');
    return this.prisma.appeal.update({ where: { id }, data: { status } });
  }

  /** authorId комментария — из токена. Не-HR может комментировать только своё обращение. */
  async addComment(id: string, authorId: string, text: string, viewer: { employeeId: string | null; privileged: boolean }) {
    const exists = await this.prisma.appeal.findUnique({ where: { id }, select: { authorId: true } });
    if (!exists) throw new NotFoundException('Appeal not found');
    if (!viewer.privileged && (exists.authorId == null || exists.authorId !== viewer.employeeId)) {
      throw new ForbiddenException('Нет доступа к этому обращению');
    }
    return this.prisma.appealComment.create({
      data: { appealId: id, authorId, text },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, middleName: true } },
      },
    });
  }
}
