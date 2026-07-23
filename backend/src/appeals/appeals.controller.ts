import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AppealStatus } from '@prisma/client';
import { KeycloakAuthGuard } from '../auth/auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';
import {
  AppealsService,
  CreateAppealDto,
  CreateCommentDto,
} from './appeals.service';

// анонимный доступ закрыт; смена статуса — только HR/admin. Ограничение видимости
// чужих обращений сотруднику — в чек-листе безопасности (нужно продуктовое решение).
@Controller('appeals')
@UseGuards(KeycloakAuthGuard, RolesGuard)
@Roles('employee', 'manager', 'hr', 'admin')
export class AppealsController {
  constructor(private readonly appealsService: AppealsService) {}

  @Get()
  findAll(
    @Query('authorId') authorId?: string,
    @Query('status') status?: AppealStatus,
    @Query('direction') direction?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.appealsService.findAll({
      authorId,
      status,
      direction,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.appealsService.findById(id);
  }

  @Post()
  create(@Body() dto: CreateAppealDto) {
    return this.appealsService.create(dto);
  }

  @Patch(':id/status')
  @Roles('hr', 'admin')
  updateStatus(@Param('id') id: string, @Body('status') status: AppealStatus) {
    return this.appealsService.updateStatus(id, status);
  }

  @Post(':id/comments')
  addComment(@Param('id') id: string, @Body() dto: CreateCommentDto) {
    return this.appealsService.addComment(id, dto);
  }
}
