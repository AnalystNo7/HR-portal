import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { MeService, Role } from './me.service';
import { KeycloakAuthGuard } from '../auth/auth.guard';
import { AuthUser } from '../auth/keycloak.strategy';

@Controller('me')
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get()
  @UseGuards(KeycloakAuthGuard)
  get(@Req() req: any, @Query('role') roleParam?: string) {
    const authUser: AuthUser | null = req.user;

    if (authUser && authUser.roles.length > 0) {
      const role = this.pickHighestRole(authUser.roles);
      return this.meService.getByRoleAndEmail(role, authUser.email);
    }

    const validRoles: Role[] = ['employee', 'manager', 'hr'];
    const r = (roleParam ?? 'employee') as Role;
    if (!validRoles.includes(r)) {
      return this.meService.getByRole(r);
    }
    return this.meService.getByRole(r);
  }

  private pickHighestRole(roles: string[]): Role {
    if (roles.includes('hr')) return 'hr';
    if (roles.includes('manager')) return 'manager';
    return 'employee';
  }
}
