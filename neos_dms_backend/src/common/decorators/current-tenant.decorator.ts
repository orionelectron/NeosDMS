import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export interface TenantContext {
  id: string;
}

export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantContext | undefined =>
    ctx.switchToHttp().getRequest<Request & { tenant: TenantContext }>().tenant,
);
