/**
 * Sales, Purchase, and Expense Documents
 *
 * Fits the fixed Nepal-ready core schema.
 *
 * Includes:
 * - Sales Quotations
 * - Sales Orders
 * - Sales Invoices
 * - Sales Returns
 * - Purchase Orders
 * - Purchase Receipts
 * - Purchase Bills
 * - Purchase Returns
 * - Expense Claims/Vouchers
 * - Allocation tables
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  // ──────────────────────────────────────
  // 1. Sales Quotations
  // ──────────────────────────────────────
  await knex.schema.createTable('sales_quotations', (table) => {
    table.increments('id').primary();

    table.integer('organization_id').unsigned().notNullable();
    table.integer('branch_id').unsigned().notNullable();
    table.integer('fiscal_year_id').unsigned().notNullable();

    table.string('document_no').notNullable();

    table.integer('party_id').unsigned().notNullable(); // customer
    table.integer('currency_id').unsigned().nullable();
    table.integer('payment_term_id').unsigned().nullable();

    table.date('quotation_date').notNullable();
    table.string('quotation_date_bs', 10).nullable();
    table.date('valid_until').nullable();
    table.string('valid_until_bs', 10).nullable();

    table
      .enu('status', ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED'])
      .notNullable()
      .defaultTo('DRAFT');

    table.decimal('exchange_rate', 15, 6).notNullable().defaultTo(1);

    table.decimal('taxable_total', 18, 6).notNullable().defaultTo(0);
    table.decimal('non_taxable_total', 18, 6).notNullable().defaultTo(0);
    table.decimal('subtotal', 18, 6).notNullable().defaultTo(0);
    table.decimal('discount_total', 18, 6).notNullable().defaultTo(0);
    table.decimal('tax_total', 18, 6).notNullable().defaultTo(0);
    table.decimal('rounding_adjustment', 18, 6).notNullable().defaultTo(0);
    table.decimal('total', 18, 6).notNullable().defaultTo(0);

    table.text('notes').nullable();

    table.integer('created_by').unsigned().nullable();
    table.integer('approved_by').unsigned().nullable();
    table.dateTime('approved_at').nullable();
    table.dateTime('cancelled_at').nullable();

    table.foreign('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
    table.foreign('branch_id').references('id').inTable('branches').onDelete('RESTRICT');
    table.foreign('fiscal_year_id').references('id').inTable('fiscal_years').onDelete('RESTRICT');
    table.foreign('party_id').references('id').inTable('parties').onDelete('RESTRICT');
    table.foreign('currency_id').references('id').inTable('currencies').onDelete('SET NULL');
    table.foreign('payment_term_id').references('id').inTable('payment_terms').onDelete('SET NULL');

    table.unique(['organization_id', 'branch_id', 'fiscal_year_id', 'document_no']);
    table.index(['organization_id', 'branch_id', 'quotation_date']);
    table.index(['organization_id', 'party_id']);
    table.index(['organization_id', 'status']);

    table.timestamps(true, true);
  });

  await knex.schema.createTable('sales_quotation_lines', (table) => {
    table.increments('id').primary();

    table.integer('sales_quotation_id').unsigned().notNullable();
    table.integer('line_no').unsigned().notNullable();

    table.integer('item_id').unsigned().notNullable();
    table.text('description').nullable();
    table.integer('uom_id').unsigned().notNullable();

    table.decimal('quantity', 18, 6).notNullable();
    table.decimal('base_quantity', 18, 6).notNullable();

    table.decimal('unit_price', 18, 6).notNullable().defaultTo(0);
    table.boolean('is_tax_inclusive').notNullable().defaultTo(false);

    table.decimal('gross_amount', 18, 6).notNullable().defaultTo(0);
    table.decimal('discount_percent', 18, 6).notNullable().defaultTo(0);
    table.decimal('discount_amount', 18, 6).notNullable().defaultTo(0);

    table.integer('tax_code_id').unsigned().nullable();
    table.decimal('taxable_amount', 18, 6).notNullable().defaultTo(0);
    table.decimal('tax_rate', 7, 4).notNullable().defaultTo(0);
    table.decimal('tax_amount', 18, 6).notNullable().defaultTo(0);

    table.decimal('line_total', 18, 6).notNullable().defaultTo(0);

    table.foreign('sales_quotation_id').references('id').inTable('sales_quotations').onDelete('CASCADE');
    table.foreign('item_id').references('id').inTable('items').onDelete('RESTRICT');
    table.foreign('uom_id').references('id').inTable('uoms').onDelete('RESTRICT');
    table.foreign('tax_code_id').references('id').inTable('tax_codes').onDelete('SET NULL');

    table.unique(['sales_quotation_id', 'line_no']);
    table.index(['sales_quotation_id']);
    table.index(['item_id']);

    table.timestamps(true, true);
  });

  // ──────────────────────────────────────
  // 2. Sales Orders
  // ──────────────────────────────────────
  await knex.schema.createTable('sales_orders', (table) => {
    table.increments('id').primary();

    table.integer('organization_id').unsigned().notNullable();
    table.integer('branch_id').unsigned().notNullable();
    table.integer('fiscal_year_id').unsigned().notNullable();

    table.string('document_no').notNullable();

    table.integer('party_id').unsigned().notNullable(); // customer
    table.integer('currency_id').unsigned().nullable();
    table.integer('payment_term_id').unsigned().nullable();

    table.integer('sales_quotation_id').unsigned().nullable();

    table.date('order_date').notNullable();
    table.string('order_date_bs', 10).nullable();
    table.date('promised_date').nullable();
    table.string('promised_date_bs', 10).nullable();

    table
      .enu('status', ['DRAFT', 'CONFIRMED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED'])
      .notNullable()
      .defaultTo('DRAFT');

    table.decimal('exchange_rate', 15, 6).notNullable().defaultTo(1);

    table.decimal('taxable_total', 18, 6).notNullable().defaultTo(0);
    table.decimal('non_taxable_total', 18, 6).notNullable().defaultTo(0);
    table.decimal('subtotal', 18, 6).notNullable().defaultTo(0);
    table.decimal('discount_total', 18, 6).notNullable().defaultTo(0);
    table.decimal('tax_total', 18, 6).notNullable().defaultTo(0);
    table.decimal('rounding_adjustment', 18, 6).notNullable().defaultTo(0);
    table.decimal('total', 18, 6).notNullable().defaultTo(0);

    table.text('notes').nullable();

    table.integer('created_by').unsigned().nullable();
    table.integer('approved_by').unsigned().nullable();
    table.dateTime('approved_at').nullable();
    table.dateTime('cancelled_at').nullable();

    table.foreign('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
    table.foreign('branch_id').references('id').inTable('branches').onDelete('RESTRICT');
    table.foreign('fiscal_year_id').references('id').inTable('fiscal_years').onDelete('RESTRICT');
    table.foreign('party_id').references('id').inTable('parties').onDelete('RESTRICT');
    table.foreign('currency_id').references('id').inTable('currencies').onDelete('SET NULL');
    table.foreign('payment_term_id').references('id').inTable('payment_terms').onDelete('SET NULL');
    table.foreign('sales_quotation_id').references('id').inTable('sales_quotations').onDelete('SET NULL');

    table.unique(['organization_id', 'branch_id', 'fiscal_year_id', 'document_no']);
    table.index(['organization_id', 'branch_id', 'order_date']);
    table.index(['organization_id', 'party_id']);
    table.index(['organization_id', 'status']);

    table.timestamps(true, true);
  });

  await knex.schema.createTable('sales_order_lines', (table) => {
    table.increments('id').primary();

    table.integer('sales_order_id').unsigned().notNullable();
    table.integer('line_no').unsigned().notNullable();

    table.integer('item_id').unsigned().notNullable();
    table.text('description').nullable();
    table.integer('uom_id').unsigned().notNullable();

    table.decimal('ordered_quantity', 18, 6).notNullable();
    table.decimal('ordered_base_quantity', 18, 6).notNullable();

    table.decimal('reserved_quantity', 18, 6).notNullable().defaultTo(0);
    table.decimal('delivered_quantity', 18, 6).notNullable().defaultTo(0);
    table.decimal('invoiced_quantity', 18, 6).notNullable().defaultTo(0);

    table.decimal('unit_price', 18, 6).notNullable().defaultTo(0);
    table.boolean('is_tax_inclusive').notNullable().defaultTo(false);

    table.decimal('gross_amount', 18, 6).notNullable().defaultTo(0);
    table.decimal('discount_percent', 18, 6).notNullable().defaultTo(0);
    table.decimal('discount_amount', 18, 6).notNullable().defaultTo(0);

    table.integer('tax_code_id').unsigned().nullable();
    table.decimal('taxable_amount', 18, 6).notNullable().defaultTo(0);
    table.decimal('tax_rate', 7, 4).notNullable().defaultTo(0);
    table.decimal('tax_amount', 18, 6).notNullable().defaultTo(0);

    table.decimal('line_total', 18, 6).notNullable().defaultTo(0);

    table.integer('source_sales_quotation_line_id').unsigned().nullable();

    table.foreign('sales_order_id').references('id').inTable('sales_orders').onDelete('CASCADE');
    table.foreign('item_id').references('id').inTable('items').onDelete('RESTRICT');
    table.foreign('uom_id').references('id').inTable('uoms').onDelete('RESTRICT');
    table.foreign('tax_code_id').references('id').inTable('tax_codes').onDelete('SET NULL');
    table.foreign('source_sales_quotation_line_id').references('id').inTable('sales_quotation_lines').onDelete('SET NULL');

    table.unique(['sales_order_id', 'line_no']);
    table.index(['sales_order_id']);
    table.index(['item_id']);

    table.timestamps(true, true);
  });

  // ──────────────────────────────────────
  // 3. Sales Invoices
  // ──────────────────────────────────────
  await knex.schema.createTable('sales_invoices', (table) => {
    table.increments('id').primary();

    table.integer('organization_id').unsigned().notNullable();
    table.integer('branch_id').unsigned().notNullable();
    table.integer('fiscal_year_id').unsigned().notNullable();
    table.integer('fiscal_period_id').unsigned().notNullable();
    table.boolean('is_export').notNullable().defaultTo(false);

    table.string('document_no').notNullable();

    table.integer('party_id').unsigned().notNullable(); // customer
    table.integer('currency_id').unsigned().nullable();
    table.integer('payment_term_id').unsigned().nullable();

    table.integer('sales_order_id').unsigned().nullable();
    table.integer('transaction_type_id').unsigned().nullable();

    table.date('invoice_date').notNullable();
    table.string('invoice_date_bs', 10).nullable();
    table.date('due_date').nullable();
    table.string('due_date_bs', 10).nullable();

    table
      .enu('status', ['DRAFT', 'POSTED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'])
      .notNullable()
      .defaultTo('DRAFT');

    table.decimal('exchange_rate', 15, 6).notNullable().defaultTo(1);

    table.decimal('taxable_total', 18, 6).notNullable().defaultTo(0);
    table.decimal('non_taxable_total', 18, 6).notNullable().defaultTo(0);
    table.decimal('subtotal', 18, 6).notNullable().defaultTo(0);
    table.decimal('discount_total', 18, 6).notNullable().defaultTo(0);
    table.decimal('tax_total', 18, 6).notNullable().defaultTo(0);
    table.decimal('rounding_adjustment', 18, 6).notNullable().defaultTo(0);
    table.decimal('total', 18, 6).notNullable().defaultTo(0);

    table.decimal('paid_amount', 18, 6).notNullable().defaultTo(0);
    table.decimal('balance_amount', 18, 6).notNullable().defaultTo(0);

    table.integer('print_count').unsigned().notNullable().defaultTo(0);
    table.dateTime('first_printed_at').nullable();
    table.dateTime('last_printed_at').nullable();

    table.text('notes').nullable();

    table.integer('inventory_transaction_id').unsigned().nullable();
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
    table.foreign('payment_term_id').references('id').inTable('payment_terms').onDelete('SET NULL');
    table.foreign('sales_order_id').references('id').inTable('sales_orders').onDelete('SET NULL');
    table.foreign('transaction_type_id').references('id').inTable('transaction_types').onDelete('SET NULL');
    table.foreign('inventory_transaction_id').references('id').inTable('inventory_transactions').onDelete('SET NULL');
    table.foreign('journal_entry_id').references('id').inTable('journal_entries').onDelete('SET NULL');

    table.unique(['organization_id', 'branch_id', 'fiscal_year_id', 'document_no']);
    table.index(['organization_id', 'branch_id', 'invoice_date']);
    table.index(['organization_id', 'party_id']);
    table.index(['organization_id', 'status']);

    table.timestamps(true, true);
  });

  await knex.schema.createTable('sales_invoice_lines', (table) => {
    table.increments('id').primary();

    table.integer('sales_invoice_id').unsigned().notNullable();
    table.integer('line_no').unsigned().notNullable();

    table.integer('item_id').unsigned().notNullable();
    table.text('description').nullable();
    table.integer('uom_id').unsigned().notNullable();

    table.decimal('quantity', 18, 6).notNullable();
    table.decimal('base_quantity', 18, 6).notNullable();

    table.decimal('unit_price', 18, 6).notNullable().defaultTo(0);
    table.boolean('is_tax_inclusive').notNullable().defaultTo(false);

    table.decimal('gross_amount', 18, 6).notNullable().defaultTo(0);
    table.decimal('discount_percent', 18, 6).notNullable().defaultTo(0);
    table.decimal('discount_amount', 18, 6).notNullable().defaultTo(0);

    table.integer('tax_code_id').unsigned().nullable();
    table.decimal('taxable_amount', 18, 6).notNullable().defaultTo(0);
    table.decimal('tax_rate', 7, 4).notNullable().defaultTo(0);
    table.decimal('tax_amount', 18, 6).notNullable().defaultTo(0);

    table.decimal('line_total', 18, 6).notNullable().defaultTo(0);

    table.integer('source_sales_order_line_id').unsigned().nullable();

    table.foreign('sales_invoice_id').references('id').inTable('sales_invoices').onDelete('CASCADE');
    table.foreign('item_id').references('id').inTable('items').onDelete('RESTRICT');
    table.foreign('uom_id').references('id').inTable('uoms').onDelete('RESTRICT');
    table.foreign('tax_code_id').references('id').inTable('tax_codes').onDelete('SET NULL');
    table.foreign('source_sales_order_line_id').references('id').inTable('sales_order_lines').onDelete('SET NULL');

    table.unique(['sales_invoice_id', 'line_no']);
    table.index(['sales_invoice_id']);
    table.index(['item_id']);

    table.timestamps(true, true);
  });

  // ──────────────────────────────────────
  // 4. Sales Returns
  // ──────────────────────────────────────
  await knex.schema.createTable('sales_returns', (table) => {
    table.increments('id').primary();

    table.integer('organization_id').unsigned().notNullable();
    table.integer('branch_id').unsigned().notNullable();
    table.integer('fiscal_year_id').unsigned().notNullable();
    table.integer('fiscal_period_id').unsigned().notNullable();

    table.string('document_no').notNullable();

    table.integer('party_id').unsigned().notNullable(); // customer
    table.integer('currency_id').unsigned().nullable();

    table.integer('sales_invoice_id').unsigned().nullable();
    table.integer('transaction_type_id').unsigned().nullable();

    table.date('return_date').notNullable();
    table.string('return_date_bs', 10).nullable();

    table
      .enu('status', ['DRAFT', 'POSTED', 'CANCELLED'])
      .notNullable()
      .defaultTo('DRAFT');

    table.decimal('exchange_rate', 15, 6).notNullable().defaultTo(1);

    table.decimal('taxable_total', 18, 6).notNullable().defaultTo(0);
    table.decimal('non_taxable_total', 18, 6).notNullable().defaultTo(0);
    table.decimal('subtotal', 18, 6).notNullable().defaultTo(0);
    table.decimal('discount_total', 18, 6).notNullable().defaultTo(0);
    table.decimal('tax_total', 18, 6).notNullable().defaultTo(0);
    table.decimal('rounding_adjustment', 18, 6).notNullable().defaultTo(0);
    table.decimal('total', 18, 6).notNullable().defaultTo(0);

    table.text('return_reason').nullable();
    table.text('notes').nullable();

    table.integer('inventory_transaction_id').unsigned().nullable();
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
    table.foreign('sales_invoice_id').references('id').inTable('sales_invoices').onDelete('SET NULL');
    table.foreign('transaction_type_id').references('id').inTable('transaction_types').onDelete('SET NULL');
    table.foreign('inventory_transaction_id').references('id').inTable('inventory_transactions').onDelete('SET NULL');
    table.foreign('journal_entry_id').references('id').inTable('journal_entries').onDelete('SET NULL');

    table.unique(['organization_id', 'branch_id', 'fiscal_year_id', 'document_no']);
    table.index(['organization_id', 'branch_id', 'return_date']);
    table.index(['organization_id', 'party_id']);
    table.index(['organization_id', 'status']);

    table.timestamps(true, true);
  });

  await knex.schema.createTable('sales_return_lines', (table) => {
    table.increments('id').primary();

    table.integer('sales_return_id').unsigned().notNullable();
    table.integer('line_no').unsigned().notNullable();

    table.integer('item_id').unsigned().notNullable();
    table.text('description').nullable();
    table.integer('uom_id').unsigned().notNullable();

    table.decimal('quantity', 18, 6).notNullable();
    table.decimal('base_quantity', 18, 6).notNullable();

    table.decimal('unit_price', 18, 6).notNullable().defaultTo(0);
    table.boolean('is_tax_inclusive').notNullable().defaultTo(false);

    table.decimal('gross_amount', 18, 6).notNullable().defaultTo(0);
    table.decimal('discount_percent', 18, 6).notNullable().defaultTo(0);
    table.decimal('discount_amount', 18, 6).notNullable().defaultTo(0);

    table.integer('tax_code_id').unsigned().nullable();
    table.decimal('taxable_amount', 18, 6).notNullable().defaultTo(0);
    table.decimal('tax_rate', 7, 4).notNullable().defaultTo(0);
    table.decimal('tax_amount', 18, 6).notNullable().defaultTo(0);

    table.decimal('line_total', 18, 6).notNullable().defaultTo(0);

    table.integer('source_sales_invoice_line_id').unsigned().nullable();

    table.foreign('sales_return_id').references('id').inTable('sales_returns').onDelete('CASCADE');
    table.foreign('item_id').references('id').inTable('items').onDelete('RESTRICT');
    table.foreign('uom_id').references('id').inTable('uoms').onDelete('RESTRICT');
    table.foreign('tax_code_id').references('id').inTable('tax_codes').onDelete('SET NULL');
    table.foreign('source_sales_invoice_line_id').references('id').inTable('sales_invoice_lines').onDelete('SET NULL');

    table.unique(['sales_return_id', 'line_no']);
    table.index(['sales_return_id']);
    table.index(['item_id']);

    table.timestamps(true, true);
  });

  // ──────────────────────────────────────
  // 5. Purchase Orders
  // ──────────────────────────────────────
  await knex.schema.createTable('purchase_orders', (table) => {
    table.increments('id').primary();

    table.integer('organization_id').unsigned().notNullable();
    table.integer('branch_id').unsigned().notNullable();
    table.integer('fiscal_year_id').unsigned().notNullable();

    table.string('document_no').notNullable();

    table.integer('party_id').unsigned().notNullable(); // supplier
    table.integer('currency_id').unsigned().nullable();
    table.integer('payment_term_id').unsigned().nullable();

    table.date('order_date').notNullable();
    table.string('order_date_bs', 10).nullable();
    table.date('expected_date').nullable();
    table.string('expected_date_bs', 10).nullable();

    table
      .enu('status', ['DRAFT', 'CONFIRMED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'])
      .notNullable()
      .defaultTo('DRAFT');

    table.decimal('exchange_rate', 15, 6).notNullable().defaultTo(1);

    table.decimal('taxable_total', 18, 6).notNullable().defaultTo(0);
    table.decimal('non_taxable_total', 18, 6).notNullable().defaultTo(0);
    table.decimal('subtotal', 18, 6).notNullable().defaultTo(0);
    table.decimal('discount_total', 18, 6).notNullable().defaultTo(0);
    table.decimal('tax_total', 18, 6).notNullable().defaultTo(0);
    table.decimal('rounding_adjustment', 18, 6).notNullable().defaultTo(0);
    table.decimal('total', 18, 6).notNullable().defaultTo(0);

    table.text('notes').nullable();

    table.integer('created_by').unsigned().nullable();
    table.integer('approved_by').unsigned().nullable();
    table.dateTime('approved_at').nullable();
    table.dateTime('cancelled_at').nullable();

    table.foreign('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
    table.foreign('branch_id').references('id').inTable('branches').onDelete('RESTRICT');
    table.foreign('fiscal_year_id').references('id').inTable('fiscal_years').onDelete('RESTRICT');
    table.foreign('party_id').references('id').inTable('parties').onDelete('RESTRICT');
    table.foreign('currency_id').references('id').inTable('currencies').onDelete('SET NULL');
    table.foreign('payment_term_id').references('id').inTable('payment_terms').onDelete('SET NULL');

    table.unique(['organization_id', 'branch_id', 'fiscal_year_id', 'document_no']);
    table.index(['organization_id', 'branch_id', 'order_date']);
    table.index(['organization_id', 'party_id']);
    table.index(['organization_id', 'status']);

    table.timestamps(true, true);
  });

  await knex.schema.createTable('purchase_order_lines', (table) => {
    table.increments('id').primary();

    table.integer('purchase_order_id').unsigned().notNullable();
    table.integer('line_no').unsigned().notNullable();

    table.integer('item_id').unsigned().notNullable();
    table.text('description').nullable();
    table.integer('uom_id').unsigned().notNullable();

    table.decimal('ordered_quantity', 18, 6).notNullable();
    table.decimal('ordered_base_quantity', 18, 6).notNullable();

    table.decimal('received_quantity', 18, 6).notNullable().defaultTo(0);
    table.decimal('billed_quantity', 18, 6).notNullable().defaultTo(0);

    table.decimal('unit_cost', 18, 6).notNullable().defaultTo(0);
    table.boolean('is_tax_inclusive').notNullable().defaultTo(false);

    table.decimal('gross_amount', 18, 6).notNullable().defaultTo(0);
    table.decimal('discount_percent', 18, 6).notNullable().defaultTo(0);
    table.decimal('discount_amount', 18, 6).notNullable().defaultTo(0);

    table.integer('tax_code_id').unsigned().nullable();
    table.decimal('taxable_amount', 18, 6).notNullable().defaultTo(0);
    table.decimal('tax_rate', 7, 4).notNullable().defaultTo(0);
    table.decimal('tax_amount', 18, 6).notNullable().defaultTo(0);

    table.decimal('line_total', 18, 6).notNullable().defaultTo(0);

    table.foreign('purchase_order_id').references('id').inTable('purchase_orders').onDelete('CASCADE');
    table.foreign('item_id').references('id').inTable('items').onDelete('RESTRICT');
    table.foreign('uom_id').references('id').inTable('uoms').onDelete('RESTRICT');
    table.foreign('tax_code_id').references('id').inTable('tax_codes').onDelete('SET NULL');

    table.unique(['purchase_order_id', 'line_no']);
    table.index(['purchase_order_id']);
    table.index(['item_id']);

    table.timestamps(true, true);
  });

  // ──────────────────────────────────────
  // 6. Purchase Receipts
  // ──────────────────────────────────────
  await knex.schema.createTable('purchase_receipts', (table) => {
    table.increments('id').primary();

    table.integer('organization_id').unsigned().notNullable();
    table.integer('branch_id').unsigned().notNullable();
    table.integer('fiscal_year_id').unsigned().notNullable();
    table.integer('fiscal_period_id').unsigned().notNullable();

    table.string('document_no').notNullable();

    table.integer('party_id').unsigned().notNullable(); // supplier
    table.integer('purchase_order_id').unsigned().nullable();
    table.integer('location_id').unsigned().notNullable();
    table.integer('currency_id').unsigned().nullable();

    table.date('receipt_date').notNullable();
    table.string('receipt_date_bs', 10).nullable();

    table
      .enu('status', ['DRAFT', 'POSTED', 'CANCELLED'])
      .notNullable()
      .defaultTo('DRAFT');

    table.decimal('exchange_rate', 15, 6).notNullable().defaultTo(1);

    table.decimal('taxable_total', 18, 6).notNullable().defaultTo(0);
    table.decimal('non_taxable_total', 18, 6).notNullable().defaultTo(0);
    table.decimal('subtotal', 18, 6).notNullable().defaultTo(0);
    table.decimal('discount_total', 18, 6).notNullable().defaultTo(0);
    table.decimal('tax_total', 18, 6).notNullable().defaultTo(0);
    table.decimal('rounding_adjustment', 18, 6).notNullable().defaultTo(0);
    table.decimal('total', 18, 6).notNullable().defaultTo(0);

    table.text('notes').nullable();

    table.integer('inventory_transaction_id').unsigned().nullable();

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
    table.foreign('purchase_order_id').references('id').inTable('purchase_orders').onDelete('SET NULL');
    table.foreign('location_id').references('id').inTable('inventory_locations').onDelete('RESTRICT');
    table.foreign('currency_id').references('id').inTable('currencies').onDelete('SET NULL');
    table.foreign('inventory_transaction_id').references('id').inTable('inventory_transactions').onDelete('SET NULL');

    table.unique(['organization_id', 'branch_id', 'fiscal_year_id', 'document_no']);
    table.index(['organization_id', 'branch_id', 'receipt_date']);
    table.index(['organization_id', 'party_id']);
    table.index(['organization_id', 'status']);

    table.timestamps(true, true);
  });

  await knex.schema.createTable('purchase_receipt_lines', (table) => {
    table.increments('id').primary();

    table.integer('purchase_receipt_id').unsigned().notNullable();
    table.integer('line_no').unsigned().notNullable();

    table.integer('item_id').unsigned().notNullable();
    table.text('description').nullable();
    table.integer('uom_id').unsigned().notNullable();

    table.decimal('quantity', 18, 6).notNullable();
    table.decimal('base_quantity', 18, 6).notNullable();

    table.decimal('unit_cost', 18, 6).notNullable().defaultTo(0);
    table.boolean('is_tax_inclusive').notNullable().defaultTo(false);

    table.decimal('gross_amount', 18, 6).notNullable().defaultTo(0);
    table.decimal('discount_percent', 18, 6).notNullable().defaultTo(0);
    table.decimal('discount_amount', 18, 6).notNullable().defaultTo(0);

    table.integer('tax_code_id').unsigned().nullable();
    table.decimal('taxable_amount', 18, 6).notNullable().defaultTo(0);
    table.decimal('tax_rate', 7, 4).notNullable().defaultTo(0);
    table.decimal('tax_amount', 18, 6).notNullable().defaultTo(0);

    table.decimal('line_total', 18, 6).notNullable().defaultTo(0);

    table.integer('source_purchase_order_line_id').unsigned().nullable();

    table.foreign('purchase_receipt_id').references('id').inTable('purchase_receipts').onDelete('CASCADE');
    table.foreign('item_id').references('id').inTable('items').onDelete('RESTRICT');
    table.foreign('uom_id').references('id').inTable('uoms').onDelete('RESTRICT');
    table.foreign('tax_code_id').references('id').inTable('tax_codes').onDelete('SET NULL');
    table.foreign('source_purchase_order_line_id').references('id').inTable('purchase_order_lines').onDelete('SET NULL');

    table.unique(['purchase_receipt_id', 'line_no']);
    table.index(['purchase_receipt_id']);
    table.index(['item_id']);

    table.timestamps(true, true);
  });

  // ──────────────────────────────────────
  // 7. Purchase Bills
  // ──────────────────────────────────────
  await knex.schema.createTable('purchase_bills', (table) => {
    table.increments('id').primary();

    table.integer('organization_id').unsigned().notNullable();
    table.integer('branch_id').unsigned().notNullable();
    table.integer('fiscal_year_id').unsigned().notNullable();
    table.integer('fiscal_period_id').unsigned().notNullable();
    table.boolean('is_import').notNullable().defaultTo(false);

    table.string('document_no').notNullable();

    table.integer('party_id').unsigned().notNullable(); // supplier
    table.integer('currency_id').unsigned().nullable();
    table.integer('payment_term_id').unsigned().nullable();

    table.integer('purchase_order_id').unsigned().nullable();
    table.integer('purchase_receipt_id').unsigned().nullable();
    table.integer('transaction_type_id').unsigned().nullable();

    table.date('bill_date').notNullable();
    table.string('bill_date_bs', 10).nullable();
    table.date('due_date').nullable();
    table.string('due_date_bs', 10).nullable();

    table.string('vendor_bill_no').nullable();

    table
      .enu('status', ['DRAFT', 'POSTED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'])
      .notNullable()
      .defaultTo('DRAFT');

    table.decimal('exchange_rate', 15, 6).notNullable().defaultTo(1);

    table.decimal('taxable_total', 18, 6).notNullable().defaultTo(0);
    table.decimal('non_taxable_total', 18, 6).notNullable().defaultTo(0);
    table.decimal('subtotal', 18, 6).notNullable().defaultTo(0);
    table.decimal('discount_total', 18, 6).notNullable().defaultTo(0);
    table.decimal('tax_total', 18, 6).notNullable().defaultTo(0);
    table.decimal('rounding_adjustment', 18, 6).notNullable().defaultTo(0);
    table.decimal('total', 18, 6).notNullable().defaultTo(0);

    table.decimal('paid_amount', 18, 6).notNullable().defaultTo(0);
    table.decimal('balance_amount', 18, 6).notNullable().defaultTo(0);

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
    table.foreign('payment_term_id').references('id').inTable('payment_terms').onDelete('SET NULL');
    table.foreign('purchase_order_id').references('id').inTable('purchase_orders').onDelete('SET NULL');
    table.foreign('purchase_receipt_id').references('id').inTable('purchase_receipts').onDelete('SET NULL');
    table.foreign('transaction_type_id').references('id').inTable('transaction_types').onDelete('SET NULL');
    table.foreign('journal_entry_id').references('id').inTable('journal_entries').onDelete('SET NULL');

    table.unique(['organization_id', 'branch_id', 'fiscal_year_id', 'document_no']);
    table.index(['organization_id', 'branch_id', 'bill_date']);
    table.index(['organization_id', 'party_id']);
    table.index(['organization_id', 'status']);

    table.timestamps(true, true);
  });

  await knex.schema.createTable('purchase_bill_lines', (table) => {
    table.increments('id').primary();

    table.integer('purchase_bill_id').unsigned().notNullable();
    table.integer('line_no').unsigned().notNullable();

    table.integer('item_id').unsigned().notNullable();
    table.text('description').nullable();
    table.integer('uom_id').unsigned().notNullable();

    table.decimal('quantity', 18, 6).notNullable();
    table.decimal('base_quantity', 18, 6).notNullable();

    table.decimal('unit_cost', 18, 6).notNullable().defaultTo(0);
    table.boolean('is_tax_inclusive').notNullable().defaultTo(false);

    table.decimal('gross_amount', 18, 6).notNullable().defaultTo(0);
    table.decimal('discount_percent', 18, 6).notNullable().defaultTo(0);
    table.decimal('discount_amount', 18, 6).notNullable().defaultTo(0);

    table.integer('tax_code_id').unsigned().nullable();
    table.decimal('taxable_amount', 18, 6).notNullable().defaultTo(0);
    table.decimal('tax_rate', 7, 4).notNullable().defaultTo(0);
    table.decimal('tax_amount', 18, 6).notNullable().defaultTo(0);

    table.decimal('line_total', 18, 6).notNullable().defaultTo(0);

    table.integer('source_purchase_order_line_id').unsigned().nullable();
    table.integer('source_purchase_receipt_line_id').unsigned().nullable();

    table.foreign('purchase_bill_id').references('id').inTable('purchase_bills').onDelete('CASCADE');
    table.foreign('item_id').references('id').inTable('items').onDelete('RESTRICT');
    table.foreign('uom_id').references('id').inTable('uoms').onDelete('RESTRICT');
    table.foreign('tax_code_id').references('id').inTable('tax_codes').onDelete('SET NULL');
    table.foreign('source_purchase_order_line_id').references('id').inTable('purchase_order_lines').onDelete('SET NULL');
    table.foreign('source_purchase_receipt_line_id').references('id').inTable('purchase_receipt_lines').onDelete('SET NULL');

    table.unique(['purchase_bill_id', 'line_no']);
    table.index(['purchase_bill_id']);
    table.index(['item_id']);

    table.timestamps(true, true);
  });

  // ──────────────────────────────────────
  // 8. Purchase Returns
  // ──────────────────────────────────────
  await knex.schema.createTable('purchase_returns', (table) => {
    table.increments('id').primary();

    table.integer('organization_id').unsigned().notNullable();
    table.integer('branch_id').unsigned().notNullable();
    table.integer('fiscal_year_id').unsigned().notNullable();
    table.integer('fiscal_period_id').unsigned().notNullable();

    table.string('document_no').notNullable();

    table.integer('party_id').unsigned().notNullable(); // supplier
    table.integer('currency_id').unsigned().nullable();

    table.integer('purchase_bill_id').unsigned().nullable();
    table.integer('purchase_receipt_id').unsigned().nullable();
    table.integer('transaction_type_id').unsigned().nullable();
    table.integer('location_id').unsigned().nullable();

    table.date('return_date').notNullable();
    table.string('return_date_bs', 10).nullable();

    table
      .enu('status', ['DRAFT', 'POSTED', 'CANCELLED'])
      .notNullable()
      .defaultTo('DRAFT');

    table.decimal('exchange_rate', 15, 6).notNullable().defaultTo(1);

    table.decimal('taxable_total', 18, 6).notNullable().defaultTo(0);
    table.decimal('non_taxable_total', 18, 6).notNullable().defaultTo(0);
    table.decimal('subtotal', 18, 6).notNullable().defaultTo(0);
    table.decimal('discount_total', 18, 6).notNullable().defaultTo(0);
    table.decimal('tax_total', 18, 6).notNullable().defaultTo(0);
    table.decimal('rounding_adjustment', 18, 6).notNullable().defaultTo(0);
    table.decimal('total', 18, 6).notNullable().defaultTo(0);

    table.text('return_reason').nullable();
    table.text('notes').nullable();

    table.integer('inventory_transaction_id').unsigned().nullable();
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
    table.foreign('purchase_bill_id').references('id').inTable('purchase_bills').onDelete('SET NULL');
    table.foreign('purchase_receipt_id').references('id').inTable('purchase_receipts').onDelete('SET NULL');
    table.foreign('transaction_type_id').references('id').inTable('transaction_types').onDelete('SET NULL');
    table.foreign('location_id').references('id').inTable('inventory_locations').onDelete('SET NULL');
    table.foreign('inventory_transaction_id').references('id').inTable('inventory_transactions').onDelete('SET NULL');
    table.foreign('journal_entry_id').references('id').inTable('journal_entries').onDelete('SET NULL');

    table.unique(['organization_id', 'branch_id', 'fiscal_year_id', 'document_no']);
    table.index(['organization_id', 'branch_id', 'return_date']);
    table.index(['organization_id', 'party_id']);
    table.index(['organization_id', 'status']);

    table.timestamps(true, true);
  });

  await knex.schema.createTable('purchase_return_lines', (table) => {
    table.increments('id').primary();

    table.integer('purchase_return_id').unsigned().notNullable();
    table.integer('line_no').unsigned().notNullable();

    table.integer('item_id').unsigned().notNullable();
    table.text('description').nullable();
    table.integer('uom_id').unsigned().notNullable();

    table.decimal('quantity', 18, 6).notNullable();
    table.decimal('base_quantity', 18, 6).notNullable();

    table.decimal('unit_cost', 18, 6).notNullable().defaultTo(0);
    table.boolean('is_tax_inclusive').notNullable().defaultTo(false);

    table.decimal('gross_amount', 18, 6).notNullable().defaultTo(0);
    table.decimal('discount_percent', 18, 6).notNullable().defaultTo(0);
    table.decimal('discount_amount', 18, 6).notNullable().defaultTo(0);

    table.integer('tax_code_id').unsigned().nullable();
    table.decimal('taxable_amount', 18, 6).notNullable().defaultTo(0);
    table.decimal('tax_rate', 7, 4).notNullable().defaultTo(0);
    table.decimal('tax_amount', 18, 6).notNullable().defaultTo(0);

    table.decimal('line_total', 18, 6).notNullable().defaultTo(0);

    table.integer('source_purchase_bill_line_id').unsigned().nullable();
    table.integer('source_purchase_receipt_line_id').unsigned().nullable();

    table.foreign('purchase_return_id').references('id').inTable('purchase_returns').onDelete('CASCADE');
    table.foreign('item_id').references('id').inTable('items').onDelete('RESTRICT');
    table.foreign('uom_id').references('id').inTable('uoms').onDelete('RESTRICT');
    table.foreign('tax_code_id').references('id').inTable('tax_codes').onDelete('SET NULL');
    table.foreign('source_purchase_bill_line_id').references('id').inTable('purchase_bill_lines').onDelete('SET NULL');
    table.foreign('source_purchase_receipt_line_id').references('id').inTable('purchase_receipt_lines').onDelete('SET NULL');

    table.unique(['purchase_return_id', 'line_no']);
    table.index(['purchase_return_id']);
    table.index(['item_id']);

    table.timestamps(true, true);
  });

  // ──────────────────────────────────────
  // 9. Expenses
  // ──────────────────────────────────────
  await knex.schema.createTable('expenses', (table) => {
    table.increments('id').primary();

    table.integer('organization_id').unsigned().notNullable();
    table.integer('branch_id').unsigned().notNullable();
    table.integer('fiscal_year_id').unsigned().notNullable();
    table.integer('fiscal_period_id').unsigned().notNullable();

    table.string('document_no').notNullable();

    table.integer('party_id').unsigned().nullable(); // vendor/supplier optional
    table.integer('currency_id').unsigned().nullable();
    table.integer('payment_term_id').unsigned().nullable();
    table.integer('payment_method_id').unsigned().nullable();
    table.integer('transaction_type_id').unsigned().nullable();

    table.date('expense_date').notNullable();
    table.string('expense_date_bs', 10).nullable();
    table.date('due_date').nullable();
    table.string('due_date_bs', 10).nullable();

    table.string('vendor_bill_no').nullable();

    table
      .enu('status', ['DRAFT', 'POSTED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'])
      .notNullable()
      .defaultTo('DRAFT');

    table
      .enu('expense_mode', ['CASH', 'CREDIT'])
      .notNullable()
      .defaultTo('CASH');

    table.decimal('exchange_rate', 15, 6).notNullable().defaultTo(1);

    table.decimal('taxable_total', 18, 6).notNullable().defaultTo(0);
    table.decimal('non_taxable_total', 18, 6).notNullable().defaultTo(0);
    table.decimal('subtotal', 18, 6).notNullable().defaultTo(0);
    table.decimal('discount_total', 18, 6).notNullable().defaultTo(0);
    table.decimal('tax_total', 18, 6).notNullable().defaultTo(0);
    table.decimal('rounding_adjustment', 18, 6).notNullable().defaultTo(0);
    table.decimal('total', 18, 6).notNullable().defaultTo(0);

    table.decimal('paid_amount', 18, 6).notNullable().defaultTo(0);
    table.decimal('balance_amount', 18, 6).notNullable().defaultTo(0);

    table.text('purpose').nullable();
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
    table.foreign('party_id').references('id').inTable('parties').onDelete('SET NULL');
    table.foreign('currency_id').references('id').inTable('currencies').onDelete('SET NULL');
    table.foreign('payment_term_id').references('id').inTable('payment_terms').onDelete('SET NULL');
    table.foreign('payment_method_id').references('id').inTable('payment_methods').onDelete('SET NULL');
    table.foreign('transaction_type_id').references('id').inTable('transaction_types').onDelete('SET NULL');
    table.foreign('journal_entry_id').references('id').inTable('journal_entries').onDelete('SET NULL');

    table.unique(['organization_id', 'branch_id', 'fiscal_year_id', 'document_no']);
    table.index(['organization_id', 'branch_id', 'expense_date']);
    table.index(['organization_id', 'party_id']);
    table.index(['organization_id', 'status']);

    table.timestamps(true, true);
  });

  await knex.schema.createTable('expense_lines', (table) => {
    table.increments('id').primary();

    table.integer('expense_id').unsigned().notNullable();
    table.integer('line_no').unsigned().notNullable();

    // direct expense account
    table.integer('expense_account_id').unsigned().notNullable();

    table.text('description').notNullable();

    table.decimal('quantity', 18, 6).notNullable().defaultTo(1);
    table.decimal('unit_amount', 18, 6).notNullable().defaultTo(0);

    table.decimal('gross_amount', 18, 6).notNullable().defaultTo(0);
    table.decimal('discount_percent', 18, 6).notNullable().defaultTo(0);
    table.decimal('discount_amount', 18, 6).notNullable().defaultTo(0);

    table.integer('tax_code_id').unsigned().nullable();
    table.decimal('taxable_amount', 18, 6).notNullable().defaultTo(0);
    table.decimal('tax_rate', 7, 4).notNullable().defaultTo(0);
    table.decimal('tax_amount', 18, 6).notNullable().defaultTo(0);

    table.decimal('line_total', 18, 6).notNullable().defaultTo(0);

    table.foreign('expense_id').references('id').inTable('expenses').onDelete('CASCADE');
    table.foreign('expense_account_id').references('id').inTable('accounts').onDelete('RESTRICT');
    table.foreign('tax_code_id').references('id').inTable('tax_codes').onDelete('SET NULL');

    table.unique(['expense_id', 'line_no']);
    table.index(['expense_id']);
    table.index(['expense_account_id']);

    table.timestamps(true, true);
  });

  // ──────────────────────────────────────
  // 10. Allocation Tables
  // ──────────────────────────────────────
  await knex.schema.createTable('sales_quotation_order_allocations', (table) => {
    table.increments('id').primary();
    table.integer('sales_quotation_line_id').unsigned().notNullable();
    table.integer('sales_order_line_id').unsigned().notNullable();
    table.decimal('quantity', 18, 6).notNullable();
    table.decimal('base_quantity', 18, 6).notNullable();

    table.foreign('sales_quotation_line_id').references('id').inTable('sales_quotation_lines').onDelete('CASCADE');
    table.foreign('sales_order_line_id').references('id').inTable('sales_order_lines').onDelete('CASCADE');

    table.unique(['sales_quotation_line_id', 'sales_order_line_id']);
    table.timestamps(true, true);
  });

  await knex.schema.createTable('sales_order_invoice_allocations', (table) => {
    table.increments('id').primary();
    table.integer('sales_order_line_id').unsigned().notNullable();
    table.integer('sales_invoice_line_id').unsigned().notNullable();
    table.decimal('quantity', 18, 6).notNullable();
    table.decimal('base_quantity', 18, 6).notNullable();

    table.foreign('sales_order_line_id').references('id').inTable('sales_order_lines').onDelete('CASCADE');
    table.foreign('sales_invoice_line_id').references('id').inTable('sales_invoice_lines').onDelete('CASCADE');

    table.unique(['sales_order_line_id', 'sales_invoice_line_id']);
    table.timestamps(true, true);
  });

  await knex.schema.createTable('sales_invoice_return_allocations', (table) => {
    table.increments('id').primary();
    table.integer('sales_invoice_line_id').unsigned().notNullable();
    table.integer('sales_return_line_id').unsigned().notNullable();
    table.decimal('quantity', 18, 6).notNullable();
    table.decimal('base_quantity', 18, 6).notNullable();

    table.foreign('sales_invoice_line_id').references('id').inTable('sales_invoice_lines').onDelete('CASCADE');
    table.foreign('sales_return_line_id').references('id').inTable('sales_return_lines').onDelete('CASCADE');

    table.unique(['sales_invoice_line_id', 'sales_return_line_id']);
    table.timestamps(true, true);
  });

  await knex.schema.createTable('purchase_order_receipt_allocations', (table) => {
    table.increments('id').primary();
    table.integer('purchase_order_line_id').unsigned().notNullable();
    table.integer('purchase_receipt_line_id').unsigned().notNullable();
    table.decimal('quantity', 18, 6).notNullable();
    table.decimal('base_quantity', 18, 6).notNullable();

    table.foreign('purchase_order_line_id').references('id').inTable('purchase_order_lines').onDelete('CASCADE');
    table.foreign('purchase_receipt_line_id').references('id').inTable('purchase_receipt_lines').onDelete('CASCADE');

    table.unique(['purchase_order_line_id', 'purchase_receipt_line_id']);
    table.timestamps(true, true);
  });

  await knex.schema.createTable('purchase_receipt_bill_allocations', (table) => {
    table.increments('id').primary();
    table.integer('purchase_receipt_line_id').unsigned().notNullable();
    table.integer('purchase_bill_line_id').unsigned().notNullable();
    table.decimal('quantity', 18, 6).notNullable();
    table.decimal('base_quantity', 18, 6).notNullable();

    table.foreign('purchase_receipt_line_id').references('id').inTable('purchase_receipt_lines').onDelete('CASCADE');
    table.foreign('purchase_bill_line_id').references('id').inTable('purchase_bill_lines').onDelete('CASCADE');

    table.unique(['purchase_receipt_line_id', 'purchase_bill_line_id']);
    table.timestamps(true, true);
  });

  await knex.schema.createTable('purchase_bill_return_allocations', (table) => {
    table.increments('id').primary();
    table.integer('purchase_bill_line_id').unsigned().notNullable();
    table.integer('purchase_return_line_id').unsigned().notNullable();
    table.decimal('quantity', 18, 6).notNullable();
    table.decimal('base_quantity', 18, 6).notNullable();

    table.foreign('purchase_bill_line_id').references('id').inTable('purchase_bill_lines').onDelete('CASCADE');
    table.foreign('purchase_return_line_id').references('id').inTable('purchase_return_lines').onDelete('CASCADE');

    table.unique(['purchase_bill_line_id', 'purchase_return_line_id']);
    table.timestamps(true, true);
  });

  await knex.schema.createTable('purchase_receipt_return_allocations', (table) => {
    table.increments('id').primary();
    table.integer('purchase_receipt_line_id').unsigned().notNullable();
    table.integer('purchase_return_line_id').unsigned().notNullable();
    table.decimal('quantity', 18, 6).notNullable();
    table.decimal('base_quantity', 18, 6).notNullable();

    table.foreign('purchase_receipt_line_id').references('id').inTable('purchase_receipt_lines').onDelete('CASCADE');
    table.foreign('purchase_return_line_id').references('id').inTable('purchase_return_lines').onDelete('CASCADE');

    table.unique(['purchase_receipt_line_id', 'purchase_return_line_id']);
    table.timestamps(true, true);
  });

  // ──────────────────────────────────────
  // 11. Basic CHECK constraints
  // ──────────────────────────────────────
  const checks = [
    ['sales_quotation_lines', 'quantity'],
    ['sales_quotation_lines', 'base_quantity'],
    ['sales_order_lines', 'ordered_quantity'],
    ['sales_order_lines', 'ordered_base_quantity'],
    ['sales_invoice_lines', 'quantity'],
    ['sales_invoice_lines', 'base_quantity'],
    ['sales_return_lines', 'quantity'],
    ['sales_return_lines', 'base_quantity'],
    ['purchase_order_lines', 'ordered_quantity'],
    ['purchase_order_lines', 'ordered_base_quantity'],
    ['purchase_receipt_lines', 'quantity'],
    ['purchase_receipt_lines', 'base_quantity'],
    ['purchase_bill_lines', 'quantity'],
    ['purchase_bill_lines', 'base_quantity'],
    ['purchase_return_lines', 'quantity'],
    ['purchase_return_lines', 'base_quantity'],
    ['expense_lines', 'quantity'],
  ];

  for (const [tableName, columnName] of checks) {
    await knex.raw(`
      ALTER TABLE ${tableName}
      ADD CONSTRAINT ${tableName}_${columnName}_positive_chk
      CHECK (${columnName} > 0)
    `);
  }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  const checks = [
    ['expense_lines', 'quantity'],
    ['purchase_return_lines', 'base_quantity'],
    ['purchase_return_lines', 'quantity'],
    ['purchase_bill_lines', 'base_quantity'],
    ['purchase_bill_lines', 'quantity'],
    ['purchase_receipt_lines', 'base_quantity'],
    ['purchase_receipt_lines', 'quantity'],
    ['purchase_order_lines', 'ordered_base_quantity'],
    ['purchase_order_lines', 'ordered_quantity'],
    ['sales_return_lines', 'base_quantity'],
    ['sales_return_lines', 'quantity'],
    ['sales_invoice_lines', 'base_quantity'],
    ['sales_invoice_lines', 'quantity'],
    ['sales_order_lines', 'ordered_base_quantity'],
    ['sales_order_lines', 'ordered_quantity'],
    ['sales_quotation_lines', 'base_quantity'],
    ['sales_quotation_lines', 'quantity'],
  ];

  for (const [tableName, columnName] of checks) {
    await knex.raw(`
      ALTER TABLE ${tableName}
      DROP CONSTRAINT IF EXISTS ${tableName}_${columnName}_positive_chk
    `);
  }

  await knex.schema.dropTableIfExists('purchase_receipt_return_allocations');
  await knex.schema.dropTableIfExists('purchase_bill_return_allocations');
  await knex.schema.dropTableIfExists('purchase_receipt_bill_allocations');
  await knex.schema.dropTableIfExists('purchase_order_receipt_allocations');
  await knex.schema.dropTableIfExists('sales_invoice_return_allocations');
  await knex.schema.dropTableIfExists('sales_order_invoice_allocations');
  await knex.schema.dropTableIfExists('sales_quotation_order_allocations');

  await knex.schema.dropTableIfExists('expense_lines');
  await knex.schema.dropTableIfExists('expenses');

  await knex.schema.dropTableIfExists('purchase_return_lines');
  await knex.schema.dropTableIfExists('purchase_returns');
  await knex.schema.dropTableIfExists('purchase_bill_lines');
  await knex.schema.dropTableIfExists('purchase_bills');
  await knex.schema.dropTableIfExists('purchase_receipt_lines');
  await knex.schema.dropTableIfExists('purchase_receipts');
  await knex.schema.dropTableIfExists('purchase_order_lines');
  await knex.schema.dropTableIfExists('purchase_orders');

  await knex.schema.dropTableIfExists('sales_return_lines');
  await knex.schema.dropTableIfExists('sales_returns');
  await knex.schema.dropTableIfExists('sales_invoice_lines');
  await knex.schema.dropTableIfExists('sales_invoices');
  await knex.schema.dropTableIfExists('sales_order_lines');
  await knex.schema.dropTableIfExists('sales_orders');
  await knex.schema.dropTableIfExists('sales_quotation_lines');
  await knex.schema.dropTableIfExists('sales_quotations');
}