import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { ClsService } from 'nestjs-cls';
import { Repository } from 'typeorm';
import type { Request } from 'express';
import { CLS_USER_KEY } from '../../common/constants/cls-keys';
import type {
  AuthenticatedUser,
  PermissionInfo,
} from '../../common/decorators/current-user.decorator';
import type { TenantContext } from '../../common/decorators/current-tenant.decorator';
import { ORG_ID_CLS_KEY } from '../../common/request-context';
import { PUBLIC_KEY } from '../auth.constants';
import { UserEntity } from '../entities/user.entity';
import { TokenService } from '../token.service';

type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
  tenant?: TenantContext;
};

/**
 * Global bearer-token guard. Populates `req.user`, `req.tenant`, and the CLS
 * org/user keys used by tenant-scoped services and the plan-limit interceptor.
 * Skips handlers marked `@Public()`.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: TokenService,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly cls: ClsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.isPublic(context)) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearer(request);

    const claims = await this.tokenService.verifyAccessToken(token);
    if (claims.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    const user = await this.loadUser(claims.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account is not active');
    }

    const permissionInfo = this.buildPermissionInfo(user);
    request.user = {
      id: user.id,
      organizationId: user.organizationId,
      branchId: user.branchId,
      role: permissionInfo,
    };
    request.tenant = { id: user.organizationId };

    this.cls.set(ORG_ID_CLS_KEY, user.organizationId);
    this.cls.set(CLS_USER_KEY, request.user);
    return true;
  }

  private isPublic(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    );
  }

  private extractBearer(request: Request): string {
    const header = request.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    return header.slice('Bearer '.length).trim();
  }

  private async loadUser(userId: string): Promise<UserEntity | null> {
    return this.userRepo.findOne({
      where: { id: userId },
      relations: {
        role: { permissionMappings: { permission: true } },
      },
    });
  }

  private buildPermissionInfo(user: UserEntity): PermissionInfo {
    if (!user.role) return { roleId: null, roleCode: null, permissions: [] };
    return {
      roleId: user.role.id,
      roleCode: user.role.code,
      permissions: (user.role.permissionMappings ?? []).map(
        (mapping) => mapping.permission.code,
      ),
    };
  }
}
