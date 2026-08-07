import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 7a (decisions 40-43): purchase bills — the value document that turns
 * GRN stock into a payable. A bill line is either sourced from a posted GRN
 * line (`source_purchase_receipt_line_id`, journal-only, single-move rule) or
 * direct (stock-in on the bill). Posting reserves the `BILL-` number, posts
 * the Inventory/VAT Receivable/TDS/AP journal, reweights avg_cost, and stamps
 * the receipt line's `billed_quantity` so each GRN line bills exactly once.
 */
export class PurchaseBill1787000000000 implements MigrationInterface {
  name = 'PurchaseBill1787000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Single-move guard: a receipt line bills once, in full (decision 40).
    await queryRunner.query(
      `ALTER TABLE "purchase_receipt_lines" ADD COLUMN "billed_quantity" numeric(15,3) NOT NULL DEFAULT 0`,
    );

    await queryRunner.query(
      `CREATE TABLE "purchase_bills" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "branch_id" uuid, "bill_number" character varying, "vendor_bill_no" character varying, "fiscal_year_id" uuid, "party_id" uuid NOT NULL, "status" character varying NOT NULL DEFAULT 'DRAFT', "bill_date" date, "bill_date_bs" character varying, "inventory_location_id" uuid, "taxable_total" numeric(15,2) NOT NULL, "non_taxable_total" numeric(15,2) NOT NULL, "subtotal" numeric(15,2) NOT NULL, "discount_total" numeric(15,2) NOT NULL, "tax_total" numeric(15,2) NOT NULL, "tds_total" numeric(15,2) NOT NULL, "total" numeric(15,2) NOT NULL, "inventory_transaction_id" uuid, "journal_entry_id" uuid, "notes" text, CONSTRAINT "PK_purchase_bills" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_purchase_bills_org_number" ON "purchase_bills"  ("organization_id", "bill_number") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_purchase_bills_org_status" ON "purchase_bills"  ("organization_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_purchase_bills_org_party" ON "purchase_bills"  ("organization_id", "party_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_purchase_bills_org_location" ON "purchase_bills"  ("organization_id", "inventory_location_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_purchase_bills_org_date" ON "purchase_bills"  ("organization_id", "bill_date") `,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bills" ADD CONSTRAINT "chk_purchase_bills_status" CHECK (status IN ('DRAFT','POSTED','CANCELLED'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bills" ADD CONSTRAINT "chk_purchase_bills_total" CHECK (total >= 0)`,
    );

    await queryRunner.query(
      `CREATE TABLE "purchase_bill_lines" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "bill_id" uuid NOT NULL, "line_no" integer NOT NULL, "source_purchase_receipt_line_id" uuid, "item_id" uuid NOT NULL, "uom_id" uuid NOT NULL, "quantity" numeric(15,3) NOT NULL, "base_quantity" numeric(15,3) NOT NULL, "unit_price" numeric(15,2) NOT NULL, "gross_amount" numeric(15,2) NOT NULL, "tax_code_id" uuid, "ird_category" character varying, "tax_rate" numeric(7,4) NOT NULL, "taxable_amount" numeric(15,2) NOT NULL, "tax_amount" numeric(15,2) NOT NULL, "tds_tax_code_id" uuid, "tds_rate" numeric(7,4) NOT NULL, "tds_amount" numeric(15,2) NOT NULL, "line_total" numeric(15,2) NOT NULL, CONSTRAINT "PK_purchase_bill_lines" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_purchase_bill_lines_bill_no" ON "purchase_bill_lines"  ("bill_id", "line_no") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_purchase_bill_lines_bill" ON "purchase_bill_lines"  ("bill_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_purchase_bill_lines_item" ON "purchase_bill_lines"  ("item_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_purchase_bill_lines_source" ON "purchase_bill_lines"  ("source_purchase_receipt_line_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bill_lines" ADD CONSTRAINT "chk_purchase_bill_lines_qty" CHECK (quantity > 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bill_lines" ADD CONSTRAINT "chk_purchase_bill_lines_base_qty" CHECK (base_quantity > 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bill_lines" ADD CONSTRAINT "chk_purchase_bill_lines_price" CHECK (unit_price >= 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bill_lines" ADD CONSTRAINT "chk_purchase_bill_lines_tax_rate" CHECK (tax_rate >= 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bill_lines" ADD CONSTRAINT "chk_purchase_bill_lines_tds_rate" CHECK (tds_rate >= 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bill_lines" ADD CONSTRAINT "chk_purchase_bill_lines_tax_amount" CHECK (tax_amount >= 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bill_lines" ADD CONSTRAINT "chk_purchase_bill_lines_tds_amount" CHECK (tds_amount >= 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bill_lines" ADD CONSTRAINT "chk_purchase_bill_lines_total" CHECK (line_total >= 0)`,
    );

    // Direct-bill stock-ins use the inventory engine (reference_type
    // 'purchase_bill'); extend the transaction type CHECK.
    await queryRunner.query(
      `ALTER TABLE "inventory_transactions" DROP CONSTRAINT "chk_inventory_txns_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transactions" ADD CONSTRAINT "chk_inventory_txns_type" CHECK (transaction_type IN ('opening_stock','stock_adjustment','stock_transfer','sales_invoice','purchase_receipt','purchase_bill'))`,
    );

    // Foreign keys
    await queryRunner.query(
      `ALTER TABLE "purchase_bills" ADD CONSTRAINT "FK_purchase_bills_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bills" ADD CONSTRAINT "FK_purchase_bills_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bills" ADD CONSTRAINT "FK_purchase_bills_party" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bills" ADD CONSTRAINT "FK_purchase_bills_fy" FOREIGN KEY ("fiscal_year_id") REFERENCES "fiscal_years"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bills" ADD CONSTRAINT "FK_purchase_bills_location" FOREIGN KEY ("inventory_location_id") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bills" ADD CONSTRAINT "FK_purchase_bills_txn" FOREIGN KEY ("inventory_transaction_id") REFERENCES "inventory_transactions"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bills" ADD CONSTRAINT "FK_purchase_bills_je" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "purchase_bill_lines" ADD CONSTRAINT "FK_purchase_bill_lines_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bill_lines" ADD CONSTRAINT "FK_purchase_bill_lines_bill" FOREIGN KEY ("bill_id") REFERENCES "purchase_bills"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bill_lines" ADD CONSTRAINT "FK_purchase_bill_lines_source" FOREIGN KEY ("source_purchase_receipt_line_id") REFERENCES "purchase_receipt_lines"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bill_lines" ADD CONSTRAINT "FK_purchase_bill_lines_item" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bill_lines" ADD CONSTRAINT "FK_purchase_bill_lines_uom" FOREIGN KEY ("uom_id") REFERENCES "uoms"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bill_lines" ADD CONSTRAINT "FK_purchase_bill_lines_tax" FOREIGN KEY ("tax_code_id") REFERENCES "tax_codes"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bill_lines" ADD CONSTRAINT "FK_purchase_bill_lines_tds" FOREIGN KEY ("tds_tax_code_id") REFERENCES "tax_codes"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "purchase_bill_lines" DROP CONSTRAINT "FK_purchase_bill_lines_tds"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bill_lines" DROP CONSTRAINT "FK_purchase_bill_lines_tax"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bill_lines" DROP CONSTRAINT "FK_purchase_bill_lines_uom"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bill_lines" DROP CONSTRAINT "FK_purchase_bill_lines_item"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bill_lines" DROP CONSTRAINT "FK_purchase_bill_lines_source"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bill_lines" DROP CONSTRAINT "FK_purchase_bill_lines_bill"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bill_lines" DROP CONSTRAINT "FK_purchase_bill_lines_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bills" DROP CONSTRAINT "FK_purchase_bills_je"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bills" DROP CONSTRAINT "FK_purchase_bills_txn"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bills" DROP CONSTRAINT "FK_purchase_bills_location"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bills" DROP CONSTRAINT "FK_purchase_bills_fy"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bills" DROP CONSTRAINT "FK_purchase_bills_party"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bills" DROP CONSTRAINT "FK_purchase_bills_branch"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bills" DROP CONSTRAINT "FK_purchase_bills_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transactions" DROP CONSTRAINT "chk_inventory_txns_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transactions" ADD CONSTRAINT "chk_inventory_txns_type" CHECK (transaction_type IN ('opening_stock','stock_adjustment','stock_transfer','sales_invoice','purchase_receipt'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bill_lines" DROP CONSTRAINT "chk_purchase_bill_lines_total"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bill_lines" DROP CONSTRAINT "chk_purchase_bill_lines_tds_amount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bill_lines" DROP CONSTRAINT "chk_purchase_bill_lines_tax_amount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bill_lines" DROP CONSTRAINT "chk_purchase_bill_lines_tds_rate"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bill_lines" DROP CONSTRAINT "chk_purchase_bill_lines_tax_rate"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bill_lines" DROP CONSTRAINT "chk_purchase_bill_lines_price"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bill_lines" DROP CONSTRAINT "chk_purchase_bill_lines_base_qty"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bill_lines" DROP CONSTRAINT "chk_purchase_bill_lines_qty"`,
    );
    await queryRunner.query(`DROP TABLE "purchase_bill_lines"`);
    await queryRunner.query(
      `ALTER TABLE "purchase_bills" DROP CONSTRAINT "chk_purchase_bills_total"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bills" DROP CONSTRAINT "chk_purchase_bills_status"`,
    );
    await queryRunner.query(`DROP TABLE "purchase_bills"`);
    await queryRunner.query(
      `ALTER TABLE "purchase_receipt_lines" DROP COLUMN "billed_quantity"`,
    );
  }
}
