import { MigrationInterface, QueryRunner } from 'typeorm';

export class AccountingEngine1786070270761 implements MigrationInterface {
  name = 'AccountingEngine1786070270761';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // currencies (before payment methods/parties/journal entries reference them)
    await queryRunner.query(
      `CREATE TABLE "currencies" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid, "code" character varying(3) NOT NULL, "name" character varying NOT NULL, "symbol" character varying, "precision" integer NOT NULL DEFAULT 2, "is_base" boolean NOT NULL DEFAULT false, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_currencies" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_currencies_org" ON "currencies"  ("organization_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "unique_base_currency_per_org" ON "currencies"  ("organization_id") WHERE organization_id IS NOT NULL AND is_base = true`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "unique_global_currency_code" ON "currencies"  ("code") WHERE organization_id IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "unique_org_currency_code" ON "currencies"  ("organization_id", "code") WHERE organization_id IS NOT NULL`,
    );

    // payment_terms (before parties reference them)
    await queryRunner.query(
      `CREATE TABLE "payment_terms" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "name" character varying NOT NULL, "due_days" integer NOT NULL DEFAULT 0, CONSTRAINT "PK_payment_terms" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_payment_terms_org_name" ON "payment_terms"  ("organization_id", "name") `,
    );

    // accounts (before payment_methods/tax_codes/journal_lines reference them)
    await queryRunner.query(
      `CREATE TABLE "accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "parent_account_id" uuid, "name" character varying NOT NULL, "code" character varying NOT NULL, "coa_type" character varying NOT NULL, "is_group" boolean NOT NULL DEFAULT false, "branch_id" uuid, "is_system_account" boolean NOT NULL DEFAULT false, "system_purpose" character varying, "is_locked" boolean NOT NULL DEFAULT false, "is_active" boolean NOT NULL DEFAULT true, "level" integer, "path" character varying, CONSTRAINT "PK_accounts" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_accounts_org_code" ON "accounts"  ("organization_id", "code") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_accounts_org_parent" ON "accounts"  ("organization_id", "parent_account_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_accounts_org_purpose" ON "accounts"  ("organization_id", "system_purpose") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_accounts_org_branch" ON "accounts"  ("organization_id", "branch_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts" ADD CONSTRAINT "chk_accounts_coa_type" CHECK (coa_type IN ('ASSET','LIABILITY','EQUITY','INCOME','EXPENSE'))`,
    );

    // payment_methods (references accounts)
    await queryRunner.query(
      `CREATE TABLE "payment_methods" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "linked_account_id" uuid, "name" character varying NOT NULL, "method_type" character varying NOT NULL, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_payment_methods" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_payment_methods_org_name" ON "payment_methods"  ("organization_id", "name") `,
    );

    // parties (references currencies/payment_terms/branches)
    await queryRunner.query(
      `CREATE TABLE "parties" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "branch_id" uuid, "currency_id" uuid, "payment_term_id" uuid, "name" character varying NOT NULL, "legal_name" character varying, "party_kind" character varying NOT NULL DEFAULT 'BUSINESS', "is_customer" boolean NOT NULL DEFAULT false, "is_supplier" boolean NOT NULL DEFAULT false, "is_lead" boolean NOT NULL DEFAULT false, "pan_number" character varying, "vat_number" character varying, "email" character varying, "phone" character varying, "address" character varying, "credit_limit" numeric(15,2) NOT NULL DEFAULT 0, "opening_balance" numeric(15,2) NOT NULL DEFAULT 0, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_parties" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_parties_org_pan" ON "parties"  ("organization_id", "pan_number") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_parties_org_customer" ON "parties"  ("organization_id", "is_customer") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_parties_org_supplier" ON "parties"  ("organization_id", "is_supplier") `,
    );
    await queryRunner.query(
      `ALTER TABLE "parties" ADD CONSTRAINT "chk_parties_at_least_one_role" CHECK (is_customer = true OR is_supplier = true OR is_lead = true)`,
    );
    await queryRunner.query(
      `ALTER TABLE "parties" ADD CONSTRAINT "chk_parties_kind" CHECK (party_kind IN ('BUSINESS','INDIVIDUAL'))`,
    );

