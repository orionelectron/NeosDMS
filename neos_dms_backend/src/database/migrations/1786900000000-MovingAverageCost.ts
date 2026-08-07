import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 7a (decision 42): perpetual moving-average COGS.
 *
 * `inventory_balances.avg_cost` holds the moving-average unit cost per org ×
 * location × item (base uom). Value enters on the purchase bill (a later
 * phase) which reweights it; this migration only adds the column — the COGS
 * consumption side (sales invoice) is wired in the same slice.
 *
 * `sales_invoice_lines.cogs_unit_cost` snapshots the avg_cost at invoice POST
 * so a later sales return can reverse COGS at the original cost.
 */
export class MovingAverageCost1786900000000 implements MigrationInterface {
  name = 'MovingAverageCost1786900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "inventory_balances" ADD COLUMN "avg_cost" numeric(15,2) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_balances" ADD CONSTRAINT "chk_inventory_balances_avg_cost" CHECK (avg_cost >= 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoice_lines" ADD COLUMN "cogs_unit_cost" numeric(15,2) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "chk_sales_invoice_lines_cogs" CHECK (cogs_unit_cost >= 0)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sales_invoice_lines" DROP CONSTRAINT "chk_sales_invoice_lines_cogs"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoice_lines" DROP COLUMN "cogs_unit_cost"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_balances" DROP CONSTRAINT "chk_inventory_balances_avg_cost"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_balances" DROP COLUMN "avg_cost"`,
    );
  }
}
