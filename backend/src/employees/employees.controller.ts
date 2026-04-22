import { Body, Controller, Get, Param, Post, Put, Delete, Query } from '@nestjs/common';
import { EmployeesService } from './employees.service';

interface CreateEmployeeDto {
  personnelNumber: string;
  lastName: string;
  firstName: string;
  middleName?: string;
  email: string;
  position: string;
  department: string;
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
    @Query('managerId') managerId?: string,
    @Query('sortField') sortField?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.employeesService.findAll({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      department,
      managerId,
      sortField,
      sortOrder,
    });
  }

  @Get('departments')
  getDepartments() {
    return this.employeesService.getDepartments();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.employeesService.findById(id);
  }

  @Post()
  create(@Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateEmployeeDto>) {
    return this.employeesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.employeesService.remove(id);
  }
}
