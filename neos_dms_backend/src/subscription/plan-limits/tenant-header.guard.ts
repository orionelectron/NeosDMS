import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { ClsService } from 'nestjs-cls';
import type { Request } from 'express';
import { ORG_ID_CLS_KEY, ORG_ID_HEADER } from '../../common/request-context';
import type { TenantContext } from '../../common/decorators/current-tenant.decorator';

/**
 * Phase-1 tenant shim: resolves the organization from the
 * `x-organization-id` header and stores it in CLS + `req.tenant`.
 * Phase 2 replaces this with JWT auth that populates the same CLS key.
 */
@Injectable()
export class TenantHeaderGuard implements CanActivate {
  constructor(private readonly cls: ClsService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { tenant?: TenantContext }>();

    const raw = request.headers[ORG_ID_HEADER];
    const organizationId = Array.isArray(raw) ? raw[0] : raw;

    if (!organizationId) {
      throw new UnauthorizedException(
        `Missing '${ORG_ID_HEADER}' header — Phase 1 tenant shim`,
      );
    }
    if (!isUUID(organizationId)) {
      throw new BadRequestException(`${ORG_ID_HEADER} must be a UUID`);
    }

    request.tenant = { id: organizationId };
    this.cls.set(ORG_ID_CLS_KEY, organizationId);
    return true;
  }
}
