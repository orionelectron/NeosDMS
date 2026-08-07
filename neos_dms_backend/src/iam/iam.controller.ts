import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import type { TenantContext } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Paginated, paginate } from '../common/dto/pagination.dto';
import { AuditService } from '../audit/audit.service';
import { RequirePermission } from './decorators/require-permission.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AuditLogQueryDto, UserListQueryDto } from './dto/query.dto';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { IamService } from './iam.service';

@ApiBearerAuth()
@ApiTags('iam')
@Controller()
export class IamController {
  constructor(
    private readonly iamService: IamService,
    private readonly auditService: AuditService,
  ) {}

  // ---------- Users ----------

  @RequirePermission('iam.user.read')
  @Get('users')
  @ApiOperation({ summary: 'List users (paginated, optional search)' })
  async listUsers(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: UserListQueryDto,
  ): Promise<Paginated<unknown>> {
    const [data, total] = await this.iamService.listUsers(
      tenant.id,
      query.page,
      query.limit,
      query.search,
    );
    return paginate(data, total, query);
  }

  @RequirePermission('iam.user.read')
  @Get('users/:id')
  @ApiOperation({ summary: 'Get a user by id' })
  getUser(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.iamService.getUser(tenant.id, id);
  }

  @RequirePermission('iam.user.create')
  @Post('users')
  @ApiOperation({
    summary: 'Create a user (enforces the users seat limit)',
  })
  createUser(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateUserDto,
    @Req() req: Request,
  ) {
    return this.iamService.createUser(
      {
        organizationId: tenant.id,
        branchId: dto.branchId,
        roleId: dto.roleId ?? null,
        managerId: dto.managerId ?? null,
        fullName: dto.fullName,
        email: dto.email,
        password: dto.password,
        username: dto.username ?? null,
        mustChangePassword: dto.mustChangePassword ?? true,
      },
      actor.id,
      req.ip ?? null,
    );
  }

  @RequirePermission('iam.user.update')
  @Patch('users/:id')
  @ApiOperation({ summary: 'Update a user' })
  updateUser(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.iamService.updateUser(tenant.id, id, dto, actor.id);
  }

  @RequirePermission('iam.user.delete')
  @Delete('users/:id')
  @ApiOperation({ summary: 'Soft-delete a user (revokes sessions)' })
  async removeUser(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.iamService.removeUser(tenant.id, id, actor.id);
    return { deleted: true };
  }

  @Post('users/change-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Change own password (clears mustChangePassword)' })
  async changePassword(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.iamService.changePassword(
      actor.id,
      dto.currentPassword,
      dto.newPassword,
    );
    return { changed: true };
  }

  // ---------- Roles ----------

  @RequirePermission('iam.role.read')
  @Get('roles')
  @ApiOperation({ summary: 'List organization roles' })
  listRoles(@CurrentTenant() tenant: TenantContext) {
    return this.iamService.listRoles(tenant.id);
  }

  @RequirePermission('iam.role.read')
  @Get('roles/:id')
  @ApiOperation({ summary: 'Get a role with its permission mappings' })
  getRole(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.iamService.getRole(tenant.id, id);
  }

  @RequirePermission('iam.role.create')
  @Post('roles')
  @ApiOperation({ summary: 'Create a custom role' })
  createRole(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateRoleDto,
  ) {
    return this.iamService.createRole(tenant.id, dto, actor.id);
  }

  @RequirePermission('iam.role.update')
  @Patch('roles/:id')
  @ApiOperation({ summary: 'Update a custom role' })
  updateRole(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.iamService.updateRole(tenant.id, id, dto, actor.id);
  }

  @RequirePermission('iam.role.delete')
  @Delete('roles/:id')
  @ApiOperation({ summary: 'Delete a custom role' })
  async deleteRole(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.iamService.deleteRole(tenant.id, id, actor.id);
    return { deleted: true };
  }

  // ---------- Permissions ----------

  @RequirePermission('iam.permission.read')
  @Get('permissions')
  @ApiOperation({ summary: 'Permission catalog grouped by module' })
  listPermissions() {
    return this.iamService.listPermissions();
  }

  // ---------- Audit ----------

  @RequirePermission('iam.audit-log.read')
  @Get('audit-logs')
  @ApiOperation({ summary: 'Audit trail (paginated, filterable)' })
  async auditLogs(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: AuditLogQueryDto,
  ): Promise<Paginated<unknown>> {
    const [data, total] = await this.auditService.query({
      organizationId: tenant.id,
      page: query.page,
      limit: query.limit,
      action: query.action,
      entityType: query.entityType,
      userId: query.userId,
    });
    return paginate(data, total, query);
  }
}
