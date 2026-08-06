import type { Seed } from './seed.interface';
import { billingPeriodsSeed } from './billing-periods.seed';
import { modulesSeed } from './modules.seed';
import { plansSeed } from './plans.seed';

/**
 * Seed registry — ordered by ascending `version`; each runs exactly once
 * inside a transaction (see `runSeeds`).
 * 1-3: Phase 1 tenant + subscription catalogs.
 * Phase 2 appends base roles/permissions once `roles`/`permissions` exist.
 */
export const SEEDS: readonly Seed[] = [
  modulesSeed,
  billingPeriodsSeed,
  plansSeed,
];
