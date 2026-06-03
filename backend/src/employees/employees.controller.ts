import { Body, Controller, Get, Param, Post, Put, Delete, Query, UseGuards } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { KeycloakAuthGuard } from '../auth/auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';

interface CreateEmployeeDto {
  personnelNumber: string;
  lastName: string;
  firstName: string;
  middleName?: string;
  email: string;
  departmentId: string;
  positionId: string;
  hireDate?: string;
  managerId?: string;
}

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('department') department?: string,
    @Query('departmentId') departmentId?: string,
    @Query('managerId') managerId?: string,
    @Query('sortField') sortField?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.employeesService.findAll({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      department,
      departmentId,
      managerId,
      sortField,
      sortOrder,
    });
  }

  @Get('departments')
  getDepartments() {
    return this.employeesService.getDepartments();
  }

  @Get('manager-mapping')
  @UseGuards(KeycloakAuthGuard, RolesGuard)
  @Roles('admin')
  getManagerMapping(@Query('managerId') managerId?: string) {
    return this.employeesService.getManagerMapping(managerId);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.employeesService.findById(id);
  }

  @Post()
  @UseGuards(KeycloakAuthGuard, RolesGuard)
  @Roles('admin')
  create(@Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(dto);
  }

  @Put(':id')
  @UseGuards(KeycloakAuthGuard, RolesGuard)
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: Partial<CreateEmployeeDto>) {
    return this.employeesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(KeycloakAuthGuard, RolesGuard)
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.employeesService.remove(id);
  }

  @Post(':id/reset-password')
  @UseGuards(KeycloakAuthGuard, RolesGuard)
  @Roles('admin')
  resetPassword(@Param('id') id: string, @Body() dto: { password?: string }) {
    return this.employeesService.resetKeycloakPassword(id, dto);
  }

  @Post('manager-mapping')
  @UseGuards(KeycloakAuthGuard, RolesGuard)
  @Roles('admin')
  applyManagerMapping(@Body() dto: { entries: { managerId: string; subordinateIds: string[] }[] }) {
    return this.employeesService.applyManagerMapping(dto.entries);
  }
}
