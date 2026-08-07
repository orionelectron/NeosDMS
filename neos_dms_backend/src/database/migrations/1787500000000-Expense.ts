import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 7 (decision 43): expense vouchers — the running-cost / petty-cash
 * capture. A draft records lines against direct `EXPENSE` coaType accounts
 * (no items/uoms); each line resolves input VAT and per-line TDS snapshots.
 * POST reserves the `EXP-` number and posts a balanced journal — DR each
 * expense account (gross − line discount) + DR VAT Receivable 1105, CR the
 * payment account (CASH mode) or AP 2101 with the vendor party (CREDIT mode)
 * + CR TDS Payable 2103. `total` is the amount charged; the CR leg is
 * `total − tds_total`.
 */
export class Expense1787500000000 implements MigrationInterface {
  name = 'Expense1787500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "expenses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "branch_id" uuid, "expense_number" character varying, "fiscal_year_id" uuid, "party_id" uuid, "payment_method_id" uuid, "payment_account_id" uuid, "expense_mode" character varying NOT NULL DEFAULT 'CASH', "expense_date" date, "expense_date_bs" character varying, "status" character varying NOT NULL DEFAULT 'DRAFT', "taxable_total" numeric(15,2) NOT NULL, "non_taxable_total" numeric(15,2) NOT NULL, "subtotal" numeric(15,2) NOT NULL, "discount_total" numeric(15,2) NOT NULL, "tax_total" numeric(15,2) NOT NULL, "tds_total" numeric(15,2) NOT NULL, "total" numeric(15,2) NOT NULL, "purpose" text, "notes" text, "journal_entry_id" uuid, CONSTRAINT "PK_expenses" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_expenses_org_number" ON "expenses"  ("organization_id", "expense_number") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_expenses_org_status" ON "expenses"  ("organization_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_expenses_org_party" ON "expenses"  ("organization_id", "party_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_expenses_org_date" ON "expenses"  ("organization_id", "expense_date") `,
    );
    await queryRunner.query(
      `ALTER TABLE "expenses" ADD CONSTRAINT "chk_expenses_status" CHECK (status IN ('DRAFT','POSTED','CANCELLED'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "expenses" ADD CONSTRAINT "chk_expenses_mode" CHECK (expense_mode IN ('CASH','CREDIT'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "expenses" ADD CONSTRAINT "chk_expenses_total" CHECK (total >= 0)`,
    );

    await queryRunner.query(
      `CREATE TABLE "expense_lines" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "expense_id" uuid NOT NULL, "line_no" integer NOT NULL, "expense_account_id" uuid NOT NULL, "description" text NOT NULL, "quantity" numeric(15,3) NOT NULL, "unit_amount" numeric(15,2) NOT NULL, "gross_amount" numeric(15,2) NOT NULL, "discount_percent" numeric(7,4) NOT NULL DEFAULT '0', "discount_amount" numeric(15,2) NOT NULL, "tax_code_id" uuid, "taxable_amount" numeric(15,2) NOT NULL, "tax_rate" numeric(7,4) NOT NULL, "tax_amount" numeric(15,2) NOT NULL, "tds_tax_code_id" uuid, "tds_rate" numeric(7,4) NOT NULL, "tds_amount" numeric(15,2) NOT NULL, "line_total" numeric(15,2) NOT NULL, CONSTRAINT "PK_expense_lines" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_expense_lines_expense_no" ON "expense_lines"  ("expense_id", "line_no") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_expense_lines_expense" ON "expense_lines"  ("expense_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_expense_lines_account" ON "expense_lines"  ("expense_account_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "expense_lines" ADD CONSTRAINT "chk_expense_lines_qty" CHECK (quantity > 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "expense_lines" ADD CONSTRAINT "chk_expense_lines_unit_amount" CHECK (unit_amount >= 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "expense_lines" ADD CONSTRAINT "chk_expense_lines_discount_percent" CHECK (discount_percent >= 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "expense_lines" ADD CONSTRAINT "chk_expense_lines_tax_rate" CHECK (tax_rate >= 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "expense_lines" ADD CONSTRAINT "chk_expense_lines_tds_rate" CHECK (tds_rate >= 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "expense_lines" ADD CONSTRAINT "chk_expense_lines_tax_amount" CHECK (tax_amount >= 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "expense_lines" ADD CONSTRAINT "chk_expense_lines_tds_amount" CHECK (tds_amount >= 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "expense_lines" ADD CONSTRAINT "chk_expense_lines_total" CHECK (line_total >= 0)`,
    );

    await queryRunner.query(
      `ALTER TABLE "expenses" ADD CONSTRAINT "FK_expenses_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "expenses" ADD CONSTRAINT "FK_expenses_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "expenses" ADD CONSTRAINT "FK_expenses_fy" FOREIGN KEY ("fiscal_year_id") REFERENCES "fiscal_years"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "expenses" ADD CONSTRAINT "FK_expenses_party" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "expenses" ADD CONSTRAINT "FK_expenses_method" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "expenses" ADD CONSTRAINT "FK_expenses_payment_account" FOREIGN KEY ("payment_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "expenses" ADD CONSTRAINT "FK_expenses_je" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "expense_lines" ADD CONSTRAINT "FK_expense_lines_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "expense_lines" ADD CONSTRAINT "FK_expense_lines_expense" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "expense_lines" ADD CONSTRAINT "FK_expense_lines_account" FOREIGN KEY ("expense_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "expense_lines" ADD CONSTRAINT "FK_expense_lines_tax_code" FOREIGN KEY ("tax_code_id") REFERENCES "tax_codes"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "expense_lines" ADD CONSTRAINT "FK_expense_lines_tds_tax_code" FOREIGN KEY ("tds_tax_code_id") REFERENCES "tax_codes"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "expense_lines" DROP CONSTRAINT "FK_expense_lines_tds_tax_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "expense_lines" DROP CONSTRAINT "FK_expense_lines_tax_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "expense_lines" DROP CONSTRAINT "FK_expense_lines_account"`,
    );
    await queryRunner.query(
      `ALTER TABLE "expense_lines" DROP CONSTRAINT "FK_expense_lines_expense"`,
    );
    await queryRunner.query(
      `ALTER TABLE "expense_lines" DROP CONSTRAINT "FK_expense_lines_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "expenses" DROP CONSTRAINT "FK_expenses_je"`,
    );
    await queryRunner.query(
      `ALTER TABLE "expenses" DROP CONSTRAINT "FK_expenses_payment_account"`,
    );
    await queryRunner.query(
      `ALTER TABLE "expenses" DROP CONSTRAINT "FK_expenses_method"`,
    );
    await queryRunner.query(
      `ALTER TABLE "expenses" DROP CONSTRAINT "FK_expenses_party"`,
    );
    await queryRunner.query(
      `ALTER TABLE "expenses" DROP CONSTRAINT "FK_expenses_fy"`,
    );
    await queryRunner.query(
      `ALTER TABLE "expenses" DROP CONSTRAINT "FK_expenses_branch"`,
    );
    await queryRunner.query(
      `ALTER TABLE "expenses" DROP CONSTRAINT "FK_expenses_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "expense_lines" DROP CONSTRAINT "chk_expense_lines_total"`,
    );
    await queryRunner.query(
      `ALTER TABLE "expense_lines" DROP CONSTRAINT "chk_expense_lines_tds_amount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "expense_lines" DROP CONSTRAINT "chk_expense_lines_tax_amount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "expense_lines" DROP CONSTRAINT "chk_expense_lines_tds_rate"`,
    );
    await queryRunner.query(
      `ALTER TABLE "expense_lines" DROP CONSTRAINT "chk_expense_lines_tax_rate"`,
    );
    await queryRunner.query(
      `ALTER TABLE "expense_lines" DROP CONSTRAINT "chk_expense_lines_discount_percent"`,
    );
    await queryRunner.query(
      `ALTER TABLE "expense_lines" DROP CONSTRAINT "chk_expense_lines_unit_amount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "expense_lines" DROP CONSTRAINT "chk_expense_lines_qty"`,
    );
    await queryRunner.query(`DROP TABLE "expense_lines"`);
    await queryRunner.query(
      `ALTER TABLE "expenses" DROP CONSTRAINT "chk_expenses_total"`,
    );
    await queryRunner.query(
      `ALTER TABLE "expenses" DROP CONSTRAINT "chk_expenses_mode"`,
    );
    await queryRunner.query(
      `ALTER TABLE "expenses" DROP CONSTRAINT "chk_expenses_status"`,
    );
    await queryRunner.query(`DROP TABLE "expenses"`);
  }
}
