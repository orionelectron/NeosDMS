import type { Seed } from './seed.interface';
import { billingPeriodsSeed } from './billing-periods.seed';
import { baseRolesSeed } from './base-roles.seed';
import { modulesSeed } from './modules.seed';
import { modulesIamSeed } from './modules-iam.seed';
import { permissionsSeed } from './permissions.seed';
import { plansSeed } from './plans.seed';

/**
 * Seed registry — ordered by ascending `version`; each runs exactly once
 * inside a transaction (see `runSeeds`).
 * 1-3: Phase 1 tenant + subscription catalogs.
 * 4-6: Phase 2 — IAM modules, permission catalog, base roles backfill.
 */
export const SEEDS: readonly Seed[] = [
  modulesSeed,
  billingPeriodsSeed,
  plansSeed,
  modulesIamSeed,
  permissionsSeed,
  baseRolesSeed,
];
