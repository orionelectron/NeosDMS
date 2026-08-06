import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';
import { defer, lastValueFrom } from 'rxjs';
import { ORG_ID_CLS_KEY } from '../../common/request-context';
import { PlanLimitService } from './plan-limit.service';
import { PLAN_LIMIT_KEY } from './plan-limit.decorator';

/**
 * Asserts the periodic limit is available, runs the handler, then consumes
 * the limit only on success. Throws `PLAN_LIMIT_EXCEEDED` carrying
 * `{ resource, limit, current }` for the UI to upsell.
 */
@Injectable()
export class PlanLimitInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly cls: ClsService,
    private readonly planLimit: PlanLimitService,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): ReturnType<CallHandler['handle']> {
    const code = this.reflector.get<string>(
      PLAN_LIMIT_KEY,
      context.getHandler(),
    );
    if (!code) return next.handle();

    const organizationId = this.cls.get<string>(ORG_ID_CLS_KEY);
    if (!organizationId) {
      throw new UnauthorizedException('Tenant context is missing');
    }

    return defer(async () => {
      await this.planLimit.assertPeriodicAvailable(organizationId, code);
      const result: unknown = await lastValueFrom(next.handle());
      await this.planLimit.consumePeriodic(organizationId, code);
      return result;
    });
  }
}
