import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AppealStatus } from '@prisma/client';
import { KeycloakAuthGuard } from '../auth/auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { resolveCurrentEmployeeId, isHrOrAdmin } from '../oc360/oc360.helpers';
import { AppealsService } from './appeals.service';
import { CreateAppealDto, CreateCommentDto } from './appeals.dto';

// анонимный доступ закрыт; сотрудник видит/комментирует только свои обращения,
// HR/admin — все. Смена статуса — только HR/admin.
@Controller('appeals')
@UseGuards(KeycloakAuthGuard, RolesGuard)
@Roles('employee', 'manager', 'hr', 'admin')
export class AppealsController {
  constructor(
    private readonly appealsService: AppealsService,
    private readonly prisma: PrismaService,
  ) {}

  private async viewer(req: any) {
    return {
      employeeId: await resolveCurrentEmployeeId(this.prisma, req),
      privileged: isHrOrAdmin(req),
    };
  }

  @Get()
  async findAll(
    @Req() req: any,
    @Query('authorId') authorId?: string,
    @Query('status') status?: AppealStatus,
    @Query('direction') direction?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const v = await this.viewer(req);
    // не-HR: принудительно только свои обращения (клиентский authorId игнорируется)
    const effectiveAuthorId = v.privileged ? authorId : (v.employeeId ?? '__none__');
    return this.appealsService.findAll({
      authorId: effectiveAuthorId,
      status,
      direction,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  async findById(@Req() req: any, @Param('id') id: string) {
    return this.appealsService.findById(id, await this.viewer(req));
  }

  @Post()
  async create(@Req() req: any, @Body() dto: CreateAppealDto) {
    const authorId = await resolveCurrentEmployeeId(this.prisma, req);
    return this.appealsService.create(dto, authorId);
  }

  @Patch(':id/status')
  @Roles('hr', 'admin')
  updateStatus(@Param('id') id: string, @Body('status') status: AppealStatus) {
    return this.appealsService.updateStatus(id, status);
  }

  @Post(':id/comments')
  async addComment(@Req() req: any, @Param('id') id: string, @Body() dto: CreateCommentDto) {
    const v = await this.viewer(req);
    const authorId = v.employeeId;
    if (!authorId) throw new ForbiddenException('Не определён автор комментария');
    return this.appealsService.addComment(id, authorId, dto.text, v);
  }
}
