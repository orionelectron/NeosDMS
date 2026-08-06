import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SUPERUSER_ROLE_CODE } from '../auth.constants';
import { PERMISSIONS_KEY } from '../auth.constants';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

/**
 * Global RBAC guard. Reads `@RequirePermission(...)` from the handler and
 * checks the authenticated user's role. The `admin` role is superuser and
 * bypasses every check (coarse admin path per plan §6.2).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
    }>();
    const user = request.user;
    if (!user) throw new UnauthorizedException('Not authenticated');

    if (user.role?.roleCode === SUPERUSER_ROLE_CODE) return true;

    const granted = user.role?.permissions ?? [];
    const hasAll = required.every((code) => granted.includes(code));
    if (!hasAll) {
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    }
    return true;
  }
}
