import { MigrationInterface, QueryRunner } from 'typeorm';

export class SalesOrder1786600000000 implements MigrationInterface {
  name = 'SalesOrder1786600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // sales_orders (decision 37): order capture by salesperson for a customer
    // party. Quantity-only document — no journal entry, no stock move until
    // the sales-invoice phase. Header `total` is always derived server-side
    // from the line totals (per-line discount). `customer_remarks` carries
    // free-text requests from the customer/distributor.
    await queryRunner.query(
      `CREATE TABLE "sales_orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "branch_id" uuid, "order_number" character varying NOT NULL, "party_id" uuid NOT NULL, "salesperson_id" uuid NOT NULL, "status" character varying NOT NULL, "bs_date" character varying NOT NULL, "total" numeric(15,2) NOT NULL, "discount_amount" numeric(15,2) NOT NULL DEFAULT 0, "notes" text, "customer_remarks" text, CONSTRAINT "PK_sales_orders" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_sales_orders_org_number" ON "sales_orders"  ("organization_id", "order_number") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sales_orders_org_status" ON "sales_orders"  ("organization_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sales_orders_org_party" ON "sales_orders"  ("organization_id", "party_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sales_orders_org_salesperson" ON "sales_orders"  ("organization_id", "salesperson_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_orders" ADD CONSTRAINT "chk_sales_orders_status" CHECK (status IN ('DRAFT','CONFIRMED','COMPLETED','CANCELED'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_orders" ADD CONSTRAINT "chk_sales_orders_total" CHECK (total >= 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_orders" ADD CONSTRAINT "chk_sales_orders_discount_amount" CHECK (discount_amount >= 0)`,
    );

    // sales_order_lines: quantity in the stated (sell) uom; base_quantity is
    // the conversion to the item's base uom (same rule as inventory moves).
    // unit_price is per sell-uom unit and defaults to item.sale_price.
    await queryRunner.query(
      `CREATE TABLE "sales_order_lines" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "order_id" uuid NOT NULL, "line_no" integer NOT NULL, "item_id" uuid NOT NULL, "uom_id" uuid NOT NULL, "quantity" numeric(15,3) NOT NULL, "free_quantity" numeric(15,3) NOT NULL DEFAULT 0, "base_quantity" numeric(15,3) NOT NULL, "unit_price" numeric(15,2) NOT NULL, "discount_percent" numeric(5,2) NOT NULL DEFAULT 0, "line_total" numeric(15,2) NOT NULL, CONSTRAINT "PK_sales_order_lines" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_sales_order_lines_order_no" ON "sales_order_lines"  ("order_id", "line_no") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sales_order_lines_order" ON "sales_order_lines"  ("order_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sales_order_lines_org_item" ON "sales_order_lines"  ("organization_id", "item_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_order_lines" ADD CONSTRAINT "chk_sales_order_lines_qty" CHECK (quantity >= 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_order_lines" ADD CONSTRAINT "chk_sales_order_lines_free_qty" CHECK (free_quantity >= 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_order_lines" ADD CONSTRAINT "chk_sales_order_lines_has_units" CHECK (quantity > 0 OR free_quantity > 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_order_lines" ADD CONSTRAINT "chk_sales_order_lines_base_qty" CHECK (base_quantity > 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_order_lines" ADD CONSTRAINT "chk_sales_order_lines_price" CHECK (unit_price >= 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_order_lines" ADD CONSTRAINT "chk_sales_order_lines_discount" CHECK (discount_percent >= 0 AND discount_percent <= 100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_order_lines" ADD CONSTRAINT "chk_sales_order_lines_total" CHECK (line_total >= 0)`,
    );

    // Foreign keys
    await queryRunner.query(
      `ALTER TABLE "sales_orders" ADD CONSTRAINT "FK_sales_orders_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_orders" ADD CONSTRAINT "FK_sales_orders_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_orders" ADD CONSTRAINT "FK_sales_orders_party" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_orders" ADD CONSTRAINT "FK_sales_orders_salesperson" FOREIGN KEY ("salesperson_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "sales_order_lines" ADD CONSTRAINT "FK_sales_order_lines_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_order_lines" ADD CONSTRAINT "FK_sales_order_lines_order" FOREIGN KEY ("order_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_order_lines" ADD CONSTRAINT "FK_sales_order_lines_item" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_order_lines" ADD CONSTRAINT "FK_sales_order_lines_uom" FOREIGN KEY ("uom_id") REFERENCES "uoms"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sales_order_lines" DROP CONSTRAINT "FK_sales_order_lines_uom"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_order_lines" DROP CONSTRAINT "FK_sales_order_lines_item"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_order_lines" DROP CONSTRAINT "FK_sales_order_lines_order"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_order_lines" DROP CONSTRAINT "FK_sales_order_lines_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_order_lines" DROP CONSTRAINT "chk_sales_order_lines_total"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_order_lines" DROP CONSTRAINT "chk_sales_order_lines_discount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_order_lines" DROP CONSTRAINT "chk_sales_order_lines_price"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_order_lines" DROP CONSTRAINT "chk_sales_order_lines_has_units"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_order_lines" DROP CONSTRAINT "chk_sales_order_lines_free_qty"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_order_lines" DROP CONSTRAINT "chk_sales_order_lines_base_qty"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_order_lines" DROP CONSTRAINT "chk_sales_order_lines_qty"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_orders" DROP CONSTRAINT "FK_sales_orders_salesperson"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_orders" DROP CONSTRAINT "FK_sales_orders_party"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_orders" DROP CONSTRAINT "FK_sales_orders_branch"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_orders" DROP CONSTRAINT "FK_sales_orders_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_orders" DROP CONSTRAINT "chk_sales_orders_total"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_orders" DROP CONSTRAINT "chk_sales_orders_discount_amount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_orders" DROP CONSTRAINT "chk_sales_orders_status"`,
    );
    await queryRunner.query(`DROP TABLE "sales_order_lines"`);
    await queryRunner.query(`DROP TABLE "sales_orders"`);
  }
}
