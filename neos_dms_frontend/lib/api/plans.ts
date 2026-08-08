import { apiFetch } from "@/lib/api/http";

export interface PlanPricePoint {
  period: string;
  durationDays: number;
  basePrice: string;
  currency: string;
  isTaxInclusive: boolean;
}

export interface PlanLimits {
  users: number;
  branches: number;
  items: number;
  invoices_per_month: number;
  orders_per_month: number;
  purchase_receipts_per_month: number;
  purchase_bills_per_month: number;
  multi_branch: boolean;
  batch_tracking: boolean;
  offline: boolean;
}

export interface Plan {
  code: string;
  name: string;
  description: string | null;
  gracePeriodDays: number;
  limits: PlanLimits;
  pricing: PlanPricePoint[];
}

export const plansApi = {
  list() {
    return apiFetch<Plan[]>("/subscription/plans", { auth: false });
  },
};
