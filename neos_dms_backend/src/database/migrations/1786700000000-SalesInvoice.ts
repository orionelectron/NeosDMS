import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 6b (decision 39): IRD-compliant sales invoicing.
 *
 * `sales_invoices` are capture documents built from a CONFIRMED/COMPLETED
 * sales order with explicit per-line quantities (partial invoicing). The
 * document number is reserved at POST time via `document_sequences` (per
 * org + branch + fiscal year) so drafts never burn bill numbers. Posting
 * creates the AR/Sales/VAT journal entry, the stock-out inventory
 * transaction (base quantity incl. free units), increments the order line's
 * `invoiced_quantity`, and pushes the CBMS payload when the IRD client is
 * configured. Every IRD/CBMS field (buyer PAN, BS fiscal year, VAT/exempt/
 * export/excise/HST/ESF breakdowns, print counters) is stored so the CBMS
 * payload is a pure read and the invoice is printable/auditable.
 */
export class SalesInvoice1786700000000 implements MigrationInterface {
  name = 'SalesInvoice1786700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "sales_invoices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "branch_id" uuid, "invoice_number" character varying, "fiscal_year_id" uuid, "fiscal_period_id" uuid, "sales_order_id" uuid NOT NULL, "party_id" uuid NOT NULL, "salesperson_id" uuid NOT NULL, "status" character varying NOT NULL DEFAULT 'DRAFT', "invoice_date" date, "invoice_date_bs" character varying, "due_date" date, "due_date_bs" character varying, "buyer_name" character varying, "buyer_address" character varying, "buyer_pan" character varying, "buyer_vat" character varying, "taxable_total" numeric(15,2) NOT NULL DEFAULT 0, "non_taxable_total" numeric(15,2) NOT NULL DEFAULT 0, "subtotal" numeric(15,2) NOT NULL DEFAULT 0, "discount_total" numeric(15,2) NOT NULL DEFAULT 0, "tax_total" numeric(15,2) NOT NULL DEFAULT 0, "rounding_adjustment" numeric(15,2) NOT NULL DEFAULT 0, "total" numeric(15,2) NOT NULL DEFAULT 0, "excisable_amount" numeric(15,2) NOT NULL DEFAULT 0, "excise_total" numeric(15,2) NOT NULL DEFAULT 0, "hst_total" numeric(15,2) NOT NULL DEFAULT 0, "esf_total" numeric(15,2) NOT NULL DEFAULT 0, "export_total" numeric(15,2) NOT NULL DEFAULT 0, "paid_amount" numeric(15,2) NOT NULL DEFAULT 0, "balance_amount" numeric(15,2) NOT NULL DEFAULT 0, "print_count" integer NOT NULL DEFAULT 0, "first_printed_at" TIMESTAMP WITH TIME ZONE, "last_printed_at" TIMESTAMP WITH TIME ZONE, "cbms_status" character varying NOT NULL DEFAULT 'NOT_REQUIRED', "cbms_reference" character varying, "cbms_error" text, "inventory_transaction_id" uuid, "journal_entry_id" uuid, "notes" text, CONSTRAINT "PK_sales_invoices" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_sales_invoices_org_number" ON "sales_invoices"  ("organization_id", "invoice_number") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sales_invoices_org_status" ON "sales_invoices"  ("organization_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sales_invoices_org_party" ON "sales_invoices"  ("organization_id", "party_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sales_invoices_org_order" ON "sales_invoices"  ("organization_id", "sales_order_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sales_invoices_org_salesperson" ON "sales_invoices"  ("organization_id", "salesperson_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sales_invoices_org_date" ON "sales_invoices"  ("organization_id", "invoice_date") `,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoices" ADD CONSTRAINT "chk_sales_invoices_status" CHECK (status IN ('DRAFT','POSTED','CANCELLED'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoices" ADD CONSTRAINT "chk_sales_invoices_total" CHECK (total >= 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoices" ADD CONSTRAINT "chk_sales_invoices_cbms" CHECK (cbms_status IN ('NOT_REQUIRED','PENDING','PUSHED','FAILED'))`,
    );

    // sales_invoice_lines: one source order line per invoice line; quantity is
    // the billed quantity, free_quantity ships but is never billed, and
    // base_quantity is the shipped total in the item's base uom. Tax fields are
    // snapshotted at creation so rate changes never alter a posted bill.
    await queryRunner.query(
      `CREATE TABLE "sales_invoice_lines" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "invoice_id" uuid NOT NULL, "line_no" integer NOT NULL, "source_sales_order_line_id" uuid NOT NULL, "item_id" uuid NOT NULL, "description" text, "uom_id" uuid NOT NULL, "quantity" numeric(15,3) NOT NULL, "free_quantity" numeric(15,3) NOT NULL DEFAULT 0, "base_quantity" numeric(15,3) NOT NULL, "unit_price" numeric(15,2) NOT NULL, "is_tax_inclusive" boolean NOT NULL DEFAULT false, "gross_amount" numeric(15,2) NOT NULL, "discount_percent" numeric(5,2) NOT NULL DEFAULT 0, "discount_amount" numeric(15,2) NOT NULL DEFAULT 0, "tax_code_id" uuid, "ird_category" character varying, "tax_rate" numeric(7,4) NOT NULL DEFAULT 0, "taxable_amount" numeric(15,2) NOT NULL DEFAULT 0, "tax_amount" numeric(15,2) NOT NULL DEFAULT 0, "line_total" numeric(15,2) NOT NULL DEFAULT 0, CONSTRAINT "PK_sales_invoice_lines" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_sales_invoice_lines_invoice_no" ON "sales_invoice_lines"  ("invoice_id", "line_no") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sales_invoice_lines_invoice" ON "sales_invoice_lines"  ("invoice_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sales_invoice_lines_item" ON "sales_invoice_lines"  ("item_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sales_invoice_lines_source" ON "sales_invoice_lines"  ("source_sales_order_line_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "chk_sales_invoice_lines_qty" CHECK (quantity >= 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "chk_sales_invoice_lines_free_qty" CHECK (free_quantity >= 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "chk_sales_invoice_lines_has_units" CHECK (quantity > 0 OR free_quantity > 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "chk_sales_invoice_lines_base_qty" CHECK (base_quantity > 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "chk_sales_invoice_lines_price" CHECK (unit_price >= 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "chk_sales_invoice_lines_discount" CHECK (discount_percent >= 0 AND discount_percent <= 100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "chk_sales_invoice_lines_total" CHECK (line_total >= 0)`,
    );

    // Partial-invoicing tracker on the order line (billed sell-uom quantity).
    await queryRunner.query(
      `ALTER TABLE "sales_order_lines" ADD "invoiced_quantity" numeric(15,3) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_order_lines" ADD CONSTRAINT "chk_sales_order_lines_invoiced" CHECK (invoiced_quantity >= 0 AND invoiced_quantity <= quantity)`,
    );

    // Sales-invoice stock-outs use the inventory engine (reference_type
    // 'sales_invoice'); extend the transaction type CHECK.
    await queryRunner.query(
      `ALTER TABLE "inventory_transactions" DROP CONSTRAINT "chk_inventory_txns_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transactions" ADD CONSTRAINT "chk_inventory_txns_type" CHECK (transaction_type IN ('opening_stock','stock_adjustment','stock_transfer','sales_invoice'))`,
    );

    // Foreign keys
    await queryRunner.query(
      `ALTER TABLE "sales_invoices" ADD CONSTRAINT "FK_sales_invoices_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoices" ADD CONSTRAINT "FK_sales_invoices_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoices" ADD CONSTRAINT "FK_sales_invoices_fy" FOREIGN KEY ("fiscal_year_id") REFERENCES "fiscal_years"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoices" ADD CONSTRAINT "FK_sales_invoices_period" FOREIGN KEY ("fiscal_period_id") REFERENCES "fiscal_periods"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoices" ADD CONSTRAINT "FK_sales_invoices_order" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoices" ADD CONSTRAINT "FK_sales_invoices_party" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoices" ADD CONSTRAINT "FK_sales_invoices_salesperson" FOREIGN KEY ("salesperson_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoices" ADD CONSTRAINT "FK_sales_invoices_txn" FOREIGN KEY ("inventory_transaction_id") REFERENCES "inventory_transactions"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoices" ADD CONSTRAINT "FK_sales_invoices_journal" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "FK_sales_invoice_lines_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "FK_sales_invoice_lines_invoice" FOREIGN KEY ("invoice_id") REFERENCES "sales_invoices"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "FK_sales_invoice_lines_item" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "FK_sales_invoice_lines_uom" FOREIGN KEY ("uom_id") REFERENCES "uoms"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "FK_sales_invoice_lines_source" FOREIGN KEY ("source_sales_order_line_id") REFERENCES "sales_order_lines"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "FK_sales_invoice_lines_tax" FOREIGN KEY ("tax_code_id") REFERENCES "tax_codes"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sales_invoice_lines" DROP CONSTRAINT "FK_sales_invoice_lines_tax"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoice_lines" DROP CONSTRAINT "FK_sales_invoice_lines_source"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoice_lines" DROP CONSTRAINT "FK_sales_invoice_lines_uom"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoice_lines" DROP CONSTRAINT "FK_sales_invoice_lines_item"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoice_lines" DROP CONSTRAINT "FK_sales_invoice_lines_invoice"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoice_lines" DROP CONSTRAINT "FK_sales_invoice_lines_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoices" DROP CONSTRAINT "FK_sales_invoices_journal"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoices" DROP CONSTRAINT "FK_sales_invoices_txn"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoices" DROP CONSTRAINT "FK_sales_invoices_salesperson"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoices" DROP CONSTRAINT "FK_sales_invoices_party"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoices" DROP CONSTRAINT "FK_sales_invoices_order"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoices" DROP CONSTRAINT "FK_sales_invoices_period"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoices" DROP CONSTRAINT "FK_sales_invoices_fy"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoices" DROP CONSTRAINT "FK_sales_invoices_branch"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoices" DROP CONSTRAINT "FK_sales_invoices_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transactions" DROP CONSTRAINT "chk_inventory_txns_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transactions" ADD CONSTRAINT "chk_inventory_txns_type" CHECK (transaction_type IN ('opening_stock','stock_adjustment','stock_transfer'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_order_lines" DROP CONSTRAINT "chk_sales_order_lines_invoiced"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_order_lines" DROP COLUMN "invoiced_quantity"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoice_lines" DROP CONSTRAINT "chk_sales_invoice_lines_total"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoice_lines" DROP CONSTRAINT "chk_sales_invoice_lines_discount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoice_lines" DROP CONSTRAINT "chk_sales_invoice_lines_price"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoice_lines" DROP CONSTRAINT "chk_sales_invoice_lines_base_qty"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoice_lines" DROP CONSTRAINT "chk_sales_invoice_lines_has_units"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoice_lines" DROP CONSTRAINT "chk_sales_invoice_lines_free_qty"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoice_lines" DROP CONSTRAINT "chk_sales_invoice_lines_qty"`,
    );
    await queryRunner.query(`DROP TABLE "sales_invoice_lines"`);
    await queryRunner.query(
      `ALTER TABLE "sales_invoices" DROP CONSTRAINT "chk_sales_invoices_cbms"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoices" DROP CONSTRAINT "chk_sales_invoices_total"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoices" DROP CONSTRAINT "chk_sales_invoices_status"`,
    );
    await queryRunner.query(`DROP TABLE "sales_invoices"`);
  }
}
