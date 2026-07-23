import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { KeycloakAuthGuard } from '../auth/auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { ProfileService, WorkExperienceDto, EducationDto } from './profile.service';

// сотрудник редактирует свой профиль сам → допускаем все роли, но требуем аутентификацию
// (анонимный доступ закрыт). Проверка владельца (IDOR) — в чек-листе безопасности.
@Controller('employees/:employeeId')
@UseGuards(KeycloakAuthGuard, RolesGuard)
@Roles('employee', 'manager', 'hr', 'admin')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('work-experiences')
  listWorkExperiences(@Param('employeeId') employeeId: string) {
    return this.profileService.getWorkExperiences(employeeId);
  }

  @Post('work-experiences')
  createWorkExperience(
    @Param('employeeId') employeeId: string,
    @Body() dto: WorkExperienceDto,
  ) {
    return this.profileService.createWorkExperience(employeeId, dto);
  }

  @Put('work-experiences/:id')
  updateWorkExperience(@Param('id') id: string, @Body() dto: WorkExperienceDto) {
    return this.profileService.updateWorkExperience(id, dto);
  }

  @Delete('work-experiences/:id')
  deleteWorkExperience(@Param('id') id: string) {
    return this.profileService.deleteWorkExperience(id);
  }

  @Get('educations')
  listEducations(@Param('employeeId') employeeId: string) {
    return this.profileService.getEducations(employeeId);
  }

  @Post('educations')
  createEducation(
    @Param('employeeId') employeeId: string,
    @Body() dto: EducationDto,
  ) {
    return this.profileService.createEducation(employeeId, dto);
  }

  @Put('educations/:id')
  updateEducation(@Param('id') id: string, @Body() dto: EducationDto) {
    return this.profileService.updateEducation(id, dto);
  }

  @Delete('educations/:id')
  deleteEducation(@Param('id') id: string) {
    return this.profileService.deleteEducation(id);
  }
}
