import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rename `items.sale_price` to `items.rlp` (retail list price). The value is a
 * pricing anchor, not a valuation input — stock is valued by standard/moving
 * average cost, so the shorter name reflects its role as the list price.
 */
export class RenameItemSalePriceToRlp1787700000000 implements MigrationInterface {
  name = 'RenameItemSalePriceToRlp1787700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "items" RENAME COLUMN "sale_price" TO "rlp"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "items" RENAME COLUMN "rlp" TO "sale_price"`,
    );
  }
}
