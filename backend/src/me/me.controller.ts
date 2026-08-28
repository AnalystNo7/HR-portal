import { Controller, ForbiddenException, Get, Req, UseGuards } from '@nestjs/common';
import { MeService, Role } from './me.service';
import { KeycloakAuthGuard } from '../auth/auth.guard';
import { AuthUser } from '../auth/keycloak.strategy';

@Controller('me')
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get()
  @UseGuards(KeycloakAuthGuard)
  get(@Req() req: any) {
    // guard гарантирует валидный токен; роль берём ТОЛЬКО из токена
    // (query-параметр ?role= убран — это была mock-заглушка, дававшая impersonation)
    const authUser: AuthUser = req.user;
    if (!authUser?.roles?.length) {
      throw new ForbiddenException('У пользователя нет назначенных ролей');
    }
    const role = this.pickHighestRole(authUser.roles);
    return this.meService.getByRoleAndEmail(role, authUser.email);
  }

  private pickHighestRole(roles: string[]): Role {
    if (roles.includes('admin')) return 'admin';
    if (roles.includes('hr')) return 'hr';
    if (roles.includes('manager')) return 'manager';
    return 'employee';
  }
}
