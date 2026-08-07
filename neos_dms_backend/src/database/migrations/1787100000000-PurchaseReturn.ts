import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 7a (decision 41): purchase returns — the debit note. A return line
 * sources either a posted bill line (reverse bill journal + stock-out
 * `purchase_return` transaction at the bill's value) or a never-billed posted
 * GRN line (stock-out only, no journal). Posting reserves the `DN-` number,
 * posts the reverse Inventory/VAT Receivable/TDS/AP journal for bill-sourced
 * lines, moves stock out for every line, and stamps `returned_quantity` on the
 * source lines so nothing can be over-returned and a later bill can only claim
 * the remaining quantity.
 */
export class PurchaseReturn1787100000000 implements MigrationInterface {
  name = 'PurchaseReturn1787100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Return accumulators on the two source line tables (base uom).
    await queryRunner.query(
      `ALTER TABLE "purchase_bill_lines" ADD COLUMN "returned_quantity" numeric(15,3) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_receipt_lines" ADD COLUMN "returned_quantity" numeric(15,3) NOT NULL DEFAULT 0`,
    );

    await queryRunner.query(
      `CREATE TABLE "purchase_returns" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "branch_id" uuid, "return_number" character varying, "fiscal_year_id" uuid, "party_id" uuid NOT NULL, "status" character varying NOT NULL DEFAULT 'DRAFT', "return_date" date, "return_date_bs" character varying, "inventory_location_id" uuid, "taxable_total" numeric(15,2) NOT NULL, "non_taxable_total" numeric(15,2) NOT NULL, "subtotal" numeric(15,2) NOT NULL, "discount_total" numeric(15,2) NOT NULL, "tax_total" numeric(15,2) NOT NULL, "tds_total" numeric(15,2) NOT NULL, "total" numeric(15,2) NOT NULL, "inventory_transaction_id" uuid, "journal_entry_id" uuid, "return_reason" text, "notes" text, CONSTRAINT "PK_purchase_returns" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_purchase_returns_org_number" ON "purchase_returns"  ("organization_id", "return_number") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_purchase_returns_org_status" ON "purchase_returns"  ("organization_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_purchase_returns_org_party" ON "purchase_returns"  ("organization_id", "party_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_purchase_returns_org_location" ON "purchase_returns"  ("organization_id", "inventory_location_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_purchase_returns_org_date" ON "purchase_returns"  ("organization_id", "return_date") `,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_returns" ADD CONSTRAINT "chk_purchase_returns_status" CHECK (status IN ('DRAFT','POSTED','CANCELLED'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_returns" ADD CONSTRAINT "chk_purchase_returns_total" CHECK (total >= 0)`,
    );

    await queryRunner.query(
      `CREATE TABLE "purchase_return_lines" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "return_id" uuid NOT NULL, "line_no" integer NOT NULL, "source_purchase_bill_line_id" uuid, "source_purchase_receipt_line_id" uuid, "item_id" uuid NOT NULL, "uom_id" uuid NOT NULL, "quantity" numeric(15,3) NOT NULL, "base_quantity" numeric(15,3) NOT NULL, "unit_price" numeric(15,2) NOT NULL, "gross_amount" numeric(15,2) NOT NULL, "tax_code_id" uuid, "ird_category" character varying, "tax_rate" numeric(7,4) NOT NULL, "taxable_amount" numeric(15,2) NOT NULL, "tax_amount" numeric(15,2) NOT NULL, "tds_tax_code_id" uuid, "tds_rate" numeric(7,4) NOT NULL, "tds_amount" numeric(15,2) NOT NULL, "line_total" numeric(15,2) NOT NULL, CONSTRAINT "PK_purchase_return_lines" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_purchase_return_lines_return_no" ON "purchase_return_lines"  ("return_id", "line_no") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_purchase_return_lines_return" ON "purchase_return_lines"  ("return_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_purchase_return_lines_item" ON "purchase_return_lines"  ("item_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_purchase_return_lines_source_bill" ON "purchase_return_lines"  ("source_purchase_bill_line_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_purchase_return_lines_source_receipt" ON "purchase_return_lines"  ("source_purchase_receipt_line_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "chk_purchase_return_lines_qty" CHECK (quantity > 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "chk_purchase_return_lines_base_qty" CHECK (base_quantity > 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "chk_purchase_return_lines_price" CHECK (unit_price >= 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "chk_purchase_return_lines_tax_rate" CHECK (tax_rate >= 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "chk_purchase_return_lines_tds_rate" CHECK (tds_rate >= 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "chk_purchase_return_lines_tax_amount" CHECK (tax_amount >= 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "chk_purchase_return_lines_tds_amount" CHECK (tds_amount >= 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "chk_purchase_return_lines_total" CHECK (line_total >= 0)`,
    );

    // Return stock-outs use the inventory engine (reference_type
    // 'purchase_return'); extend the transaction type CHECK.
    await queryRunner.query(
      `ALTER TABLE "inventory_transactions" DROP CONSTRAINT "chk_inventory_txns_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transactions" ADD CONSTRAINT "chk_inventory_txns_type" CHECK (transaction_type IN ('opening_stock','stock_adjustment','stock_transfer','sales_invoice','purchase_receipt','purchase_bill','purchase_return'))`,
    );

    // Foreign keys
    await queryRunner.query(
      `ALTER TABLE "purchase_returns" ADD CONSTRAINT "FK_purchase_returns_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_returns" ADD CONSTRAINT "FK_purchase_returns_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_returns" ADD CONSTRAINT "FK_purchase_returns_party" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_returns" ADD CONSTRAINT "FK_purchase_returns_fy" FOREIGN KEY ("fiscal_year_id") REFERENCES "fiscal_years"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_returns" ADD CONSTRAINT "FK_purchase_returns_location" FOREIGN KEY ("inventory_location_id") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_returns" ADD CONSTRAINT "FK_purchase_returns_txn" FOREIGN KEY ("inventory_transaction_id") REFERENCES "inventory_transactions"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_returns" ADD CONSTRAINT "FK_purchase_returns_je" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "FK_purchase_return_lines_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "FK_purchase_return_lines_return" FOREIGN KEY ("return_id") REFERENCES "purchase_returns"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "FK_purchase_return_lines_source_bill" FOREIGN KEY ("source_purchase_bill_line_id") REFERENCES "purchase_bill_lines"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "FK_purchase_return_lines_source_receipt" FOREIGN KEY ("source_purchase_receipt_line_id") REFERENCES "purchase_receipt_lines"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "FK_purchase_return_lines_item" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "FK_purchase_return_lines_uom" FOREIGN KEY ("uom_id") REFERENCES "uoms"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "FK_purchase_return_lines_tax" FOREIGN KEY ("tax_code_id") REFERENCES "tax_codes"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "FK_purchase_return_lines_tds" FOREIGN KEY ("tds_tax_code_id") REFERENCES "tax_codes"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "purchase_return_lines" DROP CONSTRAINT "FK_purchase_return_lines_tds"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_return_lines" DROP CONSTRAINT "FK_purchase_return_lines_tax"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_return_lines" DROP CONSTRAINT "FK_purchase_return_lines_uom"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_return_lines" DROP CONSTRAINT "FK_purchase_return_lines_item"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_return_lines" DROP CONSTRAINT "FK_purchase_return_lines_source_receipt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_return_lines" DROP CONSTRAINT "FK_purchase_return_lines_source_bill"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_return_lines" DROP CONSTRAINT "FK_purchase_return_lines_return"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_return_lines" DROP CONSTRAINT "FK_purchase_return_lines_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_returns" DROP CONSTRAINT "FK_purchase_returns_je"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_returns" DROP CONSTRAINT "FK_purchase_returns_txn"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_returns" DROP CONSTRAINT "FK_purchase_returns_location"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_returns" DROP CONSTRAINT "FK_purchase_returns_fy"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_returns" DROP CONSTRAINT "FK_purchase_returns_party"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_returns" DROP CONSTRAINT "FK_purchase_returns_branch"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_returns" DROP CONSTRAINT "FK_purchase_returns_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transactions" DROP CONSTRAINT "chk_inventory_txns_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transactions" ADD CONSTRAINT "chk_inventory_txns_type" CHECK (transaction_type IN ('opening_stock','stock_adjustment','stock_transfer','sales_invoice','purchase_receipt','purchase_bill'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_return_lines" DROP CONSTRAINT "chk_purchase_return_lines_total"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_return_lines" DROP CONSTRAINT "chk_purchase_return_lines_tds_amount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_return_lines" DROP CONSTRAINT "chk_purchase_return_lines_tax_amount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_return_lines" DROP CONSTRAINT "chk_purchase_return_lines_tds_rate"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_return_lines" DROP CONSTRAINT "chk_purchase_return_lines_tax_rate"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_return_lines" DROP CONSTRAINT "chk_purchase_return_lines_price"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_return_lines" DROP CONSTRAINT "chk_purchase_return_lines_base_qty"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_return_lines" DROP CONSTRAINT "chk_purchase_return_lines_qty"`,
    );
    await queryRunner.query(`DROP TABLE "purchase_return_lines"`);
    await queryRunner.query(
      `ALTER TABLE "purchase_returns" DROP CONSTRAINT "chk_purchase_returns_total"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_returns" DROP CONSTRAINT "chk_purchase_returns_status"`,
    );
    await queryRunner.query(`DROP TABLE "purchase_returns"`);
    await queryRunner.query(
      `ALTER TABLE "purchase_receipt_lines" DROP COLUMN "returned_quantity"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bill_lines" DROP COLUMN "returned_quantity"`,
    );
  }
}
