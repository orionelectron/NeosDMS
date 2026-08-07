import { TRANSACTION_TYPES } from '../../accounting/accounting.constants';
import type { Seed } from './seed.interface';

/**
 * System transaction types (global rows, organization_id NULL). Per-org
 * documents reference these by code.
 */
export const transactionTypesSeed: Seed = {
  version: 8,
  name: 'transaction-types',
  async run(manager) {
    const rows = TRANSACTION_TYPES.map((type) => ({
      code: type.code,
      name: type.name,
      nature: type.nature,
      affects_inventory: type.affectsInventory,
      affects_tax: type.affectsTax,
    }));

    await manager.query(
      `INSERT INTO transaction_types
         (id, organization_id, code, name, nature, is_cross_border,
          affects_inventory, affects_tax, is_system)
       SELECT uuid_generate_v4(), NULL, t.code, t.name, t.nature, false,
              t.affects_inventory, t.affects_tax, true
       FROM jsonb_to_recordset($1::jsonb)
            AS t(code text, name text, nature text,
                  affects_inventory boolean, affects_tax boolean)
       ON CONFLICT (code) WHERE organization_id IS NULL DO NOTHING`,
      [JSON.stringify(rows)],
    );
  },
};
