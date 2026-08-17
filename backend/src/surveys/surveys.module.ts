import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SurveysController } from './surveys.controller';
import { BurnoutService } from './burnout.service';

@Module({
  imports: [PrismaModule],
  controllers: [SurveysController],
  providers: [BurnoutService],
})
export class SurveysModule {}
