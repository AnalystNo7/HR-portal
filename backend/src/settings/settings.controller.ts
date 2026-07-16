import { Body, Controller, Get, Post, Put, Req, UseGuards } from '@nestjs/common';
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
  getLlm() {
    return this.settings.getLlmView();
  }

  @Put('llm')
  async saveLlm(@Req() req: any, @Body() dto: SaveLlmDto) {
    const adminId = await resolveCurrentEmployeeId(this.prisma, req);
    return this.settings.saveLlm(dto, adminId);
  }

  @Post('llm/test')
  testLlm(@Body() dto: SaveLlmDto) {
    return this.settings.testLlm(dto);
  }
}
