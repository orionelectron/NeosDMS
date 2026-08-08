import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 6d (decision 43): customer receipts — the money-in voucher. A receipt
 * allocates a paid amount against one or more posted sales invoices; Σ
 * allocations must fully consume the paid amount (no advances in MVP) and
 * each must be ≤ the invoice's outstanding `balance_amount` at POST. POST
 * reserves the `RCV-` number and posts `DR receipt account / CR AR 1103
 * (party)` for the allocated total. Each invoice carries `paid_amount`/
 * `balance_amount` columns maintained by receipts (bump paid) and by credit
 * notes (balance -= total), so `balance` always equals the AR still owed.
 */
export class CustomerReceipt1787400000000 implements MigrationInterface {
  name = 'CustomerReceipt1787400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "customer_receipts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "branch_id" uuid, "receipt_number" character varying, "fiscal_year_id" uuid, "party_id" uuid NOT NULL, "payment_method_id" uuid NOT NULL, "receipt_account_id" uuid NOT NULL, "receipt_date" date, "receipt_date_bs" character varying, "status" character varying NOT NULL DEFAULT 'DRAFT', "received_amount" numeric(15,2) NOT NULL, "reference_no" character varying, "notes" text, "journal_entry_id" uuid, CONSTRAINT "PK_customer_receipts" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_customer_receipts_org_number" ON "customer_receipts"  ("organization_id", "receipt_number") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_customer_receipts_org_status" ON "customer_receipts"  ("organization_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_customer_receipts_org_party" ON "customer_receipts"  ("organization_id", "party_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_customer_receipts_org_date" ON "customer_receipts"  ("organization_id", "receipt_date") `,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_receipts" ADD CONSTRAINT "chk_customer_receipts_status" CHECK (status IN ('DRAFT','POSTED','CANCELLED'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_receipts" ADD CONSTRAINT "chk_customer_receipts_amount" CHECK (received_amount >= 0)`,
    );

    await queryRunner.query(
      `CREATE TABLE "customer_receipt_invoice_allocations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "customer_receipt_id" uuid NOT NULL, "sales_invoice_id" uuid NOT NULL, "allocated_amount" numeric(15,2) NOT NULL, CONSTRAINT "PK_customer_receipt_invoice_allocations" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_receipt_allocations_receipt_invoice" ON "customer_receipt_invoice_allocations"  ("customer_receipt_id", "sales_invoice_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_receipt_allocations_receipt" ON "customer_receipt_invoice_allocations"  ("customer_receipt_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_receipt_allocations_invoice" ON "customer_receipt_invoice_allocations"  ("sales_invoice_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_receipt_invoice_allocations" ADD CONSTRAINT "chk_receipt_allocations_amount" CHECK (allocated_amount > 0)`,
    );

    await queryRunner.query(
      `ALTER TABLE "customer_receipts" ADD CONSTRAINT "FK_customer_receipts_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_receipts" ADD CONSTRAINT "FK_customer_receipts_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_receipts" ADD CONSTRAINT "FK_customer_receipts_party" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_receipts" ADD CONSTRAINT "FK_customer_receipts_fy" FOREIGN KEY ("fiscal_year_id") REFERENCES "fiscal_years"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_receipts" ADD CONSTRAINT "FK_customer_receipts_method" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_receipts" ADD CONSTRAINT "FK_customer_receipts_account" FOREIGN KEY ("receipt_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_receipts" ADD CONSTRAINT "FK_customer_receipts_je" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "customer_receipt_invoice_allocations" ADD CONSTRAINT "FK_receipt_allocations_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_receipt_invoice_allocations" ADD CONSTRAINT "FK_receipt_allocations_receipt" FOREIGN KEY ("customer_receipt_id") REFERENCES "customer_receipts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_receipt_invoice_allocations" ADD CONSTRAINT "FK_receipt_allocations_invoice" FOREIGN KEY ("sales_invoice_id") REFERENCES "sales_invoices"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "customer_receipt_invoice_allocations" DROP CONSTRAINT "FK_receipt_allocations_invoice"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_receipt_invoice_allocations" DROP CONSTRAINT "FK_receipt_allocations_receipt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_receipt_invoice_allocations" DROP CONSTRAINT "FK_receipt_allocations_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_receipts" DROP CONSTRAINT "FK_customer_receipts_je"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_receipts" DROP CONSTRAINT "FK_customer_receipts_account"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_receipts" DROP CONSTRAINT "FK_customer_receipts_method"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_receipts" DROP CONSTRAINT "FK_customer_receipts_fy"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_receipts" DROP CONSTRAINT "FK_customer_receipts_party"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_receipts" DROP CONSTRAINT "FK_customer_receipts_branch"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_receipts" DROP CONSTRAINT "FK_customer_receipts_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_receipt_invoice_allocations" DROP CONSTRAINT "chk_receipt_allocations_amount"`,
    );
    await queryRunner.query(
      `DROP TABLE "customer_receipt_invoice_allocations"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_receipts" DROP CONSTRAINT "chk_customer_receipts_amount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_receipts" DROP CONSTRAINT "chk_customer_receipts_status"`,
    );
    await queryRunner.query(`DROP TABLE "customer_receipts"`);
  }
}
