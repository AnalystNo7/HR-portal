import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { EmployeesModule } from './employees/employees.module';
import { ProfileModule } from './profile/profile.module';
import { AppealsModule } from './appeals/appeals.module';
import { MeModule } from './me/me.module';

@Module({
  imports: [PrismaModule, EmployeesModule, ProfileModule, AppealsModule, MeModule],
  controllers: [AppController],
})
export class AppModule {}
