import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 7a (decision 41): supplier payments — the payment voucher. A payment
 * is a DRAFT → POSTED/CANCELLED header with a supplier party, payment method,
 * the account the money leaves, and a set of bill allocations
 * (`supplier_payment_bill_allocations`) that must fully consume the paid
 * amount (no advances in MVP). POST reserves the `PMT-` number and posts
 * `DR AP 2101 (party) / CR payment account` for the allocated total. Each
 * bill carries `paid_amount`/`balance_amount` columns maintained by payments
 * (bump paid) and by bill-sourced returns (balance -= net), so `balance`
 * always equals the AP still owed: `(total − tds_total) − paid − returned`.
 */
export class SupplierPayment1787200000000 implements MigrationInterface {
  name = 'SupplierPayment1787200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "purchase_bills" ADD COLUMN "paid_amount" numeric(15,2) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bills" ADD COLUMN "balance_amount" numeric(15,2) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `UPDATE "purchase_bills" SET "balance_amount" = ROUND(("total" - "tds_total" - COALESCE((
        SELECT SUM("prl"."gross_amount" - "prl"."tds_amount")
        FROM "purchase_return_lines" "prl"
        INNER JOIN "purchase_bill_lines" "pbl" ON "pbl"."id" = "prl"."source_purchase_bill_line_id"
        INNER JOIN "purchase_returns" "pr" ON "pr"."id" = "prl"."return_id"
        WHERE "pbl"."bill_id" = "purchase_bills"."id"
          AND "pr"."status" = 'POSTED'
      ), 0))::numeric, 2)
      WHERE "status" = 'POSTED'`,
    );

    await queryRunner.query(
      `CREATE TABLE "supplier_payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "branch_id" uuid, "payment_number" character varying, "fiscal_year_id" uuid, "party_id" uuid NOT NULL, "payment_method_id" uuid NOT NULL, "payment_account_id" uuid NOT NULL, "payment_date" date, "payment_date_bs" character varying, "status" character varying NOT NULL DEFAULT 'DRAFT', "paid_amount" numeric(15,2) NOT NULL, "reference_no" character varying, "notes" text, "journal_entry_id" uuid, CONSTRAINT "PK_supplier_payments" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_supplier_payments_org_number" ON "supplier_payments"  ("organization_id", "payment_number") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_supplier_payments_org_status" ON "supplier_payments"  ("organization_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_supplier_payments_org_party" ON "supplier_payments"  ("organization_id", "party_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_supplier_payments_org_date" ON "supplier_payments"  ("organization_id", "payment_date") `,
    );
    await queryRunner.query(
      `ALTER TABLE "supplier_payments" ADD CONSTRAINT "chk_supplier_payments_status" CHECK (status IN ('DRAFT','POSTED','CANCELLED'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "supplier_payments" ADD CONSTRAINT "chk_supplier_payments_amount" CHECK (paid_amount >= 0)`,
    );

    await queryRunner.query(
      `CREATE TABLE "supplier_payment_bill_allocations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "supplier_payment_id" uuid NOT NULL, "purchase_bill_id" uuid NOT NULL, "allocated_amount" numeric(15,2) NOT NULL, CONSTRAINT "PK_supplier_payment_bill_allocations" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_payment_bill_allocations_payment_bill" ON "supplier_payment_bill_allocations"  ("supplier_payment_id", "purchase_bill_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_payment_bill_allocations_payment" ON "supplier_payment_bill_allocations"  ("supplier_payment_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_payment_bill_allocations_bill" ON "supplier_payment_bill_allocations"  ("purchase_bill_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "supplier_payment_bill_allocations" ADD CONSTRAINT "chk_payment_bill_allocations_amount" CHECK (allocated_amount > 0)`,
    );

    await queryRunner.query(
      `ALTER TABLE "supplier_payments" ADD CONSTRAINT "FK_supplier_payments_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "supplier_payments" ADD CONSTRAINT "FK_supplier_payments_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "supplier_payments" ADD CONSTRAINT "FK_supplier_payments_party" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "supplier_payments" ADD CONSTRAINT "FK_supplier_payments_fy" FOREIGN KEY ("fiscal_year_id") REFERENCES "fiscal_years"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "supplier_payments" ADD CONSTRAINT "FK_supplier_payments_method" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "supplier_payments" ADD CONSTRAINT "FK_supplier_payments_account" FOREIGN KEY ("payment_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "supplier_payments" ADD CONSTRAINT "FK_supplier_payments_je" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "supplier_payment_bill_allocations" ADD CONSTRAINT "FK_payment_bill_allocations_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "supplier_payment_bill_allocations" ADD CONSTRAINT "FK_payment_bill_allocations_payment" FOREIGN KEY ("supplier_payment_id") REFERENCES "supplier_payments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "supplier_payment_bill_allocations" ADD CONSTRAINT "FK_payment_bill_allocations_bill" FOREIGN KEY ("purchase_bill_id") REFERENCES "purchase_bills"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "supplier_payment_bill_allocations" DROP CONSTRAINT "FK_payment_bill_allocations_bill"`,
    );
    await queryRunner.query(
      `ALTER TABLE "supplier_payment_bill_allocations" DROP CONSTRAINT "FK_payment_bill_allocations_payment"`,
    );
    await queryRunner.query(
      `ALTER TABLE "supplier_payment_bill_allocations" DROP CONSTRAINT "FK_payment_bill_allocations_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "supplier_payments" DROP CONSTRAINT "FK_supplier_payments_je"`,
    );
    await queryRunner.query(
      `ALTER TABLE "supplier_payments" DROP CONSTRAINT "FK_supplier_payments_account"`,
    );
    await queryRunner.query(
      `ALTER TABLE "supplier_payments" DROP CONSTRAINT "FK_supplier_payments_method"`,
    );
    await queryRunner.query(
      `ALTER TABLE "supplier_payments" DROP CONSTRAINT "FK_supplier_payments_fy"`,
    );
    await queryRunner.query(
      `ALTER TABLE "supplier_payments" DROP CONSTRAINT "FK_supplier_payments_party"`,
    );
    await queryRunner.query(
      `ALTER TABLE "supplier_payments" DROP CONSTRAINT "FK_supplier_payments_branch"`,
    );
    await queryRunner.query(
      `ALTER TABLE "supplier_payments" DROP CONSTRAINT "FK_supplier_payments_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "supplier_payment_bill_allocations" DROP CONSTRAINT "chk_payment_bill_allocations_amount"`,
    );
    await queryRunner.query(`DROP TABLE "supplier_payment_bill_allocations"`);
    await queryRunner.query(
      `ALTER TABLE "supplier_payments" DROP CONSTRAINT "chk_supplier_payments_amount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "supplier_payments" DROP CONSTRAINT "chk_supplier_payments_status"`,
    );
    await queryRunner.query(`DROP TABLE "supplier_payments"`);
    await queryRunner.query(
      `ALTER TABLE "purchase_bills" DROP COLUMN "balance_amount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_bills" DROP COLUMN "paid_amount"`,
    );
  }
}
