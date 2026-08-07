import { MigrationInterface, QueryRunner } from 'typeorm';

export class SalesTarget1786400000000 implements MigrationInterface {
  name = 'SalesTarget1786400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // sales_targets (decision 35): monthly BS sales targets per salesperson,
    // either whole-person (PERSONAL), per product category, or per product
    // brand. Uniqueness per salesperson/period/dimension uses a functional
    // unique index so nullable refs do not create duplicate PERSONAL rows.
    await queryRunner.query(
      `CREATE TABLE "sales_targets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "user_id" uuid NOT NULL, "bs_year" integer NOT NULL, "bs_month" integer NOT NULL, "target_type" character varying NOT NULL, "category_id" uuid, "brand_id" uuid, "amount" numeric(14,2) NOT NULL, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_sales_targets" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sales_targets_org_user_period" ON "sales_targets"  ("organization_id", "user_id", "bs_year", "bs_month") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sales_targets_org_period" ON "sales_targets"  ("organization_id", "bs_year", "bs_month") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_sales_targets_dimension" ON "sales_targets"  ("organization_id", "user_id", "bs_year", "bs_month", "target_type", COALESCE("category_id", '00000000-0000-0000-0000-000000000000'::uuid), COALESCE("brand_id", '00000000-0000-0000-0000-000000000000'::uuid)) `,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_targets" ADD CONSTRAINT "chk_sales_targets_type" CHECK (target_type IN ('PERSONAL','CATEGORY','BRAND'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_targets" ADD CONSTRAINT "chk_sales_targets_month" CHECK (bs_month BETWEEN 1 AND 12)`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_targets" ADD CONSTRAINT "chk_sales_targets_amount" CHECK (amount >= 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_targets" ADD CONSTRAINT "chk_sales_targets_personal" CHECK (target_type <> 'PERSONAL' OR (category_id IS NULL AND brand_id IS NULL))`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_targets" ADD CONSTRAINT "chk_sales_targets_category" CHECK (target_type <> 'CATEGORY' OR (category_id IS NOT NULL AND brand_id IS NULL))`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_targets" ADD CONSTRAINT "chk_sales_targets_brand" CHECK (target_type <> 'BRAND' OR (brand_id IS NOT NULL AND category_id IS NULL))`,
    );

    // Foreign keys
    await queryRunner.query(
      `ALTER TABLE "sales_targets" ADD CONSTRAINT "FK_sales_targets_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_targets" ADD CONSTRAINT "FK_sales_targets_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_targets" ADD CONSTRAINT "FK_sales_targets_category" FOREIGN KEY ("category_id") REFERENCES "item_categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_targets" ADD CONSTRAINT "FK_sales_targets_brand" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sales_targets" DROP CONSTRAINT "FK_sales_targets_brand"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_targets" DROP CONSTRAINT "FK_sales_targets_category"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_targets" DROP CONSTRAINT "FK_sales_targets_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_targets" DROP CONSTRAINT "FK_sales_targets_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_targets" DROP CONSTRAINT "chk_sales_targets_brand"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_targets" DROP CONSTRAINT "chk_sales_targets_category"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_targets" DROP CONSTRAINT "chk_sales_targets_personal"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_targets" DROP CONSTRAINT "chk_sales_targets_amount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_targets" DROP CONSTRAINT "chk_sales_targets_month"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_targets" DROP CONSTRAINT "chk_sales_targets_type"`,
    );
    await queryRunner.query(`DROP INDEX "uq_sales_targets_dimension"`);
    await queryRunner.query(`DROP INDEX "idx_sales_targets_org_period"`);
    await queryRunner.query(`DROP INDEX "idx_sales_targets_org_user_period"`);
    await queryRunner.query(`DROP TABLE "sales_targets"`);
  }
}
