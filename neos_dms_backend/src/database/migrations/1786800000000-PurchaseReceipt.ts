import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 7a (decisions 40-43): goods receipt notes (GRN) — the first piece of
 * the purchase side.
 *
 * `purchase_receipts` are direct capture documents (no PO in the MVP). The
 * receipt number is reserved at POST time via `document_sequences` (per org +
 * branch + fiscal year) so drafts never burn GRN numbers. Posting creates the
 * `purchase_receipt` (IN) inventory transaction — quantity-only; inventory
 * value/avg_cost is intentionally untouched (decision 42) and the per-line
 * `unit_cost` simply seeds the later purchase bill.
 */
export class PurchaseReceipt1786800000000 implements MigrationInterface {
  name = 'PurchaseReceipt1786800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "purchase_receipts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "branch_id" uuid, "receipt_number" character varying, "party_id" uuid NOT NULL, "status" character varying NOT NULL DEFAULT 'DRAFT', "receipt_date" date, "receipt_date_bs" character varying, "fiscal_year_id" uuid, "inventory_location_id" uuid NOT NULL, "inventory_transaction_id" uuid, "notes" text, CONSTRAINT "PK_purchase_receipts" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_purchase_receipts_org_number" ON "purchase_receipts"  ("organization_id", "receipt_number") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_purchase_receipts_org_status" ON "purchase_receipts"  ("organization_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_purchase_receipts_org_party" ON "purchase_receipts"  ("organization_id", "party_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_purchase_receipts_org_location" ON "purchase_receipts"  ("organization_id", "inventory_location_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_purchase_receipts_org_date" ON "purchase_receipts"  ("organization_id", "receipt_date") `,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_receipts" ADD CONSTRAINT "chk_purchase_receipts_status" CHECK (status IN ('DRAFT','POSTED','CANCELLED'))`,
    );

    // purchase_receipt_lines: quantity-only lines. unit_cost seeds the later
    // purchase bill (decision 42) but never reweights inventory value here.
    await queryRunner.query(
      `CREATE TABLE "purchase_receipt_lines" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "receipt_id" uuid NOT NULL, "line_no" integer NOT NULL, "item_id" uuid NOT NULL, "uom_id" uuid NOT NULL, "quantity" numeric(15,3) NOT NULL, "base_quantity" numeric(15,3) NOT NULL, "unit_cost" numeric(15,2) NOT NULL DEFAULT 0, CONSTRAINT "PK_purchase_receipt_lines" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_purchase_receipt_lines_receipt_no" ON "purchase_receipt_lines"  ("receipt_id", "line_no") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_purchase_receipt_lines_receipt" ON "purchase_receipt_lines"  ("receipt_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_purchase_receipt_lines_org_item" ON "purchase_receipt_lines"  ("organization_id", "item_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_receipt_lines" ADD CONSTRAINT "chk_purchase_receipt_lines_qty" CHECK (quantity > 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_receipt_lines" ADD CONSTRAINT "chk_purchase_receipt_lines_base_qty" CHECK (base_quantity > 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_receipt_lines" ADD CONSTRAINT "chk_purchase_receipt_lines_cost" CHECK (unit_cost >= 0)`,
    );

    // GRN stock-ins use the inventory engine (reference_type 'purchase_receipt');
    // extend the transaction type CHECK.
    await queryRunner.query(
      `ALTER TABLE "inventory_transactions" DROP CONSTRAINT "chk_inventory_txns_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transactions" ADD CONSTRAINT "chk_inventory_txns_type" CHECK (transaction_type IN ('opening_stock','stock_adjustment','stock_transfer','sales_invoice','purchase_receipt'))`,
    );

    // Foreign keys
    await queryRunner.query(
      `ALTER TABLE "purchase_receipts" ADD CONSTRAINT "FK_purchase_receipts_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_receipts" ADD CONSTRAINT "FK_purchase_receipts_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_receipts" ADD CONSTRAINT "FK_purchase_receipts_party" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_receipts" ADD CONSTRAINT "FK_purchase_receipts_fy" FOREIGN KEY ("fiscal_year_id") REFERENCES "fiscal_years"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_receipts" ADD CONSTRAINT "FK_purchase_receipts_location" FOREIGN KEY ("inventory_location_id") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_receipts" ADD CONSTRAINT "FK_purchase_receipts_txn" FOREIGN KEY ("inventory_transaction_id") REFERENCES "inventory_transactions"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "purchase_receipt_lines" ADD CONSTRAINT "FK_purchase_receipt_lines_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_receipt_lines" ADD CONSTRAINT "FK_purchase_receipt_lines_receipt" FOREIGN KEY ("receipt_id") REFERENCES "purchase_receipts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_receipt_lines" ADD CONSTRAINT "FK_purchase_receipt_lines_item" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_receipt_lines" ADD CONSTRAINT "FK_purchase_receipt_lines_uom" FOREIGN KEY ("uom_id") REFERENCES "uoms"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "purchase_receipt_lines" DROP CONSTRAINT "FK_purchase_receipt_lines_uom"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_receipt_lines" DROP CONSTRAINT "FK_purchase_receipt_lines_item"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_receipt_lines" DROP CONSTRAINT "FK_purchase_receipt_lines_receipt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_receipt_lines" DROP CONSTRAINT "FK_purchase_receipt_lines_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_receipts" DROP CONSTRAINT "FK_purchase_receipts_txn"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_receipts" DROP CONSTRAINT "FK_purchase_receipts_location"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_receipts" DROP CONSTRAINT "FK_purchase_receipts_fy"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_receipts" DROP CONSTRAINT "FK_purchase_receipts_party"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_receipts" DROP CONSTRAINT "FK_purchase_receipts_branch"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_receipts" DROP CONSTRAINT "FK_purchase_receipts_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transactions" DROP CONSTRAINT "chk_inventory_txns_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transactions" ADD CONSTRAINT "chk_inventory_txns_type" CHECK (transaction_type IN ('opening_stock','stock_adjustment','stock_transfer','sales_invoice'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_receipt_lines" DROP CONSTRAINT "chk_purchase_receipt_lines_cost"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_receipt_lines" DROP CONSTRAINT "chk_purchase_receipt_lines_base_qty"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_receipt_lines" DROP CONSTRAINT "chk_purchase_receipt_lines_qty"`,
    );
    await queryRunner.query(`DROP TABLE "purchase_receipt_lines"`);
    await queryRunner.query(
      `ALTER TABLE "purchase_receipts" DROP CONSTRAINT "chk_purchase_receipts_status"`,
    );
    await queryRunner.query(`DROP TABLE "purchase_receipts"`);
  }
}
