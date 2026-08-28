import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import { KeycloakAuthGuard } from '../../auth/auth.guard';
import { RolesGuard, Roles } from '../../auth/roles.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { isHrOrAdmin, resolveCurrentEmployeeId } from '../oc360.helpers';
import { RespondentService, SubmitDto } from './respondent.service';

@Controller('oc360/assignments')
@UseGuards(KeycloakAuthGuard, RolesGuard)
@Roles('employee', 'manager', 'hr', 'admin')
export class RespondentController {
  constructor(
    private readonly respondentService: RespondentService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async listMine(@Req() req: any, @Query('employeeId') employeeId?: string) {
    const id = await resolveCurrentEmployeeId(this.prisma, req, employeeId);
    if (!id) throw new BadRequestException('Не удалось определить текущего сотрудника');
    return this.respondentService.listMine(id);
  }

  @Get('peers/:subjectId')
  async listPeers(@Req() req: any, @Param('subjectId') subjectId: string, @Query('employeeId') employeeId?: string) {
    const id = await resolveCurrentEmployeeId(this.prisma, req, employeeId);
    if (!id) throw new BadRequestException('Не удалось определить текущего сотрудника');
    return this.respondentService.listPeers(subjectId, id);
  }

  @Post('peers/:subjectId')
  async addPeer(@Req() req: any, @Param('subjectId') subjectId: string, @Body() dto: { evaluatorId: string; employeeId?: string }) {
    const id = await resolveCurrentEmployeeId(this.prisma, req, dto.employeeId);
    if (!id) throw new BadRequestException('Не удалось определить текущего сотрудника');
    return this.respondentService.addPeer(subjectId, id, dto.evaluatorId);
  }

  @Post('peers/:subjectId/confirm')
  async confirmPeers(@Req() req: any, @Param('subjectId') subjectId: string, @Body() dto: { employeeId?: string }) {
    const id = await resolveCurrentEmployeeId(this.prisma, req, dto.employeeId);
    if (!id) throw new BadRequestException('Не удалось определить текущего сотрудника');
    return this.respondentService.confirmPeers(subjectId, id);
  }

  @Delete('peers/:subjectId/:respondentId')
  async removePeer(@Req() req: any, @Param('subjectId') subjectId: string, @Param('respondentId') respondentId: string, @Query('employeeId') employeeId?: string) {
    const id = await resolveCurrentEmployeeId(this.prisma, req, employeeId);
    if (!id) throw new BadRequestException('Не удалось определить текущего сотрудника');
    return this.respondentService.removePeer(subjectId, id, respondentId);
  }

  @Get(':respondentId')
  async getForm(
    @Req() req: any,
    @Param('respondentId') respondentId: string,
    @Query('employeeId') employeeId?: string,
  ) {
    const id = await resolveCurrentEmployeeId(this.prisma, req, employeeId);
    return this.respondentService.getForm(respondentId, id, isHrOrAdmin(req));
  }

  @Put(':respondentId')
  async submit(
    @Req() req: any,
    @Param('respondentId') respondentId: string,
    @Body() dto: SubmitDto & { employeeId?: string },
  ) {
    const id = await resolveCurrentEmployeeId(this.prisma, req, dto.employeeId);
    return this.respondentService.submit(respondentId, id, isHrOrAdmin(req), dto);
  }
}
