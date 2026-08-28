import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { KeycloakStrategy } from './keycloak.strategy';
import { KeycloakAuthGuard } from './auth.guard';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'keycloak' })],
  providers: [KeycloakStrategy, KeycloakAuthGuard, RolesGuard],
  exports: [KeycloakAuthGuard, RolesGuard],
})
export class AuthModule {}
