import type { Plan, PlanLimits, PlanPricePoint } from "@/lib/api/plans";

/**
 * Offline fallback catalog mirroring the backend's canonical plan profiles
 * (`neos_dms_backend/src/subscription/plan-profiles.ts`). Used on the landing
 * and onboarding pages when the public catalog request fails (offline PWA).
 * A limit value of -1 means "unlimited".
 */
export const DEFAULT_PLANS: Plan[] = [
  {
    code: "starter",
    name: "Starter",
    description:
      "For a single-branch distributor just getting started with digital billing.",
    gracePeriodDays: 3,
    limits: {
      users: 5,
      branches: 1,
      items: 500,
      invoices_per_month: 1000,
      orders_per_month: 1000,
      purchase_receipts_per_month: 500,
      purchase_bills_per_month: 500,
      multi_branch: false,
      batch_tracking: false,
      offline: false,
    },
    pricing: [
      { period: "Monthly", durationDays: 30, basePrice: "1499.00", currency: "NPR", isTaxInclusive: false },
      { period: "Quarterly", durationDays: 90, basePrice: "4299.00", currency: "NPR", isTaxInclusive: false },
      { period: "Yearly", durationDays: 365, basePrice: "15999.00", currency: "NPR", isTaxInclusive: false },
    ],
  },
  {
    code: "growth",
    name: "Growth",
    description:
      "Multi-branch distribution with higher transaction volume and more users.",
    gracePeriodDays: 3,
    limits: {
      users: 20,
      branches: 3,
      items: 5000,
      invoices_per_month: 10000,
      orders_per_month: 10000,
      purchase_receipts_per_month: 5000,
      purchase_bills_per_month: 5000,
      multi_branch: true,
      batch_tracking: false,
      offline: false,
    },
    pricing: [
      { period: "Monthly", durationDays: 30, basePrice: "3999.00", currency: "NPR", isTaxInclusive: false },
      { period: "Quarterly", durationDays: 90, basePrice: "10999.00", currency: "NPR", isTaxInclusive: false },
      { period: "Yearly", durationDays: 365, basePrice: "39999.00", currency: "NPR", isTaxInclusive: false },
    ],
  },
  {
    code: "enterprise",
    name: "Enterprise",
    description:
      "Large-scale operations with batch tracking, offline support, and unlimited scale.",
    gracePeriodDays: 3,
    limits: {
      users: 100,
      branches: -1,
      items: -1,
      invoices_per_month: -1,
      orders_per_month: -1,
      purchase_receipts_per_month: -1,
      purchase_bills_per_month: -1,
      multi_branch: true,
      batch_tracking: true,
      offline: true,
    },
    pricing: [
      { period: "Monthly", durationDays: 30, basePrice: "9999.00", currency: "NPR", isTaxInclusive: false },
      { period: "Quarterly", durationDays: 90, basePrice: "27999.00", currency: "NPR", isTaxInclusive: false },
      { period: "Yearly", durationDays: 365, basePrice: "99999.00", currency: "NPR", isTaxInclusive: false },
    ],
  },
];

export const BILLING_PERIODS = ["Monthly", "Quarterly", "Yearly"] as const;
export type BillingPeriod = (typeof BILLING_PERIODS)[number];
export const DEFAULT_PERIOD: BillingPeriod = "Monthly";

export function getPlanPrice(
  plan: Plan,
  period: string,
): PlanPricePoint | undefined {
  return plan.pricing.find(
    (point) => point.period.toLowerCase() === period.toLowerCase(),
  );
}

export interface LimitRow {
  label: string;
  value: number;
}

export const LIMIT_ROWS: { key: keyof PlanLimits; label: string }[] = [
  { key: "users", label: "Team members" },
  { key: "branches", label: "Branches" },
  { key: "items", label: "Products" },
  { key: "invoices_per_month", label: "Invoices / month" },
  { key: "orders_per_month", label: "Orders / month" },
  { key: "purchase_bills_per_month", label: "Purchase bills / month" },
];

export function formatLimit(value: number): string {
  return value === -1 ? "Unlimited" : String(value);
}

export function hasFlag(limit: PlanLimits, key: keyof PlanLimits): boolean {
  return Boolean(limit[key]);
}
