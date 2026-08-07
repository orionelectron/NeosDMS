import { MigrationInterface, QueryRunner } from 'typeorm';

export class TaxCodeUniqueness1786072881892 implements MigrationInterface {
  name = 'TaxCodeUniqueness1786072881892';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Replace the non-unique org+name index on tax_codes with a unique one so
    // per-org tax codes cannot be duplicated (matches accounts/payment_terms/
    // payment_methods/fiscal_years uniqueness).
    await queryRunner.query(`DROP INDEX "idx_tax_codes_org_name"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_tax_codes_org_name" ON "tax_codes"  ("organization_id", "name") `,
    );
    // Templates are global singletons; prevent duplicate names so the
    // provisioning lookup by name stays deterministic.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_tax_templates_name" ON "tax_templates"  ("name") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "uq_tax_templates_name"`);
    await queryRunner.query(`DROP INDEX "uq_tax_codes_org_name"`);
    await queryRunner.query(
      `CREATE INDEX "idx_tax_codes_org_name" ON "tax_codes"  ("organization_id", "name") `,
    );
  }
}
