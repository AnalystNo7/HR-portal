import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { KeycloakAuthGuard } from '../auth/auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { resolveCurrentEmployeeId, isHrOrAdmin } from '../oc360/oc360.helpers';
import { ProfileService, WorkExperienceDto, EducationDto } from './profile.service';

// сотрудник работает только со своим профилем; HR/admin — с любым.
@Controller('employees/:employeeId')
@UseGuards(KeycloakAuthGuard, RolesGuard)
@Roles('employee', 'manager', 'hr', 'admin')
export class ProfileController {
  constructor(
    private readonly profileService: ProfileService,
    private readonly prisma: PrismaService,
  ) {}

  /** Доступ к профилю сотрудника: свой профиль или роль HR/admin. */
  private async assertAccess(req: any, employeeId: string) {
    if (isHrOrAdmin(req)) return;
    const current = await resolveCurrentEmployeeId(this.prisma, req);
    if (!current || current !== employeeId) {
      throw new ForbiddenException('Нет доступа к профилю этого сотрудника');
    }
  }

  @Get('work-experiences')
  async listWorkExperiences(@Req() req: any, @Param('employeeId') employeeId: string) {
    await this.assertAccess(req, employeeId);
    return this.profileService.getWorkExperiences(employeeId);
  }

  @Post('work-experiences')
  async createWorkExperience(@Req() req: any, @Param('employeeId') employeeId: string, @Body() dto: WorkExperienceDto) {
    await this.assertAccess(req, employeeId);
    return this.profileService.createWorkExperience(employeeId, dto);
  }

  @Put('work-experiences/:id')
  async updateWorkExperience(@Req() req: any, @Param('employeeId') employeeId: string, @Param('id') id: string, @Body() dto: WorkExperienceDto) {
    await this.assertAccess(req, employeeId);
    return this.profileService.updateWorkExperience(id, employeeId, dto);
  }

  @Delete('work-experiences/:id')
  async deleteWorkExperience(@Req() req: any, @Param('employeeId') employeeId: string, @Param('id') id: string) {
    await this.assertAccess(req, employeeId);
    return this.profileService.deleteWorkExperience(id, employeeId);
  }

  @Get('educations')
  async listEducations(@Req() req: any, @Param('employeeId') employeeId: string) {
    await this.assertAccess(req, employeeId);
    return this.profileService.getEducations(employeeId);
  }

  @Post('educations')
  async createEducation(@Req() req: any, @Param('employeeId') employeeId: string, @Body() dto: EducationDto) {
    await this.assertAccess(req, employeeId);
    return this.profileService.createEducation(employeeId, dto);
  }

  @Put('educations/:id')
  async updateEducation(@Req() req: any, @Param('employeeId') employeeId: string, @Param('id') id: string, @Body() dto: EducationDto) {
    await this.assertAccess(req, employeeId);
    return this.profileService.updateEducation(id, employeeId, dto);
  }

  @Delete('educations/:id')
  async deleteEducation(@Req() req: any, @Param('employeeId') employeeId: string, @Param('id') id: string) {
    await this.assertAccess(req, employeeId);
    return this.profileService.deleteEducation(id, employeeId);
  }
}
