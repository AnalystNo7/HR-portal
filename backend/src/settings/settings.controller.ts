import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { KeycloakAuthGuard } from '../auth/auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { resolveCurrentEmployeeId } from '../oc360/oc360.helpers';
import { SaveLlmDto, SettingsService } from './settings.service';

@Controller('settings')
@UseGuards(KeycloakAuthGuard, RolesGuard)
@Roles('admin')
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('llm')
  list() {
    return this.settings.listPresets();
  }

  @Post('llm')
  async create(@Req() req: any, @Body() dto: SaveLlmDto) {
    const adminId = await resolveCurrentEmployeeId(this.prisma, req);
    return this.settings.createPreset(dto, adminId);
  }

  // тест до update-роута с :id, чтобы не перехватывался
  @Post('llm/test')
  testLlm(@Body() dto: SaveLlmDto) {
    return this.settings.testLlm(dto);
  }

  @Put('llm/:id')
  async update(@Req() req: any, @Param('id') id: string, @Body() dto: SaveLlmDto) {
    const adminId = await resolveCurrentEmployeeId(this.prisma, req);
    return this.settings.updatePreset(id, dto, adminId);
  }

  @Post('llm/:id/activate')
  async activate(@Req() req: any, @Param('id') id: string) {
    const adminId = await resolveCurrentEmployeeId(this.prisma, req);
    return this.settings.activatePreset(id, adminId);
  }

  @Delete('llm/:id')
  remove(@Param('id') id: string) {
    return this.settings.deletePreset(id);
  }
}
