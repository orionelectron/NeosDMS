/**
 * Payment / Receipt schema
 *
 * Includes:
 * - customer_receipts
 * - customer_receipt_lines
 * - customer_receipt_invoice_allocations
 * - supplier_payments
 * - supplier_payment_lines
 * - supplier_payment_bill_allocations
 * - supplier_payment_expense_allocations
 *
 * Assumes fixed core + document schema already exist.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    // ──────────────────────────────────────
    // 1. Customer Receipts
    // ──────────────────────────────────────
    await knex.schema.createTable('customer_receipts', (table) => {
        table.increments('id').primary();

        table.integer('organization_id').unsigned().notNullable();
        table.integer('branch_id').unsigned().notNullable();
        table.integer('fiscal_year_id').unsigned().notNullable();
        table.integer('fiscal_period_id').unsigned().notNullable();

        table.string('document_no').notNullable();

        table.integer('party_id').unsigned().notNullable(); // customer
        table.integer('currency_id').unsigned().nullable();
        table.integer('payment_method_id').unsigned().notNullable();

        // account receiving the money: cash/bank/wallet account
        table.integer('deposit_account_id').unsigned().notNullable();

        table.date('receipt_date').notNullable();
        table.string('receipt_date_bs', 10).nullable();

        table
            .enu('status', ['DRAFT', 'POSTED', 'CANCELLED'])
            .notNullable()
            .defaultTo('DRAFT');

        table.decimal('exchange_rate', 15, 6).notNullable().defaultTo(1);

        // total actual money received
        table.decimal('received_amount', 18, 6).notNullable().defaultTo(0);

        // allocated to invoices
        table.decimal('allocated_amount', 18, 6).notNullable().defaultTo(0);

        // remaining as advance/unallocated
        table.decimal('unallocated_amount', 18, 6).notNullable().defaultTo(0);

        table.string('reference_no').nullable(); // bank ref / cheque / wallet txn id
        table.text('notes').nullable();

        table.integer('journal_entry_id').unsigned().nullable();

        table.integer('created_by').unsigned().nullable();
        table.integer('approved_by').unsigned().nullable();
        table.dateTime('approved_at').nullable();
        table.dateTime('posted_at').nullable();
        table.dateTime('cancelled_at').nullable();

        table.foreign('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
        table.foreign('branch_id').references('id').inTable('branches').onDelete('RESTRICT');
        table.foreign('fiscal_year_id').references('id').inTable('fiscal_years').onDelete('RESTRICT');
        table.foreign('fiscal_period_id').references('id').inTable('fiscal_periods').onDelete('RESTRICT');
        table.foreign('party_id').references('id').inTable('parties').onDelete('RESTRICT');
        table.foreign('currency_id').references('id').inTable('currencies').onDelete('SET NULL');
        table.foreign('payment_method_id').references('id').inTable('payment_methods').onDelete('RESTRICT');
        table.foreign('deposit_account_id').references('id').inTable('accounts').onDelete('RESTRICT');
        table.foreign('journal_entry_id').references('id').inTable('journal_entries').onDelete('SET NULL');

        table.unique(['organization_id', 'branch_id', 'fiscal_year_id', 'document_no']);
        table.index(['organization_id', 'branch_id', 'receipt_date']);
        table.index(['organization_id', 'party_id']);
        table.index(['organization_id', 'status']);

        table.timestamps(true, true);
    });

    // Split receipt details if you want multi-line detail/reference support
    await knex.schema.createTable('customer_receipt_lines', (table) => {
        table.increments('id').primary();

        table.integer('customer_receipt_id').unsigned().notNullable();
        table.integer('line_no').unsigned().notNullable();

        table.integer('payment_method_id').unsigned().notNullable();
        table.integer('deposit_account_id').unsigned().notNullable();

        table.decimal('amount', 18, 6).notNullable();
        table.string('reference_no').nullable();
        table.text('description').nullable();

        table.foreign('customer_receipt_id').references('id').inTable('customer_receipts').onDelete('CASCADE');
        table.foreign('payment_method_id').references('id').inTable('payment_methods').onDelete('RESTRICT');
        table.foreign('deposit_account_id').references('id').inTable('accounts').onDelete('RESTRICT');

        table.unique(['customer_receipt_id', 'line_no']);
        table.index(['customer_receipt_id']);

        table.timestamps(true, true);
    });

    // Allocation to sales invoices
    await knex.schema.createTable('customer_receipt_invoice_allocations', (table) => {
        table.increments('id').primary();

        table.integer('customer_receipt_id').unsigned().notNullable();
        table.integer('sales_invoice_id').unsigned().notNullable();

        table.decimal('allocated_amount', 18, 6).notNullable();

        table.foreign('customer_receipt_id').references('id').inTable('customer_receipts').onDelete('CASCADE');
        table.foreign('sales_invoice_id').references('id').inTable('sales_invoices').onDelete('RESTRICT');

        table.unique(['customer_receipt_id', 'sales_invoice_id']);
        table.index(['customer_receipt_id']);
        table.index(['sales_invoice_id']);

        table.timestamps(true, true);
    });

    // ──────────────────────────────────────
    // 2. Supplier Payments
    // ──────────────────────────────────────
    await knex.schema.createTable('supplier_payments', (table) => {
        table.increments('id').primary();

        table.integer('organization_id').unsigned().notNullable();
        table.integer('branch_id').unsigned().notNullable();
        table.integer('fiscal_year_id').unsigned().notNullable();
        table.integer('fiscal_period_id').unsigned().notNullable();

        table.string('document_no').notNullable();

        table.integer('party_id').unsigned().notNullable(); // supplier/vendor
        table.integer('currency_id').unsigned().nullable();
        table.integer('payment_method_id').unsigned().notNullable();

        // account from which money goes out
        table.integer('payment_account_id').unsigned().notNullable();

        table.date('payment_date').notNullable();
        table.string('payment_date_bs', 10).nullable();

        table
            .enu('status', ['DRAFT', 'POSTED', 'CANCELLED'])
            .notNullable()
            .defaultTo('DRAFT');

        table.decimal('exchange_rate', 15, 6).notNullable().defaultTo(1);

        // total money paid
        table.decimal('paid_amount', 18, 6).notNullable().defaultTo(0);

        // allocated to bills/expenses
        table.decimal('allocated_amount', 18, 6).notNullable().defaultTo(0);

        // remaining advance to supplier
        table.decimal('unallocated_amount', 18, 6).notNullable().defaultTo(0);

        table.string('reference_no').nullable();
        table.text('notes').nullable();

        table.integer('journal_entry_id').unsigned().nullable();

        table.integer('created_by').unsigned().nullable();
        table.integer('approved_by').unsigned().nullable();
        table.dateTime('approved_at').nullable();
        table.dateTime('posted_at').nullable();
        table.dateTime('cancelled_at').nullable();

        table.foreign('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
        table.foreign('branch_id').references('id').inTable('branches').onDelete('RESTRICT');
        table.foreign('fiscal_year_id').references('id').inTable('fiscal_years').onDelete('RESTRICT');
        table.foreign('fiscal_period_id').references('id').inTable('fiscal_periods').onDelete('RESTRICT');
        table.foreign('party_id').references('id').inTable('parties').onDelete('RESTRICT');
        table.foreign('currency_id').references('id').inTable('currencies').onDelete('SET NULL');
        table.foreign('payment_method_id').references('id').inTable('payment_methods').onDelete('RESTRICT');
        table.foreign('payment_account_id').references('id').inTable('accounts').onDelete('RESTRICT');
        table.foreign('journal_entry_id').references('id').inTable('journal_entries').onDelete('SET NULL');

        table.unique(['organization_id', 'branch_id', 'fiscal_year_id', 'document_no']);
        table.index(['organization_id', 'branch_id', 'payment_date']);
        table.index(['organization_id', 'party_id']);
        table.index(['organization_id', 'status']);

        table.timestamps(true, true);
    });

    await knex.schema.createTable('supplier_payment_lines', (table) => {
        table.increments('id').primary();

        table.integer('supplier_payment_id').unsigned().notNullable();
        table.integer('line_no').unsigned().notNullable();

        table.integer('payment_method_id').unsigned().notNullable();
        table.integer('payment_account_id').unsigned().notNullable();

        table.decimal('amount', 18, 6).notNullable();
        table.string('reference_no').nullable();
        table.text('description').nullable();

        table.foreign('supplier_payment_id').references('id').inTable('supplier_payments').onDelete('CASCADE');
        table.foreign('payment_method_id').references('id').inTable('payment_methods').onDelete('RESTRICT');
        table.foreign('payment_account_id').references('id').inTable('accounts').onDelete('RESTRICT');

        table.unique(['supplier_payment_id', 'line_no']);
        table.index(['supplier_payment_id']);

        table.timestamps(true, true);
    });

    // Allocation to purchase bills
    await knex.schema.createTable('supplier_payment_bill_allocations', (table) => {
        table.increments('id').primary();

        table.integer('supplier_payment_id').unsigned().notNullable();
        table.integer('purchase_bill_id').unsigned().notNullable();

        table.decimal('allocated_amount', 18, 6).notNullable();

        table.foreign('supplier_payment_id').references('id').inTable('supplier_payments').onDelete('CASCADE');
        table.foreign('purchase_bill_id').references('id').inTable('purchase_bills').onDelete('RESTRICT');

        table.unique(['supplier_payment_id', 'purchase_bill_id']);
        table.index(['supplier_payment_id']);
        table.index(['purchase_bill_id']);

        table.timestamps(true, true);
    });

    // Allocation to expenses
    await knex.schema.createTable('supplier_payment_expense_allocations', (table) => {
        table.increments('id').primary();

        table.integer('supplier_payment_id').unsigned().notNullable();
        table.integer('expense_id').unsigned().notNullable();

        table.decimal('allocated_amount', 18, 6).notNullable();

        table.foreign('supplier_payment_id').references('id').inTable('supplier_payments').onDelete('CASCADE');
        table.foreign('expense_id').references('id').inTable('expenses').onDelete('RESTRICT');

        table.unique(['supplier_payment_id', 'expense_id']);
        table.index(['supplier_payment_id']);
        table.index(['expense_id']);

        table.timestamps(true, true);
    });

    // ──────────────────────────────────────
    // 3. CHECK constraints
    // ──────────────────────────────────────
    await knex.raw(`
    ALTER TABLE customer_receipts
    ADD CONSTRAINT customer_receipts_received_amount_non_negative_chk
    CHECK (received_amount >= 0)
  `);

    await knex.raw(`
    ALTER TABLE customer_receipts
    ADD CONSTRAINT customer_receipts_allocated_amount_non_negative_chk
    CHECK (allocated_amount >= 0)
  `);

    await knex.raw(`
    ALTER TABLE customer_receipts
    ADD CONSTRAINT customer_receipts_unallocated_amount_non_negative_chk
    CHECK (unallocated_amount >= 0)
  `);

    await knex.raw(`
    ALTER TABLE customer_receipt_lines
    ADD CONSTRAINT customer_receipt_lines_amount_positive_chk
    CHECK (amount > 0)
  `);

    await knex.raw(`
    ALTER TABLE customer_receipt_invoice_allocations
    ADD CONSTRAINT customer_receipt_invoice_allocations_amount_positive_chk
    CHECK (allocated_amount > 0)
  `);

    await knex.raw(`
    ALTER TABLE supplier_payments
    ADD CONSTRAINT supplier_payments_paid_amount_non_negative_chk
    CHECK (paid_amount >= 0)
  `);

    await knex.raw(`
    ALTER TABLE supplier_payments
    ADD CONSTRAINT supplier_payments_allocated_amount_non_negative_chk
    CHECK (allocated_amount >= 0)
  `);

    await knex.raw(`
    ALTER TABLE supplier_payments
    ADD CONSTRAINT supplier_payments_unallocated_amount_non_negative_chk
    CHECK (unallocated_amount >= 0)
  `);

    await knex.raw(`
    ALTER TABLE supplier_payment_lines
    ADD CONSTRAINT supplier_payment_lines_amount_positive_chk
    CHECK (amount > 0)
  `);

    await knex.raw(`
    ALTER TABLE supplier_payment_bill_allocations
    ADD CONSTRAINT supplier_payment_bill_allocations_amount_positive_chk
    CHECK (allocated_amount > 0)
  `);

    await knex.raw(`
    ALTER TABLE supplier_payment_expense_allocations
    ADD CONSTRAINT supplier_payment_expense_allocations_amount_positive_chk
    CHECK (allocated_amount > 0)
  `);
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.raw(`
    ALTER TABLE supplier_payment_expense_allocations
    DROP CONSTRAINT IF EXISTS supplier_payment_expense_allocations_amount_positive_chk
  `);

    await knex.raw(`
    ALTER TABLE supplier_payment_bill_allocations
    DROP CONSTRAINT IF EXISTS supplier_payment_bill_allocations_amount_positive_chk
  `);

    await knex.raw(`
    ALTER TABLE supplier_payment_lines
    DROP CONSTRAINT IF EXISTS supplier_payment_lines_amount_positive_chk
  `);

    await knex.raw(`
    ALTER TABLE supplier_payments
    DROP CONSTRAINT IF EXISTS supplier_payments_unallocated_amount_non_negative_chk
  `);

    await knex.raw(`
    ALTER TABLE supplier_payments
    DROP CONSTRAINT IF EXISTS supplier_payments_allocated_amount_non_negative_chk
  `);

    await knex.raw(`
    ALTER TABLE supplier_payments
    DROP CONSTRAINT IF EXISTS supplier_payments_paid_amount_non_negative_chk
  `);

    await knex.raw(`
    ALTER TABLE customer_receipt_invoice_allocations
    DROP CONSTRAINT IF EXISTS customer_receipt_invoice_allocations_amount_positive_chk
  `);

    await knex.raw(`
    ALTER TABLE customer_receipt_lines
    DROP CONSTRAINT IF EXISTS customer_receipt_lines_amount_positive_chk
  `);

    await knex.raw(`
    ALTER TABLE customer_receipts
    DROP CONSTRAINT IF EXISTS customer_receipts_unallocated_amount_non_negative_chk
  `);

    await knex.raw(`
    ALTER TABLE customer_receipts
    DROP CONSTRAINT IF EXISTS customer_receipts_allocated_amount_non_negative_chk
  `);

    await knex.raw(`
    ALTER TABLE customer_receipts
    DROP CONSTRAINT IF EXISTS customer_receipts_received_amount_non_negative_chk
  `);

    await knex.schema.dropTableIfExists('supplier_payment_expense_allocations');
    await knex.schema.dropTableIfExists('supplier_payment_bill_allocations');
    await knex.schema.dropTableIfExists('supplier_payment_lines');
    await knex.schema.dropTableIfExists('supplier_payments');

    await knex.schema.dropTableIfExists('customer_receipt_invoice_allocations');
    await knex.schema.dropTableIfExists('customer_receipt_lines');
    await knex.schema.dropTableIfExists('customer_receipts');
}