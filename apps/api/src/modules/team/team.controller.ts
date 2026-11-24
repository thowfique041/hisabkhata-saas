import { Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  inviteEmployeeSchema,
  PERMISSION_GROUPS,
  PERMISSIONS,
  roleSchema,
  updateMembershipSchema,
} from '@hisabkhata/shared';
import { RequirePermissions, Tenant, ZBody } from '../../common/decorators';
import type { TenantContext } from '../../common/types';
import { PrismaService } from '../../prisma/prisma.service';
import { TeamService } from './team.service';

@ApiTags('Team')
@Controller()
export class TeamController {
  constructor(
    private readonly team: TeamService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('employees')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_VIEW)
  list(@Tenant() t: TenantContext) {
    return this.team.list(t.tenantId);
  }

  @Post('employees')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)
  async invite(@Tenant() t: TenantContext, @ZBody(inviteEmployeeSchema) body: any) {
    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: t.userId }, select: { name: true } });
    return this.team.invite(t, body, me.name);
  }

  @Patch('employees/:id')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)
  update(@Tenant() t: TenantContext, @Param('id') id: string, @ZBody(updateMembershipSchema) body: any) {
    return this.team.update(t, id, body);
  }

  @Delete('employees/:id')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)
  remove(@Tenant() t: TenantContext, @Param('id') id: string) {
    return this.team.remove(t, id);
  }

  @Get('roles')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_VIEW)
  roles(@Tenant() t: TenantContext) {
    return this.team.roles(t.tenantId);
  }

  @Get('permissions')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_VIEW)
  permissions() {
    return PERMISSION_GROUPS;
  }

  @Post('roles')
  @RequirePermissions(PERMISSIONS.ROLE_MANAGE)
  createRole(@Tenant() t: TenantContext, @ZBody(roleSchema) body: any) {
    return this.team.createRole(t, body);
  }

  @Put('roles/:id')
  @RequirePermissions(PERMISSIONS.ROLE_MANAGE)
  updateRole(@Tenant() t: TenantContext, @Param('id') id: string, @ZBody(roleSchema) body: any) {
    return this.team.updateRole(t, id, body);
  }

  @Delete('roles/:id')
  @RequirePermissions(PERMISSIONS.ROLE_MANAGE)
  deleteRole(@Tenant() t: TenantContext, @Param('id') id: string) {
    return this.team.deleteRole(t, id);
  }
}
