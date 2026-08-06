import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export interface PermissionInfo {
  roleId: string | null;
  roleCode: string | null;
  permissions: string[];
}

export interface AuthenticatedUser {
  id: string;
  organizationId: string;
  branchId: string;
  role: PermissionInfo | null;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser | undefined =>
    ctx.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>().user,
);
