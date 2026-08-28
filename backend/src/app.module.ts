import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
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
import { Oc360Module } from './oc360/oc360.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    // глобальный лимит частоты запросов по IP клиента (защита от перебора/DoS);
    // счёт по реальному IP — благодаря trust proxy в main.ts (за Traefik).
    // Точечные жёсткие лимиты см. @Throttle на дорогих эндпоинтах.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule, AuthModule, EmployeesModule, ProfileModule, AppealsModule, MeModule, ImportModule, DepartmentsModule, PositionsModule, Oc360Module, SettingsModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
