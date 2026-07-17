import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { Report360Status } from '@prisma/client';
import { KeycloakAuthGuard } from '../../auth/auth.guard';
import { RolesGuard, Roles } from '../../auth/roles.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveCurrentEmployeeId } from '../oc360.helpers';
import { ReportResetMode, ReportService } from './report.service';

@Controller('oc360')
@UseGuards(KeycloakAuthGuard, RolesGuard)
export class ReportController {
  constructor(
    private readonly reportService: ReportService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('cycles/:id/subjects/:sid/report')
  @Roles('hr', 'admin')
  getReport(@Param('id') id: string, @Param('sid') sid: string) {
    return this.reportService.getReport(id, sid);
  }

  @Post('cycles/:id/subjects/:sid/report/generate')
  @Roles('hr', 'admin')
  async generate(@Req() req: any, @Param('id') id: string, @Param('sid') sid: string) {
    const authorId = await resolveCurrentEmployeeId(this.prisma, req);
    return this.reportService.generate(id, sid, authorId);
  }

  @Post('cycles/:id/subjects/:sid/report/reset')
  @Roles('hr', 'admin')
  async reset(
    @Req() req: any,
    @Param('id') id: string,
    @Param('sid') sid: string,
    @Body() dto: { mode?: ReportResetMode },
  ) {
    const authorId = await resolveCurrentEmployeeId(this.prisma, req);
    const mode: ReportResetMode = dto?.mode === 'initial' ? 'initial' : 'previous';
    return this.reportService.reset(id, sid, authorId, mode);
  }

  @Put('cycles/:id/subjects/:sid/report')
  @Roles('hr', 'admin')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Param('sid') sid: string,
    @Body() dto: { sections?: unknown; status?: Report360Status },
  ) {
    const authorId = await resolveCurrentEmployeeId(this.prisma, req);
    return this.reportService.update(id, sid, dto, authorId);
  }

  @Delete('cycles/:id/subjects/:sid/report')
  @Roles('hr', 'admin')
  deleteReport(@Param('id') id: string, @Param('sid') sid: string) {
    return this.reportService.deleteReport(id, sid);
  }
}
