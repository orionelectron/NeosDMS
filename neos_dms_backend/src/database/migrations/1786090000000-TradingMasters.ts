import { MigrationInterface, QueryRunner } from 'typeorm';

export class TradingMasters1786090000000 implements MigrationInterface {
  name = 'TradingMasters1786090000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // item_categories (self-referencing, before items)
    await queryRunner.query(
      `CREATE TABLE "item_categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "parent_category_id" uuid, "name" character varying NOT NULL, "code" character varying, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_item_categories" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_item_categories_org_code" ON "item_categories"  ("organization_id", "code") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_item_categories_org_parent" ON "item_categories"  ("organization_id", "parent_category_id") `,
    );

    // uoms (before items/uom_conversions)
    await queryRunner.query(
      `CREATE TABLE "uoms" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "name" character varying NOT NULL, "short_name" character varying NOT NULL, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_uoms" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_uoms_org_short_name" ON "uoms"  ("organization_id", "short_name") `,
    );

    // brands (before items)
    await queryRunner.query(
      `CREATE TABLE "brands" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "name" character varying NOT NULL, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_brands" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_brands_org_name" ON "brands"  ("organization_id", "name") `,
    );

    // items (references categories/uoms/brands/tax_codes/accounts)
    await queryRunner.query(
      `CREATE TABLE "items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "parent_item_id" uuid, "name" character varying NOT NULL, "code" character varying, "sku" character varying, "barcode" character varying, "description" text, "type" character varying NOT NULL DEFAULT 'GOODS', "category_id" uuid, "brand_id" uuid, "base_uom_id" uuid NOT NULL, "hsn_code" character varying, "valuation_method" character varying NOT NULL DEFAULT 'FIFO', "tax_code_id" uuid, "mrp" numeric(15,2) NOT NULL DEFAULT 0, "sale_price" numeric(15,2) NOT NULL DEFAULT 0, "standard_cost" numeric(15,2) NOT NULL DEFAULT 0, "reorder_level" integer NOT NULL DEFAULT 0, "inventory_tracking" character varying NOT NULL DEFAULT 'QUANTITY', "track_expiry" boolean NOT NULL DEFAULT false, "allow_negative_stock" boolean NOT NULL DEFAULT false, "is_active" boolean NOT NULL DEFAULT true, "sales_account_id" uuid, "purchase_account_id" uuid, "sales_return_account_id" uuid, "purchase_return_account_id" uuid, CONSTRAINT "PK_items" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_items_org_code" ON "items"  ("organization_id", "code") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_items_org_sku" ON "items"  ("organization_id", "sku") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_items_org_parent" ON "items"  ("organization_id", "parent_item_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_items_barcode" ON "items"  ("barcode") `,
    );
    await queryRunner.query(
      `ALTER TABLE "items" ADD CONSTRAINT "chk_items_type" CHECK (type IN ('GOODS','SERVICE','RAW','ASSET'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "items" ADD CONSTRAINT "chk_items_valuation_method" CHECK (valuation_method IN ('FIFO','WEIGHTED_AVERAGE'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "items" ADD CONSTRAINT "chk_items_inventory_tracking" CHECK (inventory_tracking IN ('NONE','QUANTITY','BATCH','SERIAL'))`,
    );

    // uom_conversions (references items/uoms; org-wide when item_id IS NULL)
    await queryRunner.query(
      `CREATE TABLE "uom_conversions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "item_id" uuid, "from_uom_id" uuid NOT NULL, "to_uom_id" uuid NOT NULL, "conversion_factor" numeric(15,6) NOT NULL, CONSTRAINT "PK_uom_conversions" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_uom_conversions_org_item_from_to" ON "uom_conversions"  ("organization_id", "item_id", "from_uom_id", "to_uom_id") WHERE "item_id" IS NOT NULL `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_uom_conversions_org_from_to" ON "uom_conversions"  ("organization_id", "from_uom_id", "to_uom_id") WHERE "item_id" IS NULL `,
    );
    await queryRunner.query(
      `ALTER TABLE "uom_conversions" ADD CONSTRAINT "chk_uom_conversions_factor" CHECK ("conversion_factor" > 0)`,
    );

