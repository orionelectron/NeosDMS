import { MigrationInterface, QueryRunner } from 'typeorm';
import { NepaliDateConverter } from '../../nepali-date/nepali-date-converter';
import {
  buildFiscalYearPlan,
  toDateString,
} from '../../accounting/provisioning.logic';

/**
 * Rebuilds existing fiscal years on the statutory Shrawan basis.
 *
 * Phase 3 initially provisioned fiscal years starting Baisakh 1 (BS calendar
 * year). Nepal's statutory (IRD) fiscal year starts Shrawan 1 (mid-July), so
 * existing orgs were re-planned: for each fiscal year, its label year is
 * read from the `name` (e.g. "2083/84" → 2083) and `buildFiscalYearPlan` is
 * reused as the single source of truth for dates. A fresh database is
 * unaffected — no fiscal years exist until org provisioning creates them.
 */
export class FixFiscalYearShrawanBasis1786080000000 implements MigrationInterface {
  name = 'FixFiscalYearShrawanBasis1786080000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const converter = new NepaliDateConverter();
    const raw: unknown = await queryRunner.query(
      `SELECT id, organization_id, name FROM "fiscal_years"`,
    );
    const rows = raw as Array<{
      id: string;
      organization_id: string;
      name: string;
    }>;

    for (const row of rows) {
      const match = /^(\d{4})\//.exec(row.name);
      if (!match) continue;

      const plan = buildFiscalYearPlan(Number(match[1]), converter);

      await queryRunner.query(
        `DELETE FROM "fiscal_periods" WHERE "fiscal_year_id" = $1`,
        [row.id],
      );
      await queryRunner.query(
        `UPDATE "fiscal_years" SET "start_date" = $1, "end_date" = $2 WHERE "id" = $3`,
        [toDateString(plan.startDate), toDateString(plan.endDate), row.id],
      );

      for (const period of plan.periods) {
        await queryRunner.query(
          `INSERT INTO "fiscal_periods" ("id", "fiscal_year_id", "name", "sequence", "start_date_bs", "end_date_bs", "start_date", "end_date", "is_locked") VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            row.id,
            period.name,
            period.sequence,
            period.startDateBs,
            period.endDateBs,
            toDateString(period.startDate),
            toDateString(period.endDate),
            false,
          ],
        );
      }
    }
  }

  public async down(): Promise<void> {
    // Not reversible: existing fiscal periods were regenerated on the
    // Shrawan basis. Rolling back would require the old Baisakh plans.
  }
}