    // party_addresses
    await queryRunner.query(
      `CREATE TABLE "party_addresses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "party_id" uuid NOT NULL, "address_type" character varying NOT NULL, "address_line_1" character varying NOT NULL, "address_line_2" character varying, "city" character varying, "state" character varying, "zip_code" character varying, "country" character varying NOT NULL DEFAULT 'Nepal', "is_default" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_party_addresses" PRIMARY KEY ("id"))`,
    );

    // tax_types
    await queryRunner.query(
      `CREATE TABLE "tax_types" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "name" character varying NOT NULL, "description" character varying, "math_sign" integer NOT NULL DEFAULT 1, "is_system" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_tax_types_name" UNIQUE ("name"), CONSTRAINT "PK_tax_types" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "tax_types" ADD CONSTRAINT "chk_tax_types_math_sign" CHECK (math_sign IN (1, -1))`,
    );

    // tax_templates
    await queryRunner.query(
      `CREATE TABLE "tax_templates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "tax_type_id" uuid NOT NULL, "name" character varying NOT NULL, "rate" numeric(7,4) NOT NULL DEFAULT 0, "ird_category" character varying NOT NULL, "math_sign" integer NOT NULL DEFAULT 1, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_tax_templates" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "tax_templates" ADD CONSTRAINT "chk_tax_templates_math_sign" CHECK (math_sign IN (1, -1))`,
    );

    // tax_codes (references tax_types/accounts)
    await queryRunner.query(
      `CREATE TABLE "tax_codes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "tax_type_id" uuid NOT NULL, "account_id" uuid, "name" character varying NOT NULL, "ird_category" character varying NOT NULL DEFAULT 'TAXABLE', "rate" numeric(7,4) NOT NULL DEFAULT 0, "effective_from" date NOT NULL, "effective_to" date, "is_locked" boolean NOT NULL DEFAULT true, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_tax_codes" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_tax_codes_org_name" ON "tax_codes"  ("organization_id", "name") `,
    );

    // fiscal_years (before journal_entries/periods/document_sequences)
    await queryRunner.query(
      `CREATE TABLE "fiscal_years" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "name" character varying NOT NULL, "start_date" date NOT NULL, "end_date" date NOT NULL, "is_active" boolean NOT NULL DEFAULT false, "is_closed" boolean NOT NULL DEFAULT false, "closed_at" TIMESTAMP WITH TIME ZONE, "closed_by" uuid, CONSTRAINT "PK_fiscal_years" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_fiscal_years_org_name" ON "fiscal_years"  ("organization_id", "name") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_fiscal_years_org_dates" ON "fiscal_years"  ("organization_id", "start_date", "end_date") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "unique_active_fiscal_year_per_org" ON "fiscal_years"  ("organization_id") WHERE is_active = true`,
    );

    // fiscal_periods
    await queryRunner.query(
      `CREATE TABLE "fiscal_periods" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "fiscal_year_id" uuid NOT NULL, "name" character varying NOT NULL, "sequence" integer NOT NULL, "start_date_bs" character varying(10) NOT NULL, "end_date_bs" character varying(10) NOT NULL, "start_date" date NOT NULL, "end_date" date NOT NULL, "is_locked" boolean NOT NULL DEFAULT false, "locked_at" TIMESTAMP WITH TIME ZONE, "locked_by" uuid, CONSTRAINT "PK_fiscal_periods" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_fiscal_periods_year_sequence" ON "fiscal_periods"  ("fiscal_year_id", "sequence") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_fiscal_periods_year_name" ON "fiscal_periods"  ("fiscal_year_id", "name") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_fiscal_periods_year_dates" ON "fiscal_periods"  ("fiscal_year_id", "start_date", "end_date") `,
    );

    // journal_entries
    await queryRunner.query(
      `CREATE TABLE "journal_entries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "branch_id" uuid NOT NULL, "fiscal_year_id" uuid NOT NULL, "fiscal_period_id" uuid NOT NULL, "currency_id" uuid, "exchange_rate" numeric(15,6) NOT NULL DEFAULT 1, "entry_date" date NOT NULL, "entry_date_bs" character varying(10), "description" character varying, "reference_number" character varying, "status" character varying NOT NULL DEFAULT 'DRAFT', "source_type" character varying, "source_id" uuid, CONSTRAINT "PK_journal_entries" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_journal_entries_org_date" ON "journal_entries"  ("organization_id", "entry_date") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_journal_entries_org_source" ON "journal_entries"  ("organization_id", "source_type", "source_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "journal_entries" ADD CONSTRAINT "chk_journal_entries_status" CHECK (status IN ('DRAFT', 'POSTED', 'CANCELLED'))`,
    );

