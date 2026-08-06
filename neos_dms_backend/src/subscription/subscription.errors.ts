import { HttpException, HttpStatus } from '@nestjs/common';
import type { LimitValue } from './subscription.constants';

export class PlanLimitExceededException extends HttpException {
  constructor(resource: string, limit: LimitValue, current: number) {
    super(
      {
        code: 'PLAN_LIMIT_EXCEEDED',
        message: `Plan limit exceeded for '${resource}'`,
        details: { resource, limit, current },
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

export class PlanFeatureUnavailableException extends HttpException {
  constructor(resource: string) {
    super(
      {
        code: 'PLAN_FEATURE_UNAVAILABLE',
        message: `'${resource}' is not available on the current plan`,
        details: { resource },
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

export class NoActiveSubscriptionException extends HttpException {
  constructor() {
    super(
      {
        code: 'NO_ACTIVE_SUBSCRIPTION',
        message: 'No active subscription found for this organization',
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class SubscriptionConflictException extends HttpException {
  constructor(message = 'Organization already has an active subscription') {
    super(
      {
        code: 'SUBSCRIPTION_CONFLICT',
        message,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class PlanNotFoundException extends HttpException {
  constructor(code: string) {
    super(
      {
        code: 'PLAN_NOT_FOUND',
        message: `Plan '${code}' not found`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}
