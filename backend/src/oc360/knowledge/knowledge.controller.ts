import {
  Body, Controller, Delete, Get, Param, Post, Put, Req,
  UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { KeycloakAuthGuard } from '../../auth/auth.guard';
import { RolesGuard, Roles } from '../../auth/roles.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveCurrentEmployeeId } from '../oc360.helpers';
import { KnowledgeService } from './knowledge.service';

@Controller('oc360/knowledge')
@UseGuards(KeycloakAuthGuard, RolesGuard)
@Roles('hr', 'admin')
export class KnowledgeController {
  constructor(
    private readonly knowledge: KnowledgeService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  list() {
    return this.knowledge.list();
  }

  @Post('docs')
  @UseInterceptors(FileInterceptor('file'))
  async upload(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    const uploadedById = await resolveCurrentEmployeeId(this.prisma, req);
    return this.knowledge.upload(file, uploadedById);
  }

  @Get('docs/:id')
  getText(@Param('id') id: string) {
    return this.knowledge.getText(id);
  }

  @Put('docs/:id')
  update(@Param('id') id: string, @Body() dto: { isActive?: boolean; name?: string }) {
    return this.knowledge.update(id, dto);
  }

  @Delete('docs/:id')
  remove(@Param('id') id: string) {
    return this.knowledge.remove(id);
  }

  @Get('prompt')
  getPrompt() {
    return this.knowledge.getPrompt();
  }

  @Put('prompt')
  async savePrompt(@Req() req: any, @Body() dto: { text?: string | null }) {
    const updatedById = await resolveCurrentEmployeeId(this.prisma, req);
    return this.knowledge.savePrompt(dto.text ?? null, updatedById);
  }
}