    // Foreign keys
    await queryRunner.query(
      `ALTER TABLE "item_categories" ADD CONSTRAINT "FK_item_categories_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "item_categories" ADD CONSTRAINT "FK_item_categories_parent" FOREIGN KEY ("parent_category_id") REFERENCES "item_categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "uoms" ADD CONSTRAINT "FK_uoms_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "brands" ADD CONSTRAINT "FK_brands_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "items" ADD CONSTRAINT "FK_items_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "items" ADD CONSTRAINT "FK_items_parent" FOREIGN KEY ("parent_item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "items" ADD CONSTRAINT "FK_items_category" FOREIGN KEY ("category_id") REFERENCES "item_categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "items" ADD CONSTRAINT "FK_items_brand" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "items" ADD CONSTRAINT "FK_items_base_uom" FOREIGN KEY ("base_uom_id") REFERENCES "uoms"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "items" ADD CONSTRAINT "FK_items_tax_code" FOREIGN KEY ("tax_code_id") REFERENCES "tax_codes"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "items" ADD CONSTRAINT "FK_items_sales_account" FOREIGN KEY ("sales_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "items" ADD CONSTRAINT "FK_items_purchase_account" FOREIGN KEY ("purchase_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "items" ADD CONSTRAINT "FK_items_sales_return_account" FOREIGN KEY ("sales_return_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "items" ADD CONSTRAINT "FK_items_purchase_return_account" FOREIGN KEY ("purchase_return_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "uom_conversions" ADD CONSTRAINT "FK_uom_conversions_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "uom_conversions" ADD CONSTRAINT "FK_uom_conversions_item" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "uom_conversions" ADD CONSTRAINT "FK_uom_conversions_from_uom" FOREIGN KEY ("from_uom_id") REFERENCES "uoms"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "uom_conversions" ADD CONSTRAINT "FK_uom_conversions_to_uom" FOREIGN KEY ("to_uom_id") REFERENCES "uoms"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "uom_conversions" DROP CONSTRAINT "FK_uom_conversions_to_uom"`,
    );
    await queryRunner.query(
      `ALTER TABLE "uom_conversions" DROP CONSTRAINT "FK_uom_conversions_from_uom"`,
    );
    await queryRunner.query(
      `ALTER TABLE "uom_conversions" DROP CONSTRAINT "FK_uom_conversions_item"`,
    );
    await queryRunner.query(
      `ALTER TABLE "uom_conversions" DROP CONSTRAINT "FK_uom_conversions_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "items" DROP CONSTRAINT "FK_items_purchase_return_account"`,
    );
    await queryRunner.query(
      `ALTER TABLE "items" DROP CONSTRAINT "FK_items_sales_return_account"`,
    );
    await queryRunner.query(
      `ALTER TABLE "items" DROP CONSTRAINT "FK_items_purchase_account"`,
    );
    await queryRunner.query(
      `ALTER TABLE "items" DROP CONSTRAINT "FK_items_sales_account"`,
    );
    await queryRunner.query(
      `ALTER TABLE "items" DROP CONSTRAINT "FK_items_tax_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "items" DROP CONSTRAINT "FK_items_base_uom"`,
    );
    await queryRunner.query(
      `ALTER TABLE "items" DROP CONSTRAINT "FK_items_brand"`,
    );
    await queryRunner.query(
      `ALTER TABLE "items" DROP CONSTRAINT "FK_items_category"`,
    );
    await queryRunner.query(
      `ALTER TABLE "items" DROP CONSTRAINT "FK_items_parent"`,
    );
    await queryRunner.query(
      `ALTER TABLE "items" DROP CONSTRAINT "FK_items_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "brands" DROP CONSTRAINT "FK_brands_org"`,
    );
    await queryRunner.query(`ALTER TABLE "uoms" DROP CONSTRAINT "FK_uoms_org"`);
    await queryRunner.query(
      `ALTER TABLE "item_categories" DROP CONSTRAINT "FK_item_categories_parent"`,
    );
    await queryRunner.query(
      `ALTER TABLE "item_categories" DROP CONSTRAINT "FK_item_categories_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "uom_conversions" DROP CONSTRAINT "chk_uom_conversions_factor"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_uom_conversions_org_from_to"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_uom_conversions_org_item_from_to"`,
    );
    await queryRunner.query(`DROP TABLE "uom_conversions"`);
    await queryRunner.query(
      `ALTER TABLE "items" DROP CONSTRAINT "chk_items_inventory_tracking"`,
    );
    await queryRunner.query(
      `ALTER TABLE "items" DROP CONSTRAINT "chk_items_valuation_method"`,
    );
    await queryRunner.query(
      `ALTER TABLE "items" DROP CONSTRAINT "chk_items_type"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_items_barcode"`);
    await queryRunner.query(`DROP INDEX "public"."idx_items_org_parent"`);
    await queryRunner.query(`DROP INDEX "public"."uq_items_org_sku"`);
    await queryRunner.query(`DROP INDEX "public"."uq_items_org_code"`);
    await queryRunner.query(`DROP TABLE "items"`);
    await queryRunner.query(`DROP INDEX "public"."uq_brands_org_name"`);
    await queryRunner.query(`DROP TABLE "brands"`);
    await queryRunner.query(`DROP INDEX "public"."uq_uoms_org_short_name"`);
    await queryRunner.query(`DROP TABLE "uoms"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_item_categories_org_parent"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_item_categories_org_code"`,
    );
    await queryRunner.query(`DROP TABLE "item_categories"`);
  }
}
