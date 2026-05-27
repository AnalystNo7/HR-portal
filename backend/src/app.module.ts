import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { EmployeesModule } from './employees/employees.module';
import { ProfileModule } from './profile/profile.module';
import { AppealsModule } from './appeals/appeals.module';
import { MeModule } from './me/me.module';
import { ImportModule } from './import/import.module';
import { DepartmentsModule } from './departments/departments.module';
import { PositionsModule } from './positions/positions.module';

@Module({
  imports: [PrismaModule, AuthModule, EmployeesModule, ProfileModule, AppealsModule, MeModule, ImportModule, DepartmentsModule, PositionsModule],
  controllers: [AppController],
})
export class AppModule {}
