import {
  BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query, Req,
  UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { KeycloakAuthGuard } from '../auth/auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { isHrOrAdmin, resolveCurrentEmployeeId } from '../oc360/oc360.helpers';
import { BurnoutDto, BurnoutService } from './burnout.service';

@Controller('surveys/burnout')
@UseGuards(KeycloakAuthGuard, RolesGuard)
@Roles('employee', 'manager', 'hr', 'admin')
export class SurveysController {
  constructor(
    private readonly burnout: BurnoutService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('my')
  async my(@Req() req: any) {
    return this.burnout.myResults(await resolveCurrentEmployeeId(this.prisma, req));
  }

  @Post()
  async create(@Req() req: any, @Body() dto: BurnoutDto) {
    const currentId = await resolveCurrentEmployeeId(this.prisma, req);
    return this.burnout.create(dto, currentId, isHrOrAdmin(req));
  }

  /** Руководитель: только уровни подчинённых (баллы и ИСП сервер не отдаёт). */
  @Get('team')
  @Roles('manager', 'hr', 'admin')
  async team(@Req() req: any) {
    return this.burnout.teamLevels(await resolveCurrentEmployeeId(this.prisma, req));
  }

  @Get()
  @Roles('hr', 'admin')
  overview(@Query('departmentId') departmentId?: string) {
    return this.burnout.overview(departmentId || undefined);
  }

  @Get('employee/:employeeId')
  @Roles('hr', 'admin')
  history(@Param('employeeId') employeeId: string) {
    return this.burnout.history(employeeId);
  }

  @Put(':id')
  @Roles('hr', 'admin')
  update(@Param('id') id: string, @Body() dto: Partial<BurnoutDto>) {
    return this.burnout.update(id, dto);
  }

  @Delete(':id')
  @Roles('hr', 'admin')
  remove(@Param('id') id: string) {
    return this.burnout.remove(id);
  }

  @Post('import/preview')
  @Roles('hr', 'admin')
  @UseInterceptors(FileInterceptor('file'))
  async importPreview(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Файл не загружен');
    return this.burnout.parseExcel(file.buffer);
  }

  @Post('import/execute')
  @Roles('hr', 'admin')
  @UseInterceptors(FileInterceptor('file'))
  async importExecute(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Файл не загружен');
    const rows = await this.burnout.parseExcel(file.buffer);
    return this.burnout.executeImport(rows, await resolveCurrentEmployeeId(this.prisma, req));
  }
}
