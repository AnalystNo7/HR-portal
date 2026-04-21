import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { KeycloakStrategy } from './keycloak.strategy';
import { KeycloakAuthGuard } from './auth.guard';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'keycloak' })],
  providers: [KeycloakStrategy, KeycloakAuthGuard],
  exports: [KeycloakAuthGuard],
})
export class AuthModule {}
