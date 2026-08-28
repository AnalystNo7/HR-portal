import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { KeycloakAuthGuard } from '../../auth/auth.guard';
import { RolesGuard, Roles } from '../../auth/roles.guard';
import {
  TemplateService,
  CompetencyDto,
  IndicatorDto,
  ScaleDto,
  VersionDto,
} from './template.service';

@Controller('oc360/template')
@UseGuards(KeycloakAuthGuard, RolesGuard)
@Roles('hr', 'admin')
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  // ─── Версии ───
  @Get('versions')
  listVersions() {
    return this.templateService.listVersions();
  }

  @Post('versions')
  createVersion(@Body() dto: VersionDto) {
    return this.templateService.createVersion(dto);
  }

  @Put('versions/:id')
  updateVersion(@Param('id') id: string, @Body() dto: Partial<VersionDto>) {
    return this.templateService.updateVersion(id, dto);
  }

  @Delete('versions/:id')
  deleteVersion(@Param('id') id: string) {
    return this.templateService.deleteVersion(id);
  }

  @Get('competencies')
  listCompetencies(@Query('versionId') versionId?: string) {
    return this.templateService.listCompetencies(versionId);
  }

  @Post('competencies')
  createCompetency(@Body() dto: CompetencyDto) {
    return this.templateService.createCompetency(dto);
  }

  @Put('competencies/:id')
  updateCompetency(@Param('id') id: string, @Body() dto: Partial<CompetencyDto>) {
    return this.templateService.updateCompetency(id, dto);
  }

  @Delete('competencies/:id')
  deleteCompetency(@Param('id') id: string) {
    return this.templateService.deleteCompetency(id);
  }

  @Post('competencies/:id/indicators')
  addIndicator(@Param('id') id: string, @Body() dto: IndicatorDto) {
    return this.templateService.addIndicator(id, dto);
  }

  @Put('indicators/:id')
  updateIndicator(@Param('id') id: string, @Body() dto: Partial<IndicatorDto>) {
    return this.templateService.updateIndicator(id, dto);
  }

  @Delete('indicators/:id')
  deleteIndicator(@Param('id') id: string) {
    return this.templateService.deleteIndicator(id);
  }

  @Get('scales')
  listScales() {
    return this.templateService.listScales();
  }

  @Post('scales')
  createScale(@Body() dto: ScaleDto) {
    return this.templateService.createScale(dto);
  }

  @Put('scales/:id')
  updateScale(@Param('id') id: string, @Body() dto: Partial<ScaleDto>) {
    return this.templateService.updateScale(id, dto);
  }

  @Delete('scales/:id')
  deleteScale(@Param('id') id: string) {
    return this.templateService.deleteScale(id);
  }
}
