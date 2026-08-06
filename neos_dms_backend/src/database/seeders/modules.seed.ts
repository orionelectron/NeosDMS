import type { Seed } from './seed.interface';

const MODULE_CATALOG: ReadonlyArray<{
  name: string;
  code: string;
  description: string;
}> = [
  {
    name: 'Trading',
    code: 'trading',
    description: 'Items, categories, brands, UOMs',
  },
  {
    name: 'Sales',
    code: 'sales',
    description: 'Orders, invoices, returns, receipts',
  },
  {
    name: 'Purchase',
    code: 'purchase',
    description: 'Orders, GRN, bills, supplier payments',
  },
  {
    name: 'Inventory',
    code: 'inventory',
    description: 'Locations, stock transactions, balances',
  },
  {
    name: 'Accounting',
    code: 'accounting',
    description: 'Chart of accounts, journal, reports',
  },
  {
    name: 'Reports',
    code: 'reports',
    description: 'Business reports and analytics',
  },
  {
    name: 'Dispatch',
    code: 'dispatch',
    description: 'Delivery and dispatch management',
  },
];

export const modulesSeed: Seed = {
  version: 1,
  name: 'modules-catalog',
  async run(manager) {
    await manager.query(
      `INSERT INTO modules (id, name, code, description)
       SELECT uuid_generate_v4(), m.name, m.code, m.description
       FROM jsonb_to_recordset($1::jsonb)
            AS m(name text, code text, description text)
       ON CONFLICT (code) DO NOTHING`,
      [JSON.stringify(MODULE_CATALOG)],
    );
  },
};
