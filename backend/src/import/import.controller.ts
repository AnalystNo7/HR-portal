import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { KeycloakAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.guard';
import { ImportService } from './import.service';

@Controller('import')
@UseGuards(KeycloakAuthGuard, RolesGuard)
@Roles('admin')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('preview')
  @UseInterceptors(FileInterceptor('file'))
  async preview(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Файл не загружен');
    if (!file.originalname.match(/\.xlsx?$/i)) {
      throw new BadRequestException('Поддерживается только формат .xlsx');
    }
    return this.importService.parseExcel(file.buffer);
  }

  @Post('execute')
  @UseInterceptors(FileInterceptor('file'))
  async execute(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Файл не загружен');
    if (!file.originalname.match(/\.xlsx?$/i)) {
      throw new BadRequestException('Поддерживается только формат .xlsx');
    }
    const rows = await this.importService.parseExcel(file.buffer);
    return this.importService.executeImport(rows);
  }
}
