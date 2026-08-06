import type { Seed } from './seed.interface';

const BILLING_PERIODS: ReadonlyArray<{ name: string; durationDays: number }> = [
  { name: 'Monthly', durationDays: 30 },
  { name: 'Quarterly', durationDays: 90 },
  { name: 'Yearly', durationDays: 365 },
];

export const billingPeriodsSeed: Seed = {
  version: 2,
  name: 'billing-periods',
  async run(manager) {
    const rows = BILLING_PERIODS.map((period) => ({
      name: period.name,
      duration_days: period.durationDays,
    }));
    await manager.query(
      `INSERT INTO billing_periods (id, name, duration_days)
       SELECT uuid_generate_v4(), bp.name, bp.duration_days
       FROM jsonb_to_recordset($1::jsonb)
            AS bp(name text, duration_days integer)
       ON CONFLICT (name) DO NOTHING`,
      [JSON.stringify(rows)],
    );
  },
};
