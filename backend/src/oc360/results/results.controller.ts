import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { KeycloakAuthGuard } from '../../auth/auth.guard';
import { RolesGuard, Roles } from '../../auth/roles.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveCurrentEmployeeId } from '../oc360.helpers';
import { ResultsService } from './results.service';

@Controller('oc360')
@UseGuards(KeycloakAuthGuard, RolesGuard)
export class ResultsController {
  constructor(
    private readonly resultsService: ResultsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('cycles/:id/subjects/:sid/results')
  @Roles('hr', 'admin')
  getResults(@Param('id') id: string, @Param('sid') sid: string) {
    return this.resultsService.getResults(id, sid);
  }

  @Post('cycles/:id/subjects/:sid/publish')
  @Roles('hr', 'admin')
  publish(@Param('id') id: string, @Param('sid') sid: string) {
    return this.resultsService.publish(id, sid);
  }

  @Post('cycles/:id/subjects/:sid/unpublish')
  @Roles('hr', 'admin')
  unpublish(@Param('id') id: string, @Param('sid') sid: string) {
    return this.resultsService.unpublish(id, sid);
  }

  @Get('cycles/:id/subjects/:sid/conclusions')
  @Roles('hr', 'admin')
  listConclusions(@Param('id') id: string, @Param('sid') sid: string) {
    return this.resultsService.listConclusions(id, sid);
  }

  @Post('cycles/:id/subjects/:sid/conclusions')
  @Roles('hr', 'admin')
  async addConclusion(
    @Req() req: any,
    @Param('id') id: string,
    @Param('sid') sid: string,
    @Body() dto: { text: string; authorId?: string },
  ) {
    const authorId = await resolveCurrentEmployeeId(this.prisma, req, dto.authorId);
    return this.resultsService.addConclusion(id, sid, dto.text, authorId);
  }

  @Put('conclusions/:id')
  @Roles('hr', 'admin')
  updateConclusion(@Param('id') id: string, @Body() dto: { text: string }) {
    return this.resultsService.updateConclusion(id, dto.text);
  }

  @Delete('conclusions/:id')
  @Roles('hr', 'admin')
  deleteConclusion(@Param('id') id: string) {
    return this.resultsService.deleteConclusion(id);
  }

  // Свои результаты — доступно любому аутентифицированному сотруднику
  @Get('my-results')
  @Roles('employee', 'manager', 'hr', 'admin')
  async listMine(@Req() req: any, @Query('employeeId') employeeId?: string) {
    const id = await resolveCurrentEmployeeId(this.prisma, req, employeeId);
    if (!id) throw new BadRequestException('Не удалось определить текущего сотрудника');
    return this.resultsService.listMySubjects(id);
  }

  @Get('my-results/:cycleId/:sid')
  @Roles('employee', 'manager', 'hr', 'admin')
  async getMine(
    @Req() req: any,
    @Param('cycleId') cycleId: string,
    @Param('sid') sid: string,
    @Query('employeeId') employeeId?: string,
  ) {
    const id = await resolveCurrentEmployeeId(this.prisma, req, employeeId);
    return this.resultsService.getMyResults(cycleId, sid, id);
  }
}
