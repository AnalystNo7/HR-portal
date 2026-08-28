import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { PositionsService } from './positions.service';
import { KeycloakAuthGuard } from '../auth/auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';

@Controller('positions')
export class PositionsController {
  constructor(private readonly service: PositionsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post()
  @UseGuards(KeycloakAuthGuard, RolesGuard)
  @Roles('admin')
  create(@Body() dto: { name: string }) {
    return this.service.create(dto);
  }

  @Put(':id')
  @UseGuards(KeycloakAuthGuard, RolesGuard)
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: { name: string }) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(KeycloakAuthGuard, RolesGuard)
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
