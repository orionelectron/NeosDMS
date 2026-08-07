import { MigrationInterface, QueryRunner } from 'typeorm';
import { DEFAULT_TDS_CODES } from '../../accounting/accounting.constants';

/**
 * Phase 7a (decision 43): TDS becomes a system purpose.
 *
 * Backfills orgs provisioned before decision 43:
 *  - marks each org's 2103 TDS Payable account as a locked system account
 *    (`system_purpose = 'TDS_PAYABLE'`) so the posting engine can resolve it;
 *  - adds the missing global TDS tax templates (5% rent, 10% interest) to the
 *    catalog so it is complete alongside the existing 1.5% / 15% templates;
 *  - provisions the four per-org TDS withholding codes wired to that 2103
 *    account (new orgs get the same codes at onboarding via
 *    `provisionAccounting`).
 */
export class TdsPayable1786950000000 implements MigrationInterface {
  name = 'TdsPayable1786950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "accounts"
         SET "system_purpose" = 'TDS_PAYABLE',
             "is_system_account" = true,
             "is_locked" = true
       WHERE "code" = '2103'
         AND ("system_purpose" IS NULL OR "system_purpose" <> 'TDS_PAYABLE')`,
    );

    await queryRunner.query(
      `INSERT INTO "tax_templates"
         (id, tax_type_id, name, rate, ird_category, math_sign, is_active)
       SELECT uuid_generate_v4(), tt.id, t.name, t.rate,
              'TDS_WITHHOLDING', -1, true
       FROM jsonb_to_recordset($1::jsonb)
            AS t(name text, rate numeric)
       JOIN "tax_types" tt ON tt.name = 'TDS'
       ON CONFLICT ("name") DO NOTHING`,
      [
        JSON.stringify([
          { name: 'TDS 5%', rate: '5' },
          { name: 'TDS 10%', rate: '10' },
        ]),
      ],
    );

    await queryRunner.query(
      `INSERT INTO "tax_codes"
         (id, organization_id, tax_type_id, account_id, name, ird_category,
          rate, effective_from, effective_to, is_locked, is_active,
          "createdAt", "updatedAt")
       SELECT uuid_generate_v4(), o.id, tt.id, a.id, c.name,
              'TDS_WITHHOLDING', c.rate, CURRENT_DATE, NULL, true, true,
              now(), now()
       FROM jsonb_to_recordset($1::jsonb)
            AS c(name text, rate numeric)
       CROSS JOIN "organizations" o
       JOIN "tax_types" tt ON tt.name = 'TDS'
       JOIN "accounts" a
         ON a.organization_id = o.id AND a.code = '2103'
       ON CONFLICT ("organization_id", "name") DO NOTHING`,
      [JSON.stringify(DEFAULT_TDS_CODES)],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "tax_codes"
       WHERE "ird_category" = 'TDS_WITHHOLDING'`,
    );
    await queryRunner.query(
      `DELETE FROM "tax_templates"
       WHERE "name" IN ('TDS 5%', 'TDS 10%')`,
    );
    await queryRunner.query(
      `UPDATE "accounts"
         SET "system_purpose" = NULL,
             "is_system_account" = false,
             "is_locked" = false
       WHERE "code" = '2103' AND "system_purpose" = 'TDS_PAYABLE'`,
    );
  }
}
