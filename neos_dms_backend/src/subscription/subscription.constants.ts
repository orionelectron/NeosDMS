export const SUBSCRIPTION_STATUS = [
  'trialing',
  'active',
  'past_due',
  'canceled',
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS)[number];

export const LIVE_SUBSCRIPTION_STATUSES = [
  'trialing',
  'active',
  'past_due',
] as const;

export const TRANSACTION_STATUS = [
  'pending',
  'completed',
  'failed',
  'refunded',
] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUS)[number];

export const LIMIT_KIND = {
  SEAT: 'seat',
  PERIODIC: 'periodic',
  FEATURE: 'feature',
} as const;
export type LimitKind = (typeof LIMIT_KIND)[keyof typeof LIMIT_KIND];

export const LIMIT_RESOURCES = {
  USERS: 'users',
  BRANCHES: 'branches',
  ITEMS: 'items',
  INVOICES_PER_MONTH: 'invoices_per_month',
  ORDERS_PER_MONTH: 'orders_per_month',
  PURCHASE_RECEIPTS_PER_MONTH: 'purchase_receipts_per_month',
  PURCHASE_BILLS_PER_MONTH: 'purchase_bills_per_month',
  MULTI_BRANCH: 'multi_branch',
  BATCH_TRACKING: 'batch_tracking',
  OFFLINE: 'offline',
  CHEQUES: 'cheques',
  LANDED_COST: 'landed_cost',
} as const;
export type LimitResource =
  (typeof LIMIT_RESOURCES)[keyof typeof LIMIT_RESOURCES];

export type LimitValue = number | boolean;
export type PlanLimits = Record<string, LimitValue>;

export const DEFAULT_GRACE_PERIOD_DAYS = 3;
export const DEFAULT_TRIAL_DAYS = 14;

/** A limit value of `-1` means unlimited (never trips). */
export const UNLIMITED = -1;

export const FEATURE_RESOURCES: readonly string[] = [
  LIMIT_RESOURCES.MULTI_BRANCH,
  LIMIT_RESOURCES.BATCH_TRACKING,
  LIMIT_RESOURCES.OFFLINE,
  LIMIT_RESOURCES.CHEQUES,
  LIMIT_RESOURCES.LANDED_COST,
];

export function isFeatureResource(code: string): boolean {
  return FEATURE_RESOURCES.includes(code);
}

export function getLimitKind(code: string): LimitKind {
  if (isFeatureResource(code)) return LIMIT_KIND.FEATURE;
  switch (code) {
    case LIMIT_RESOURCES.INVOICES_PER_MONTH:
    case LIMIT_RESOURCES.ORDERS_PER_MONTH:
    case LIMIT_RESOURCES.PURCHASE_RECEIPTS_PER_MONTH:
    case LIMIT_RESOURCES.PURCHASE_BILLS_PER_MONTH:
      return LIMIT_KIND.PERIODIC;
    default:
      return LIMIT_KIND.SEAT;
  }
}
