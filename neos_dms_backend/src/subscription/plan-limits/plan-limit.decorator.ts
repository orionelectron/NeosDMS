export const PLAN_LIMIT_KEY = 'plan-limit';

/**
 * Marks a handler as consuming a periodic plan limit after a successful run.
 * Applied with `@UseInterceptors(PlanLimitInterceptor)`.
 *
 * Note: for money/stock-critical flows prefer `PlanLimitService.consumePeriodic`
 * inside the domain transaction; this decorator is a convenience for simple
 * mutations where pre-check + post-consume drift is acceptable.
 */
export function PlanLimit(code: string): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
    Reflect.defineMetadata(PLAN_LIMIT_KEY, code, descriptor.value as object);
    return descriptor;
  };
}