    // journal_lines
    await queryRunner.query(
      `CREATE TABLE "journal_lines" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "branch_id" uuid NOT NULL, "journal_entry_id" uuid NOT NULL, "account_id" uuid NOT NULL, "party_id" uuid, "debit_amount" numeric(15,4) NOT NULL DEFAULT 0, "credit_amount" numeric(15,4) NOT NULL DEFAULT 0, "description" character varying, "is_reconciled" boolean NOT NULL DEFAULT false, "reconciled_date" date, CONSTRAINT "PK_journal_lines" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_journal_lines_org_account" ON "journal_lines"  ("organization_id", "account_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_journal_lines_org_party" ON "journal_lines"  ("organization_id", "party_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "journal_lines" ADD CONSTRAINT "chk_journal_lines_debit_credit" CHECK ((debit_amount > 0 AND credit_amount = 0) OR (credit_amount > 0 AND debit_amount = 0))`,
    );

    // document_sequences
    await queryRunner.query(
      `CREATE TABLE "document_sequences" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "branch_id" uuid, "fiscal_year_id" uuid, "document_type" character varying NOT NULL, "prefix" character varying, "last_number" integer NOT NULL DEFAULT 0, CONSTRAINT "PK_document_sequences" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "doc_seq_unique" ON "document_sequences"  ("organization_id", COALESCE("branch_id", '00000000-0000-0000-0000-000000000000'), COALESCE("fiscal_year_id", '00000000-0000-0000-0000-000000000000'), "document_type") `,
    );

    // transaction_types
    await queryRunner.query(
      `CREATE TABLE "transaction_types" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid, "code" character varying NOT NULL, "name" character varying NOT NULL, "nature" character varying NOT NULL, "is_cross_border" boolean NOT NULL DEFAULT false, "affects_inventory" boolean NOT NULL DEFAULT false, "affects_tax" boolean NOT NULL DEFAULT true, "is_system" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_transaction_types" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_transaction_types_global" ON "transaction_types"  ("code") WHERE organization_id IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_transaction_types_org" ON "transaction_types"  ("organization_id", "code") WHERE organization_id IS NOT NULL`,
    );

