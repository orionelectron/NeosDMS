import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 6d (decision 43): sales returns — the credit note. A return line
 * sources a posted sales-invoice line, re-enters stock at the invoice line's
 * snapshotted `cogs_unit_cost` (the exact mirror of the stock-out), and posts
 * the reverse Sales/VAT/AR journal plus the Inventory/COGS restoration.
 * POST reserves the `CN-` number, moves stock in, and stamps
 * `returned_quantity` on the source lines so nothing can be over-returned and
 * the invoice's `balance_amount` is locked and decremented so a concurrent
 * receipt can never collect against returned amount.
 */
export class SalesReturn1787300000000 implements MigrationInterface {
  name = 'SalesReturn1787300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Return accumulator on the source line table (base uom).
    await queryRunner.query(
      `ALTER TABLE "sales_invoice_lines" ADD COLUMN "returned_quantity" numeric(15,3) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "chk_sales_invoice_lines_returned" CHECK (returned_quantity >= 0 AND returned_quantity <= base_quantity)`,
    );

    await queryRunner.query(
      `CREATE TABLE "sales_returns" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "branch_id" uuid, "return_number" character varying, "fiscal_year_id" uuid, "party_id" uuid NOT NULL, "status" character varying NOT NULL DEFAULT 'DRAFT', "return_date" date, "return_date_bs" character varying, "inventory_location_id" uuid, "taxable_total" numeric(15,2) NOT NULL, "non_taxable_total" numeric(15,2) NOT NULL, "subtotal" numeric(15,2) NOT NULL, "discount_total" numeric(15,2) NOT NULL, "tax_total" numeric(15,2) NOT NULL, "cogs_total" numeric(15,2) NOT NULL, "total" numeric(15,2) NOT NULL, "inventory_transaction_id" uuid, "journal_entry_id" uuid, "return_reason" text, "notes" text, CONSTRAINT "PK_sales_returns" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_sales_returns_org_number" ON "sales_returns"  ("organization_id", "return_number") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sales_returns_org_status" ON "sales_returns"  ("organization_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sales_returns_org_party" ON "sales_returns"  ("organization_id", "party_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sales_returns_org_location" ON "sales_returns"  ("organization_id", "inventory_location_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sales_returns_org_date" ON "sales_returns"  ("organization_id", "return_date") `,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_returns" ADD CONSTRAINT "chk_sales_returns_status" CHECK (status IN ('DRAFT','POSTED','CANCELLED'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_returns" ADD CONSTRAINT "chk_sales_returns_total" CHECK (total >= 0)`,
    );

    await queryRunner.query(
      `CREATE TABLE "sales_return_lines" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "return_id" uuid NOT NULL, "line_no" integer NOT NULL, "source_sales_invoice_line_id" uuid NOT NULL, "item_id" uuid NOT NULL, "uom_id" uuid NOT NULL, "quantity" numeric(15,3) NOT NULL, "base_quantity" numeric(15,3) NOT NULL, "unit_price" numeric(15,2) NOT NULL, "gross_amount" numeric(15,2) NOT NULL, "tax_code_id" uuid, "ird_category" character varying, "tax_rate" numeric(7,4) NOT NULL, "taxable_amount" numeric(15,2) NOT NULL, "tax_amount" numeric(15,2) NOT NULL, "line_total" numeric(15,2) NOT NULL, "cogs_unit_cost" numeric(15,2) NOT NULL, CONSTRAINT "PK_sales_return_lines" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_sales_return_lines_return_no" ON "sales_return_lines"  ("return_id", "line_no") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sales_return_lines_return" ON "sales_return_lines"  ("return_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sales_return_lines_item" ON "sales_return_lines"  ("item_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sales_return_lines_source_invoice" ON "sales_return_lines"  ("source_sales_invoice_line_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_return_lines" ADD CONSTRAINT "chk_sales_return_lines_qty" CHECK (quantity > 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_return_lines" ADD CONSTRAINT "chk_sales_return_lines_base_qty" CHECK (base_quantity > 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_return_lines" ADD CONSTRAINT "chk_sales_return_lines_price" CHECK (unit_price >= 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_return_lines" ADD CONSTRAINT "chk_sales_return_lines_tax_rate" CHECK (tax_rate >= 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_return_lines" ADD CONSTRAINT "chk_sales_return_lines_tax_amount" CHECK (tax_amount >= 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_return_lines" ADD CONSTRAINT "chk_sales_return_lines_total" CHECK (line_total >= 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_return_lines" ADD CONSTRAINT "chk_sales_return_lines_cogs" CHECK (cogs_unit_cost >= 0)`,
    );

    // Return stock-ins use the inventory engine (reference_type
    // 'sales_return'); extend the transaction type CHECK.
    await queryRunner.query(
      `ALTER TABLE "inventory_transactions" DROP CONSTRAINT "chk_inventory_txns_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transactions" ADD CONSTRAINT "chk_inventory_txns_type" CHECK (transaction_type IN ('opening_stock','stock_adjustment','stock_transfer','sales_invoice','sales_return','purchase_receipt','purchase_bill','purchase_return'))`,
    );

    // Foreign keys
    await queryRunner.query(
      `ALTER TABLE "sales_returns" ADD CONSTRAINT "FK_sales_returns_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_returns" ADD CONSTRAINT "FK_sales_returns_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_returns" ADD CONSTRAINT "FK_sales_returns_party" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_returns" ADD CONSTRAINT "FK_sales_returns_fy" FOREIGN KEY ("fiscal_year_id") REFERENCES "fiscal_years"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_returns" ADD CONSTRAINT "FK_sales_returns_location" FOREIGN KEY ("inventory_location_id") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_returns" ADD CONSTRAINT "FK_sales_returns_txn" FOREIGN KEY ("inventory_transaction_id") REFERENCES "inventory_transactions"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_returns" ADD CONSTRAINT "FK_sales_returns_je" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "sales_return_lines" ADD CONSTRAINT "FK_sales_return_lines_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_return_lines" ADD CONSTRAINT "FK_sales_return_lines_return" FOREIGN KEY ("return_id") REFERENCES "sales_returns"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_return_lines" ADD CONSTRAINT "FK_sales_return_lines_source_invoice" FOREIGN KEY ("source_sales_invoice_line_id") REFERENCES "sales_invoice_lines"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_return_lines" ADD CONSTRAINT "FK_sales_return_lines_item" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_return_lines" ADD CONSTRAINT "FK_sales_return_lines_uom" FOREIGN KEY ("uom_id") REFERENCES "uoms"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_return_lines" ADD CONSTRAINT "FK_sales_return_lines_tax" FOREIGN KEY ("tax_code_id") REFERENCES "tax_codes"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sales_return_lines" DROP CONSTRAINT "FK_sales_return_lines_tax"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_return_lines" DROP CONSTRAINT "FK_sales_return_lines_uom"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_return_lines" DROP CONSTRAINT "FK_sales_return_lines_item"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_return_lines" DROP CONSTRAINT "FK_sales_return_lines_source_invoice"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_return_lines" DROP CONSTRAINT "FK_sales_return_lines_return"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_return_lines" DROP CONSTRAINT "FK_sales_return_lines_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_returns" DROP CONSTRAINT "FK_sales_returns_je"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_returns" DROP CONSTRAINT "FK_sales_returns_txn"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_returns" DROP CONSTRAINT "FK_sales_returns_location"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_returns" DROP CONSTRAINT "FK_sales_returns_fy"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_returns" DROP CONSTRAINT "FK_sales_returns_party"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_returns" DROP CONSTRAINT "FK_sales_returns_branch"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_returns" DROP CONSTRAINT "FK_sales_returns_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transactions" DROP CONSTRAINT "chk_inventory_txns_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transactions" ADD CONSTRAINT "chk_inventory_txns_type" CHECK (transaction_type IN ('opening_stock','stock_adjustment','stock_transfer','sales_invoice','purchase_receipt','purchase_bill','purchase_return'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_return_lines" DROP CONSTRAINT "chk_sales_return_lines_cogs"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_return_lines" DROP CONSTRAINT "chk_sales_return_lines_total"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_return_lines" DROP CONSTRAINT "chk_sales_return_lines_tax_amount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_return_lines" DROP CONSTRAINT "chk_sales_return_lines_tax_rate"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_return_lines" DROP CONSTRAINT "chk_sales_return_lines_price"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_return_lines" DROP CONSTRAINT "chk_sales_return_lines_base_qty"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_return_lines" DROP CONSTRAINT "chk_sales_return_lines_qty"`,
    );
    await queryRunner.query(`DROP TABLE "sales_return_lines"`);
    await queryRunner.query(
      `ALTER TABLE "sales_returns" DROP CONSTRAINT "chk_sales_returns_total"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_returns" DROP CONSTRAINT "chk_sales_returns_status"`,
    );
    await queryRunner.query(`DROP TABLE "sales_returns"`);
    await queryRunner.query(
      `ALTER TABLE "sales_invoice_lines" DROP CONSTRAINT "chk_sales_invoice_lines_returned"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoice_lines" DROP COLUMN "returned_quantity"`,
    );
  }
}
