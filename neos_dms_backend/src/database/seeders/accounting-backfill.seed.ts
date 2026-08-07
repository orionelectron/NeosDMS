import { EntityManager } from 'typeorm';
import { provisionAccounting } from '../../accounting/provisioning.logic';
import type { Seed } from './seed.interface';

/**
 * Idempotent backfill for organizations created before Phase 3 (no COA/FY).
 * New orgs get provisioned in-transaction during onboarding instead.
 */
export const accountingBackfillSeed: Seed<EntityManager> = {
  version: 9,
  name: 'accounting-provision-backfill',
  async run(manager) {
    const raw: unknown = await manager.query('SELECT id FROM organizations');
    const orgRows = raw as Array<{ id: string }>;

    for (const row of orgRows) {
      await provisionAccounting(manager, row.id);
    }
  },
};
