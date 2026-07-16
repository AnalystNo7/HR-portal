import { Module } from '@nestjs/common';
import { Oc360Module } from '../oc360/oc360.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [Oc360Module], // для LlmService (экспортируется из Oc360Module)
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
