import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { Cycle360Status } from '@prisma/client';
import { KeycloakAuthGuard } from '../../auth/auth.guard';
import { RolesGuard, Roles } from '../../auth/roles.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveCurrentEmployeeId } from '../oc360.helpers';
import { CycleService, CreateCycleDto, AddRespondentDto } from './cycle.service';

@Controller('oc360/cycles')
@UseGuards(KeycloakAuthGuard, RolesGuard)
@Roles('hr', 'admin')
export class CycleController {
  constructor(
    private readonly cycleService: CycleService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  findAll(
    @Query('status') status?: Cycle360Status,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.cycleService.findAll({
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.cycleService.findById(id);
  }

  @Post()
  async create(@Req() req: any, @Body() dto: CreateCycleDto & { createdById?: string }) {
    const createdById = await resolveCurrentEmployeeId(this.prisma, req, dto.createdById);
    return this.cycleService.create(dto, createdById);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: { name?: string; description?: string | null; year?: number; half?: number; targetLevel?: number | null },
  ) {
    return this.cycleService.update(id, dto);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.cycleService.delete(id, req.user?.roles ?? []);
  }

  @Put(':id/competencies/:cid')
  updateCompetency(
    @Param('id') id: string,
    @Param('cid') cid: string,
    @Body() dto: { name?: string; description?: string | null; order?: number },
  ) {
    return this.cycleService.updateCompetency(id, cid, dto);
  }

  @Put(':id/indicators/:iid')
  updateIndicator(
    @Param('id') id: string,
    @Param('iid') iid: string,
    @Body() dto: { text?: string; order?: number },
  ) {
    return this.cycleService.updateIndicator(id, iid, dto);
  }

  @Post(':id/subjects')
  addSubjects(@Param('id') id: string, @Body() dto: { employeeIds: string[] }) {
    return this.cycleService.addSubjects(id, dto.employeeIds);
  }

  @Put(':id/subjects/:sid')
  updateSubject(@Param('id') id: string, @Param('sid') sid: string, @Body() dto: { managerEditsPeers?: boolean }) {
    return this.cycleService.updateSubject(id, sid, dto);
  }

  @Delete(':id/subjects/:sid')
  removeSubject(@Param('id') id: string, @Param('sid') sid: string) {
    return this.cycleService.removeSubject(id, sid);
  }

  @Get(':id/subjects/:sid/respondents')
  getRespondents(@Param('id') id: string, @Param('sid') sid: string) {
    return this.cycleService.getRespondents(id, sid);
  }

  @Post(':id/subjects/:sid/respondents')
  addRespondent(@Param('id') id: string, @Param('sid') sid: string, @Body() dto: AddRespondentDto) {
    return this.cycleService.addRespondent(id, sid, dto);
  }

  @Delete(':id/respondents/:rid')
  removeRespondent(@Param('id') id: string, @Param('rid') rid: string) {
    return this.cycleService.removeRespondent(id, rid);
  }

  @Post(':id/activate')
  activate(@Param('id') id: string) {
    return this.cycleService.activate(id);
  }

  @Get(':id/subjects/:sid/workflow')
  workflow(@Param('id') id: string, @Param('sid') sid: string) {
    return this.cycleService.workflow(id, sid);
  }
}
