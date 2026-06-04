import { Module } from '@nestjs/common';
import { TemplateController } from './template/template.controller';
import { TemplateService } from './template/template.service';
import { CycleController } from './cycle/cycle.controller';
import { CycleService } from './cycle/cycle.service';
import { RespondentController } from './respondent/respondent.controller';
import { RespondentService } from './respondent/respondent.service';
import { ResultsController } from './results/results.controller';
import { ResultsService } from './results/results.service';

@Module({
  controllers: [TemplateController, CycleController, RespondentController, ResultsController],
  providers: [TemplateService, CycleService, RespondentService, ResultsService],
})
export class Oc360Module {}