    // Foreign keys
    await queryRunner.query(
      `ALTER TABLE "currencies" ADD CONSTRAINT "FK_currencies_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_terms" ADD CONSTRAINT "FK_payment_terms_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts" ADD CONSTRAINT "FK_accounts_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts" ADD CONSTRAINT "FK_accounts_parent" FOREIGN KEY ("parent_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts" ADD CONSTRAINT "FK_accounts_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_methods" ADD CONSTRAINT "FK_payment_methods_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_methods" ADD CONSTRAINT "FK_payment_methods_account" FOREIGN KEY ("linked_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "parties" ADD CONSTRAINT "FK_parties_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "parties" ADD CONSTRAINT "FK_parties_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "parties" ADD CONSTRAINT "FK_parties_currency" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "parties" ADD CONSTRAINT "FK_parties_payment_term" FOREIGN KEY ("payment_term_id") REFERENCES "payment_terms"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "party_addresses" ADD CONSTRAINT "FK_party_addresses_party" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tax_templates" ADD CONSTRAINT "FK_tax_templates_type" FOREIGN KEY ("tax_type_id") REFERENCES "tax_types"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tax_codes" ADD CONSTRAINT "FK_tax_codes_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tax_codes" ADD CONSTRAINT "FK_tax_codes_type" FOREIGN KEY ("tax_type_id") REFERENCES "tax_types"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tax_codes" ADD CONSTRAINT "FK_tax_codes_account" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "fiscal_years" ADD CONSTRAINT "FK_fiscal_years_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "fiscal_periods" ADD CONSTRAINT "FK_fiscal_periods_year" FOREIGN KEY ("fiscal_year_id") REFERENCES "fiscal_years"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "journal_entries" ADD CONSTRAINT "FK_journal_entries_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "journal_entries" ADD CONSTRAINT "FK_journal_entries_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "journal_entries" ADD CONSTRAINT "FK_journal_entries_year" FOREIGN KEY ("fiscal_year_id") REFERENCES "fiscal_years"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "journal_entries" ADD CONSTRAINT "FK_journal_entries_period" FOREIGN KEY ("fiscal_period_id") REFERENCES "fiscal_periods"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "journal_entries" ADD CONSTRAINT "FK_journal_entries_currency" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "journal_lines" ADD CONSTRAINT "FK_journal_lines_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "journal_lines" ADD CONSTRAINT "FK_journal_lines_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "journal_lines" ADD CONSTRAINT "FK_journal_lines_entry" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "journal_lines" ADD CONSTRAINT "FK_journal_lines_account" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "journal_lines" ADD CONSTRAINT "FK_journal_lines_party" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_sequences" ADD CONSTRAINT "FK_doc_seq_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_sequences" ADD CONSTRAINT "FK_doc_seq_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_sequences" ADD CONSTRAINT "FK_doc_seq_year" FOREIGN KEY ("fiscal_year_id") REFERENCES "fiscal_years"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction_types" ADD CONSTRAINT "FK_transaction_types_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transaction_types" DROP CONSTRAINT "FK_transaction_types_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_sequences" DROP CONSTRAINT "FK_doc_seq_year"`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_sequences" DROP CONSTRAINT "FK_doc_seq_branch"`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_sequences" DROP CONSTRAINT "FK_doc_seq_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "journal_lines" DROP CONSTRAINT "FK_journal_lines_party"`,
    );
    await queryRunner.query(
      `ALTER TABLE "journal_lines" DROP CONSTRAINT "FK_journal_lines_account"`,
    );
    await queryRunner.query(
      `ALTER TABLE "journal_lines" DROP CONSTRAINT "FK_journal_lines_entry"`,
    );
    await queryRunner.query(
      `ALTER TABLE "journal_lines" DROP CONSTRAINT "FK_journal_lines_branch"`,
    );
    await queryRunner.query(
      `ALTER TABLE "journal_lines" DROP CONSTRAINT "FK_journal_lines_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "journal_entries" DROP CONSTRAINT "FK_journal_entries_currency"`,
    );
    await queryRunner.query(
      `ALTER TABLE "journal_entries" DROP CONSTRAINT "FK_journal_entries_period"`,
    );
    await queryRunner.query(
      `ALTER TABLE "journal_entries" DROP CONSTRAINT "FK_journal_entries_year"`,
    );
    await queryRunner.query(
      `ALTER TABLE "journal_entries" DROP CONSTRAINT "FK_journal_entries_branch"`,
    );
    await queryRunner.query(
      `ALTER TABLE "journal_entries" DROP CONSTRAINT "FK_journal_entries_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "fiscal_periods" DROP CONSTRAINT "FK_fiscal_periods_year"`,
    );
    await queryRunner.query(
      `ALTER TABLE "fiscal_years" DROP CONSTRAINT "FK_fiscal_years_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tax_codes" DROP CONSTRAINT "FK_tax_codes_account"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tax_codes" DROP CONSTRAINT "FK_tax_codes_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tax_codes" DROP CONSTRAINT "FK_tax_codes_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tax_templates" DROP CONSTRAINT "FK_tax_templates_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "party_addresses" DROP CONSTRAINT "FK_party_addresses_party"`,
    );
    await queryRunner.query(
      `ALTER TABLE "parties" DROP CONSTRAINT "FK_parties_payment_term"`,
    );
    await queryRunner.query(
      `ALTER TABLE "parties" DROP CONSTRAINT "FK_parties_currency"`,
    );
    await queryRunner.query(
      `ALTER TABLE "parties" DROP CONSTRAINT "FK_parties_branch"`,
    );
    await queryRunner.query(
      `ALTER TABLE "parties" DROP CONSTRAINT "FK_parties_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_methods" DROP CONSTRAINT "FK_payment_methods_account"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_methods" DROP CONSTRAINT "FK_payment_methods_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts" DROP CONSTRAINT "FK_accounts_branch"`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts" DROP CONSTRAINT "FK_accounts_parent"`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts" DROP CONSTRAINT "FK_accounts_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_terms" DROP CONSTRAINT "FK_payment_terms_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "currencies" DROP CONSTRAINT "FK_currencies_org"`,
    );
    await queryRunner.query(`DROP INDEX "public"."uq_transaction_types_org"`);
    await queryRunner.query(
      `DROP INDEX "public"."uq_transaction_types_global"`,
    );
    await queryRunner.query(`DROP TABLE "transaction_types"`);
    await queryRunner.query(`DROP INDEX "public"."doc_seq_unique"`);
    await queryRunner.query(`DROP TABLE "document_sequences"`);
    await queryRunner.query(
      `ALTER TABLE "journal_lines" DROP CONSTRAINT "chk_journal_lines_debit_credit"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_journal_lines_org_party"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_journal_lines_org_account"`,
    );
    await queryRunner.query(`DROP TABLE "journal_lines"`);
    await queryRunner.query(
      `ALTER TABLE "journal_entries" DROP CONSTRAINT "chk_journal_entries_status"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_journal_entries_org_source"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_journal_entries_org_date"`,
    );
    await queryRunner.query(`DROP TABLE "journal_entries"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_fiscal_periods_year_dates"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_fiscal_periods_year_name"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_fiscal_periods_year_sequence"`,
    );
    await queryRunner.query(`DROP TABLE "fiscal_periods"`);
    await queryRunner.query(
      `DROP INDEX "public"."unique_active_fiscal_year_per_org"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_fiscal_years_org_dates"`);
    await queryRunner.query(`DROP INDEX "public"."uq_fiscal_years_org_name"`);
    await queryRunner.query(`DROP TABLE "fiscal_years"`);
    await queryRunner.query(`DROP INDEX "public"."idx_tax_codes_org_name"`);
    await queryRunner.query(`DROP TABLE "tax_codes"`);
    await queryRunner.query(
      `ALTER TABLE "tax_templates" DROP CONSTRAINT "chk_tax_templates_math_sign"`,
    );
    await queryRunner.query(`DROP TABLE "tax_templates"`);
    await queryRunner.query(
      `ALTER TABLE "tax_types" DROP CONSTRAINT "chk_tax_types_math_sign"`,
    );
    await queryRunner.query(`DROP TABLE "tax_types"`);
    await queryRunner.query(`DROP TABLE "party_addresses"`);
    await queryRunner.query(
      `ALTER TABLE "parties" DROP CONSTRAINT "chk_parties_kind"`,
    );
    await queryRunner.query(
      `ALTER TABLE "parties" DROP CONSTRAINT "chk_parties_at_least_one_role"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_parties_org_supplier"`);
    await queryRunner.query(`DROP INDEX "public"."idx_parties_org_customer"`);
    await queryRunner.query(`DROP INDEX "public"."idx_parties_org_pan"`);
    await queryRunner.query(`DROP TABLE "parties"`);
    await queryRunner.query(
      `DROP INDEX "public"."uq_payment_methods_org_name"`,
    );
    await queryRunner.query(`DROP TABLE "payment_methods"`);
    await queryRunner.query(
      `ALTER TABLE "accounts" DROP CONSTRAINT "chk_accounts_coa_type"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_accounts_org_branch"`);
    await queryRunner.query(`DROP INDEX "public"."idx_accounts_org_purpose"`);
    await queryRunner.query(`DROP INDEX "public"."idx_accounts_org_parent"`);
    await queryRunner.query(`DROP INDEX "public"."uq_accounts_org_code"`);
    await queryRunner.query(`DROP TABLE "accounts"`);
    await queryRunner.query(`DROP INDEX "public"."uq_payment_terms_org_name"`);
    await queryRunner.query(`DROP TABLE "payment_terms"`);
    await queryRunner.query(`DROP INDEX "public"."unique_org_currency_code"`);
    await queryRunner.query(
      `DROP INDEX "public"."unique_global_currency_code"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."unique_base_currency_per_org"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_currencies_org"`);
    await queryRunner.query(`DROP TABLE "currencies"`);
  }
}
