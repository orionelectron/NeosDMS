import { PLAN_PROFILES } from '../../subscription/plan-profiles';
import type { Seed } from './seed.interface';

export const plansSeed: Seed = {
  version: 3,
  name: 'plans-and-price-matrices',
  async run(manager) {
    for (const profile of PLAN_PROFILES) {
      await manager.query(
        `INSERT INTO plans (id, code, name, description, grace_period_days, is_active, limits)
         VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6::jsonb)
         ON CONFLICT (code) DO NOTHING`,
        [
          profile.code,
          profile.name,
          profile.description,
          profile.gracePeriodDays,
          profile.isActive,
          JSON.stringify(profile.limits),
        ],
      );
    }

    for (const profile of PLAN_PROFILES) {
      for (const price of profile.pricing) {
        await manager.query(
          `INSERT INTO price_matrices
             (id, plan_id, billing_period_id, base_price, currency, is_tax_inclusive)
           SELECT uuid_generate_v4(), p.id, bp.id, $3, 'NPR', $4
           FROM plans p, billing_periods bp
           WHERE p.code = $1 AND bp.name = $2
           ON CONFLICT DO NOTHING`,
          [
            profile.code,
            price.periodName,
            price.basePrice,
            price.isTaxInclusive ?? false,
          ],
        );
      }
    }
  },
};
