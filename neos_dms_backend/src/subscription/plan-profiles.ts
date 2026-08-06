import type { PlanLimits } from './subscription.constants';

export interface PlanPricePoint {
  periodName: string;
  basePrice: string;
  isTaxInclusive?: boolean;
}

export interface PlanProfile {
  code: string;
  name: string;
  description: string | null;
  gracePeriodDays: number;
  isActive: boolean;
  limits: PlanLimits;
  pricing: PlanPricePoint[];
}

/**
 * Canonical plan profiles — the only place plan limits/prices are defined.
 * A limit value of `-1` means "unlimited" (PlanLimitService never trips).
 */
export const PLAN_PROFILES: readonly PlanProfile[] = [
  {
    code: 'starter',
    name: 'Starter',
    description:
      'For a single-branch distributor just getting started with digital billing.',
    gracePeriodDays: 3,
    isActive: true,
    limits: {
      users: 5,
      branches: 1,
      items: 500,
      invoices_per_month: 1000,
      orders_per_month: 1000,
      purchase_receipts_per_month: 500,
      multi_branch: false,
      batch_tracking: false,
      offline: false,
    },
    pricing: [
      { periodName: 'Monthly', basePrice: '1499.00' },
      { periodName: 'Quarterly', basePrice: '4299.00' },
      { periodName: 'Yearly', basePrice: '15999.00' },
    ],
  },
  {
    code: 'growth',
    name: 'Growth',
    description:
      'Multi-branch distribution with higher transaction volume and more users.',
    gracePeriodDays: 3,
    isActive: true,
    limits: {
      users: 20,
      branches: 3,
      items: 5000,
      invoices_per_month: 10000,
      orders_per_month: 10000,
      purchase_receipts_per_month: 5000,
      multi_branch: true,
      batch_tracking: false,
      offline: false,
    },
    pricing: [
      { periodName: 'Monthly', basePrice: '3999.00' },
      { periodName: 'Quarterly', basePrice: '10999.00' },
      { periodName: 'Yearly', basePrice: '39999.00' },
    ],
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    description:
      'Large-scale operations with batch tracking, offline support, and unlimited scale.',
    gracePeriodDays: 3,
    isActive: true,
    limits: {
      users: 100,
      branches: -1,
      items: -1,
      invoices_per_month: -1,
      orders_per_month: -1,
      purchase_receipts_per_month: -1,
      multi_branch: true,
      batch_tracking: true,
      offline: true,
    },
    pricing: [
      { periodName: 'Monthly', basePrice: '9999.00' },
      { periodName: 'Quarterly', basePrice: '27999.00' },
      { periodName: 'Yearly', basePrice: '99999.00' },
    ],
  },
];
