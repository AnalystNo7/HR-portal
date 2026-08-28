import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';

@Injectable()
export class KeycloakAuthGuard extends PassportAuthGuard('keycloak') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  // при отсутствии/невалидности токена — 401, а не тихий пропуск с req.user=null
  // (иначе эндпоинты под этим guard были бы доступны без аутентификации)
  handleRequest(err: any, user: any) {
    if (err || !user) {
      throw err instanceof Error ? err : new UnauthorizedException();
    }
    return user;
  }
}
