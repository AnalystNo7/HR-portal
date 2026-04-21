import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { MeService, Role } from './me.service';

@Controller('me')
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get()
  get(@Query('role') role?: string) {
    const validRoles: Role[] = ['employee', 'manager', 'hr'];
    const r = (role ?? 'employee') as Role;
    if (!validRoles.includes(r)) {
      throw new BadRequestException(`Invalid role: ${role}`);
    }
    return this.meService.getByRole(r);
  }
}
