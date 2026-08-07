import type { Seed } from './seed.interface';
import { billingPeriodsSeed } from './billing-periods.seed';
import { baseRolesSeed } from './base-roles.seed';
import { accountingBackfillSeed } from './accounting-backfill.seed';
import { modulesSeed } from './modules.seed';
import { modulesIamSeed } from './modules-iam.seed';
import { permissionsSeed } from './permissions.seed';
import { plansSeed } from './plans.seed';
import { taxCatalogSeed } from './tax-catalog.seed';
import { tradingPermissionsSeed } from './trading-permissions.seed';
import { transactionTypesSeed } from './transaction-types.seed';
import { fieldPermissionsSeed } from './field-permissions.seed';

/**
 * Seed registry — ordered by ascending `version`; each runs exactly once
 * inside a transaction (see `runSeeds`).
 * 1-3: Phase 1 tenant + subscription catalogs.
 * 4-6: Phase 2 — IAM modules, permission catalog, base roles backfill.
 * 7-9: Phase 3 — tax catalog, transaction types, accounting backfill.
 * 10:  Phase 4 — trading permission backfill (item-category/brand/uom-conversion).
 * 11:  Phase 5d — field-sales permission backfill (outlet/route/visit).
 */
export const SEEDS: readonly Seed[] = [
  modulesSeed,
  billingPeriodsSeed,
  plansSeed,
  modulesIamSeed,
  permissionsSeed,
  baseRolesSeed,
  taxCatalogSeed,
  transactionTypesSeed,
  accountingBackfillSeed,
  tradingPermissionsSeed,
  fieldPermissionsSeed,
];
