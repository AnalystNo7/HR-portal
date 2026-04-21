import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';

@Injectable()
export class KeycloakAuthGuard extends PassportAuthGuard('keycloak') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any) {
    if (err || !user) return null;
    return user;
  }
}
