/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema

        // ═══════════════════════════════════════════
        // 1. VERTICALS
        // ═══════════════════════════════════════════
        .createTable('verticals', (table) => {
            table.increments('id').primary();
            table.string('name').notNullable().unique();
            table.timestamps(true, true);
        })

        // ═══════════════════════════════════════════
        // 2. MODULES
        // ═══════════════════════════════════════════
        .createTable('modules', (table) => {
            table.increments('id').primary();
            table.string('name').notNullable().unique();
            table.text('description').nullable();
            table.timestamps(true, true);
        })

        // ═══════════════════════════════════════════
        // 3. VERTICAL ↔ MODULE MAPPING
        // ═══════════════════════════════════════════
        .createTable('vertical_module_mappings', (table) => {
            table.increments('id').primary();
            table.integer('vertical_id').unsigned().notNullable();
            table.integer('module_id').unsigned().notNullable();
            table.boolean('enabled').notNullable().defaultTo(true);

            table.foreign('vertical_id').references('id').inTable('verticals').onDelete('CASCADE');
            table.foreign('module_id').references('id').inTable('modules').onDelete('CASCADE');

            table.unique(['vertical_id', 'module_id']);
            table.timestamps(true, true);
        })

        // ═══════════════════════════════════════════
        // 4. ORGANIZATIONS
        // ═══════════════════════════════════════════
        .createTable('organizations', (table) => {
            table.increments('id').primary();
            table.integer('vertical_id').unsigned().notNullable();

            table.string('name').notNullable();
            table.string('legal_name').nullable();
            table.string('trade_name').nullable();

            table.string('email').notNullable();
            table.string('phone_number').notNullable();

            table.string('pan_number').notNullable().unique();
            table.string('vat_number').nullable().unique();

            table.string('logo_url').nullable();
            table.string('address').nullable();

            table.foreign('vertical_id').references('id').inTable('verticals').onDelete('CASCADE');

            table.index(['email']);
            table.index(['phone_number']);
            table.timestamps(true, true);
        })

        // ═══════════════════════════════════════════
        // 5. BRANCHES
        // ═══════════════════════════════════════════
        .createTable('branches', (table) => {
            table.increments('id').primary();
            table.integer('organization_id').unsigned().notNullable();

            table.string('name').notNullable();
            table.string('code').notNullable();
            table.string('location').nullable();
            table.boolean('is_main_branch').notNullable().defaultTo(false);
            table.boolean('is_active').notNullable().defaultTo(true);
            table.string('phone').nullable();
            table.string('email').nullable();

            table.foreign('organization_id').references('id').inTable('organizations').onDelete('CASCADE');

            table.unique(['organization_id', 'code']);
            table.timestamps(true, true);
        })

        // ═══════════════════════════════════════════
        // 6. FISCAL YEARS
        // ═══════════════════════════════════════════
        .createTable('fiscal_years', (table) => {
            table.increments('id').primary();
            table.integer('organization_id').unsigned().notNullable();

            table.string('name').notNullable(); // e.g. "2080/81"
            table.date('start_date').notNullable();
            table.date('end_date').notNullable();

            table.boolean('is_active').notNullable().defaultTo(false);
            table.boolean('is_closed').notNullable().defaultTo(false);

            table.timestamp('closed_at').nullable();
            table.integer('closed_by').unsigned().nullable();

            table.foreign('organization_id')
                .references('id').inTable('organizations').onDelete('CASCADE');

            table.unique(['organization_id', 'name']);
            table.index(['organization_id', 'start_date', 'end_date']);

            table.timestamps(true, true);
        })

        // ═══════════════════════════════════════════
        // 7. FISCAL PERIODS
        // ═══════════════════════════════════════════
        .createTable('fiscal_periods', (table) => {
            table.increments('id').primary();
            table.integer('fiscal_year_id').unsigned().notNullable();

            table.string('name').notNullable();
            table.integer('sequence').notNullable();

            table.string('start_date_bs', 10).notNullable();
            table.string('end_date_bs', 10).notNullable();
            table.date('start_date').notNullable();
            table.date('end_date').notNullable();

            table.boolean('is_locked').notNullable().defaultTo(false);
            table.timestamp('locked_at').nullable();
            table.integer('locked_by').unsigned().nullable();

            table.foreign('fiscal_year_id')
                .references('id').inTable('fiscal_years').onDelete('CASCADE');

            table.unique(['fiscal_year_id', 'sequence']);
            table.unique(['fiscal_year_id', 'name']);
            table.index(['fiscal_year_id', 'start_date', 'end_date']);

            table.timestamps(true, true);
        })

        // ═══════════════════════════════════════════
        // 8. CURRENCIES
        // ═══════════════════════════════════════════
        .createTable('currencies', (table) => {
            table.increments('id').primary();
            table.integer('organization_id').unsigned().nullable(); // null = global/system currency

            table.string('code', 3).notNullable();
            table.string('name').notNullable();
            table.string('symbol').nullable();
            table.integer('precision').notNullable().defaultTo(2);
            table.boolean('is_base').notNullable().defaultTo(false);
            table.boolean('is_active').notNullable().defaultTo(true);

            table.foreign('organization_id').references('id').inTable('organizations').onDelete('CASCADE');

            table.timestamps(true, true);
        })

        // ═══════════════════════════════════════════
        // 9. EXCHANGE RATES
        // ═══════════════════════════════════════════
        .createTable('exchange_rates', (table) => {
            table.increments('id').primary();
            table.integer('organization_id').unsigned().nullable(); // null = global rate
            table.integer('from_currency_id').unsigned().notNullable();
            table.integer('to_currency_id').unsigned().notNullable();

            table.decimal('rate', 15, 6).notNullable();
            table.date('effective_date').notNullable();

            table.foreign('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
            table.foreign('from_currency_id').references('id').inTable('currencies').onDelete('CASCADE');
            table.foreign('to_currency_id').references('id').inTable('currencies').onDelete('CASCADE');

            table.timestamps(true, true);
        })

        // ═══════════════════════════════════════════
        // 10. PAYMENT TERMS
        // ═══════════════════════════════════════════
        .createTable('payment_terms', (table) => {
            table.increments('id').primary();
            table.integer('organization_id').unsigned().notNullable();

            table.string('name').notNullable();
            table.integer('due_days').notNullable().defaultTo(0);

            table.foreign('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
            table.unique(['organization_id', 'name']);
            table.timestamps(true, true);
        })

        // ═══════════════════════════════════════════
        // 11. PAYMENT METHODS
        // ═══════════════════════════════════════════
        .createTable('payment_methods', (table) => {
            table.increments('id').primary();
            table.integer('organization_id').unsigned().notNullable();
            table.integer('linked_account_id').unsigned().nullable();

            table.string('name').notNullable();

            table.enu('method_type', [
                'CASH',
                'BANK',
                'CARD',
                'WALLET',
                'CREDIT',
                'OTHER'
            ]).notNullable();

            table.boolean('is_active').notNullable().defaultTo(true);

            table.foreign('organization_id').references('id').inTable('organizations').onDelete('CASCADE');

            table.unique(['organization_id', 'name']);
            table.timestamps(true, true);
        })

        // ═══════════════════════════════════════════
        // 12. ACCOUNTS (Chart of Accounts)
        // ═══════════════════════════════════════════
        .createTable('accounts', (table) => {
            table.increments('id').primary();
            table.integer('organization_id').unsigned().notNullable();
            table.integer('parent_account_id').unsigned().nullable();

            table.string('name').notNullable();
            table.string('code').notNullable();

            table.enu('coa_type', [
                'ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'
            ]).notNullable();

            table.boolean('is_group').notNullable().defaultTo(false);
            table.integer('branch_id').unsigned().nullable();

            table.boolean('is_system_account').notNullable().defaultTo(false);
            table.enu('system_purpose', [
                'CASH',
                'BANK',
                'ACCOUNTS_RECEIVABLE',
                'ACCOUNTS_PAYABLE',
                'SALES',
                'PURCHASE',
                'COST_OF_GOODS_SOLD',
                'TAX_PAYABLE',
                'TAX_RECEIVABLE',
                'RETAINED_EARNINGS',
                'OPENING_BALANCE_EQUITY',
                'DISCOUNT_ALLOWED',
                'DISCOUNT_RECEIVED',
                'ROUNDING'
            ]).nullable();

            table.boolean('is_locked').notNullable().defaultTo(false);
            table.boolean('is_active').notNullable().defaultTo(true);

            table.integer('level').nullable();
            table.string('path').nullable();

            table.foreign('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
            table.foreign('parent_account_id').references('id').inTable('accounts').onDelete('SET NULL');
            table.foreign('branch_id').references('id').inTable('branches').onDelete('SET NULL');

            table.unique(['organization_id', 'code']);
            table.index(['organization_id', 'parent_account_id']);
            table.index(['organization_id', 'system_purpose']);
            table.index(['organization_id', 'branch_id']);

            table.timestamps(true, true);
        })

        // ═══════════════════════════════════════════
        // 13. PARTIES
        // ═══════════════════════════════════════════
        .createTable('parties', (table) => {
            table.increments('id').primary();
            table.integer('organization_id').unsigned().notNullable();
            table.integer('branch_id').unsigned().nullable();
            table.integer('currency_id').unsigned().nullable();
            table.integer('payment_term_id').unsigned().nullable();

            table.string('name').notNullable();
            table.string('legal_name').nullable();

            table.enu('party_kind', ['BUSINESS', 'INDIVIDUAL']).notNullable().defaultTo('BUSINESS');

            table.boolean('is_customer').notNullable().defaultTo(false);
            table.boolean('is_supplier').notNullable().defaultTo(false);
            table.boolean('is_lead').notNullable().defaultTo(false);

            table.string('pan_number').nullable();
            table.string('vat_number').nullable();
            table.string('email').nullable();
            table.string('phone').nullable();
            table.string('address').nullable();

            table.decimal('credit_limit', 15, 2).notNullable().defaultTo(0);
            table.decimal('opening_balance', 15, 2).notNullable().defaultTo(0);

            table.boolean('is_active').notNullable().defaultTo(true);

            table.foreign('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
            table.foreign('branch_id').references('id').inTable('branches').onDelete('SET NULL');
            table.foreign('currency_id').references('id').inTable('currencies').onDelete('SET NULL');
            table.foreign('payment_term_id').references('id').inTable('payment_terms').onDelete('SET NULL');

            table.index(['organization_id', 'pan_number']);
            table.index(['organization_id', 'is_customer']);
            table.index(['organization_id', 'is_supplier']);
            table.timestamps(true, true);
        })

        // ═══════════════════════════════════════════
        // 14. PARTY ADDRESSES
        // ═══════════════════════════════════════════
        .createTable('party_addresses', (table) => {
            table.increments('id').primary();
            table.integer('party_id').unsigned().notNullable();

            table.string('address_type').notNullable();
            table.string('address_line_1').notNullable();
            table.string('address_line_2').nullable();
            table.string('city').nullable();
            table.string('state').nullable();
            table.string('zip_code').nullable();
            table.string('country').notNullable().defaultTo('Nepal');
            table.boolean('is_default').notNullable().defaultTo(false);

            table.foreign('party_id').references('id').inTable('parties').onDelete('CASCADE');
            table.timestamps(true, true);
        })

        // ═══════════════════════════════════════════
        // 15. TAX TYPES
        // ═══════════════════════════════════════════
        .createTable('tax_types', (table) => {
            table.increments('id').primary();

            table.string('name').notNullable().unique();
            table.string('description').nullable();
            table.integer('math_sign').notNullable().defaultTo(1); // 1 add, -1 deduct
            table.boolean('is_system').notNullable().defaultTo(true);

            table.timestamps(true, true);
        })

        // ═══════════════════════════════════════════
        // 16. TAX CODES
        // ═══════════════════════════════════════════
        .createTable('tax_codes', (table) => {
            table.increments('id').primary();
            table.integer('organization_id').unsigned().notNullable();
            table.integer('tax_type_id').unsigned().notNullable();
            table.integer('account_id').unsigned().nullable();

            table.string('name').notNullable();

            table.enu('ird_category', [
                'TAXABLE', 'EXEMPT', 'ZERO_RATED', 'TDS_WITHHOLDING'
            ]).notNullable().defaultTo('TAXABLE');

            table.decimal('rate', 7, 4).notNullable().defaultTo(0);
            table.date('effective_from').notNullable();
            table.date('effective_to').nullable();

            table.boolean('is_locked').notNullable().defaultTo(true);
            table.boolean('is_active').notNullable().defaultTo(true);

            table.foreign('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
            table.foreign('tax_type_id').references('id').inTable('tax_types').onDelete('RESTRICT');
            table.foreign('account_id').references('id').inTable('accounts').onDelete('SET NULL');

            table.index(['organization_id', 'name']);
            table.timestamps(true, true);
        })

        // ═══════════════════════════════════════════
        // 17. TAX TEMPLATES
        // ═══════════════════════════════════════════
        .createTable('tax_templates', (table) => {
            table.increments('id').primary();
            table.integer('tax_type_id').unsigned().notNullable();

            table.string('name').notNullable();
            table.decimal('rate', 7, 4).notNullable().defaultTo(0);

            table.enu('ird_category', [
                'TAXABLE', 'EXEMPT', 'ZERO_RATED', 'TDS_WITHHOLDING'
            ]).notNullable();

            table.integer('math_sign').notNullable().defaultTo(1);
            table.boolean('is_active').notNullable().defaultTo(true);

            table.foreign('tax_type_id').references('id').inTable('tax_types').onDelete('RESTRICT');
            table.timestamps(true, true);
        })

        // ═══════════════════════════════════════════
        // 18. TRANSACTION TAGS
        // ═══════════════════════════════════════════
        .createTable('transaction_tags', (table) => {
            table.increments('id').primary();
            table.integer('organization_id').unsigned().notNullable();

            table.string('tag_name').notNullable();
            table.jsonb('options').notNullable();

            table.foreign('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
            table.timestamps(true, true);
        })

        // ═══════════════════════════════════════════
        // 19. JOURNAL ENTRIES
        // ═══════════════════════════════════════════
        .createTable('journal_entries', (table) => {
            table.increments('id').primary();
            table.integer('organization_id').unsigned().notNullable();
            table.integer('branch_id').unsigned().notNullable();
            table.integer('fiscal_year_id').unsigned().notNullable();
            table.integer('fiscal_period_id').unsigned().notNullable();

            table.integer('currency_id').unsigned().nullable();
            table.decimal('exchange_rate', 15, 6).notNullable().defaultTo(1.0);

            table.date('entry_date').notNullable();
            table.string('entry_date_bs', 10).nullable();

            table.string('description').nullable();
            table.string('reference_number').nullable();

            table.enu('status', ['DRAFT', 'POSTED', 'CANCELLED']).notNullable().defaultTo('DRAFT');

            table.string('source_type').nullable();
            table.integer('source_id').unsigned().nullable();

            table.integer('created_by').unsigned().nullable();
            table.integer('updated_by').unsigned().nullable();

            table.foreign('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
            table.foreign('branch_id').references('id').inTable('branches').onDelete('CASCADE');
            table.foreign('fiscal_year_id').references('id').inTable('fiscal_years').onDelete('CASCADE');
            table.foreign('fiscal_period_id').references('id').inTable('fiscal_periods').onDelete('CASCADE');
            table.foreign('currency_id').references('id').inTable('currencies').onDelete('SET NULL');

            table.index(['organization_id', 'entry_date']);
            table.index(['organization_id', 'source_type', 'source_id']);
            table.index(['fiscal_year_id']);
            table.index(['fiscal_period_id']);

            table.timestamps(true, true);
        })

        // ═══════════════════════════════════════════
        // 20. JOURNAL ENTRY TAGS
        // ═══════════════════════════════════════════
        .createTable('journal_entry_tags', (table) => {
            table.increments('id').primary();
            table.integer('organization_id').unsigned().notNullable();
            table.integer('journal_entry_id').unsigned().notNullable();
            table.integer('tag_id').unsigned().notNullable();
            table.string('option_value').notNullable();

            table.foreign('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
            table.foreign('journal_entry_id').references('id').inTable('journal_entries').onDelete('CASCADE');
            table.foreign('tag_id').references('id').inTable('transaction_tags').onDelete('CASCADE');

            table.unique(['journal_entry_id', 'tag_id', 'option_value']);
            table.timestamps(true, true);
        })

        // ═══════════════════════════════════════════
        // 21. JOURNAL LINES
        // ═══════════════════════════════════════════
        .createTable('journal_lines', (table) => {
            table.increments('id').primary();
            table.integer('organization_id').unsigned().notNullable();
            table.integer('branch_id').unsigned().notNullable();
            table.integer('journal_entry_id').unsigned().notNullable();
            table.integer('account_id').unsigned().notNullable();
            table.integer('party_id').unsigned().nullable();

            table.decimal('debit_amount', 15, 4).notNullable().defaultTo(0);
            table.decimal('credit_amount', 15, 4).notNullable().defaultTo(0);

            table.string('description').nullable();
            table.boolean('is_reconciled').notNullable().defaultTo(false);
            table.date('reconciled_date').nullable();

            table.foreign('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
            table.foreign('branch_id').references('id').inTable('branches').onDelete('CASCADE');
            table.foreign('journal_entry_id').references('id').inTable('journal_entries').onDelete('CASCADE');
            table.foreign('account_id').references('id').inTable('accounts').onDelete('CASCADE');
            table.foreign('party_id').references('id').inTable('parties').onDelete('SET NULL');

            table.index(['organization_id', 'account_id']);
            table.index(['organization_id', 'party_id']);
            table.index(['journal_entry_id']);

            table.timestamps(true, true);
        })

        // ═══════════════════════════════════════════
        // 22. DOCUMENT SEQUENCES
        // ═══════════════════════════════════════════
        .createTable('document_sequences', (table) => {
            table.increments('id').primary();
            table.integer('organization_id').unsigned().notNullable();
            table.integer('branch_id').unsigned().nullable();
            table.integer('fiscal_year_id').unsigned().nullable();

            table.string('document_type').notNullable();
            table.string('prefix').nullable();
            table.integer('last_number').notNullable().defaultTo(0);

            table.foreign('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
            table.foreign('branch_id').references('id').inTable('branches').onDelete('SET NULL');
            table.foreign('fiscal_year_id').references('id').inTable('fiscal_years').onDelete('SET NULL');

            table.timestamps(true, true);
        })

        // ═══════════════════════════════════════════
        // 23. ATTACHMENTS
        // ═══════════════════════════════════════════
        .createTable('attachments', (table) => {
            table.increments('id').primary();
            table.integer('organization_id').unsigned().notNullable();

            table.string('entity_type').notNullable();
            table.integer('entity_id').notNullable();
            table.string('file_name').notNullable();
            table.string('file_url').notNullable();
            table.string('file_type').nullable();

            table.foreign('organization_id').references('id').inTable('organizations').onDelete('CASCADE');

            table.index(['entity_type', 'entity_id']);
            table.timestamps(true, true);
        })

        // ═══════════════════════════════════════════
        // 24. TRANSACTION TYPES
        // ═══════════════════════════════════════════
        .createTable('transaction_types', (table) => {
            table.increments('id').primary();
            table.integer('organization_id').unsigned().nullable();

            table.string('code').notNullable();
            table.string('name').notNullable();
            table.string('nature').notNullable();

            table.boolean('is_cross_border').notNullable().defaultTo(false);
            table.boolean('affects_inventory').notNullable().defaultTo(false);
            table.boolean('affects_tax').notNullable().defaultTo(true);
            table.boolean('is_system').notNullable().defaultTo(true);

            table.foreign('organization_id').references('id').inTable('organizations').onDelete('CASCADE');

            table.unique(['organization_id', 'code']);
            table.timestamps(true, true);
        })

        // ═══════════════════════════════════════════
        // RAW CONSTRAINTS / INDEXES
        // ═══════════════════════════════════════════

        // Only ONE active fiscal year per organization
        .raw(`
            CREATE UNIQUE INDEX unique_active_fiscal_year_per_org
            ON fiscal_years (organization_id)
            WHERE is_active = true;
        `)

        // Only ONE base currency per organization (for org-specific currencies)
        .raw(`
            CREATE UNIQUE INDEX unique_base_currency_per_org
            ON currencies (organization_id)
            WHERE organization_id IS NOT NULL AND is_base = true;
        `)

        // Global currencies must have unique code
        .raw(`
            CREATE UNIQUE INDEX unique_global_currency_code
            ON currencies (code)
            WHERE organization_id IS NULL;
        `)

        // Org-specific currencies must be unique by org + code
        .raw(`
            CREATE UNIQUE INDEX unique_org_currency_code
            ON currencies (organization_id, code)
            WHERE organization_id IS NOT NULL;
        `)

        // Exchange rates unique, null-safe by organization
        .raw(`
            CREATE UNIQUE INDEX unique_exchange_rate_per_scope
            ON exchange_rates (
                COALESCE(organization_id, 0),
                from_currency_id,
                to_currency_id,
                effective_date
            );
        `)

        // NULL-safe unique constraint for document sequences
        .raw(`
            CREATE UNIQUE INDEX doc_seq_unique
            ON document_sequences (
                organization_id,
                COALESCE(branch_id, 0),
                COALESCE(fiscal_year_id, 0),
                document_type
            );
        `)

        // Debit and credit must be mutually exclusive and one side must be > 0
        .raw(`
            ALTER TABLE journal_lines
            ADD CONSTRAINT chk_debit_credit
            CHECK (
                (debit_amount > 0 AND credit_amount = 0) OR
                (credit_amount > 0 AND debit_amount = 0)
            );
        `)

        // Tax type sign must be only 1 or -1
        .raw(`
            ALTER TABLE tax_types
            ADD CONSTRAINT chk_tax_types_math_sign
            CHECK (math_sign IN (1, -1));
        `)

        // Tax template sign must be only 1 or -1
        .raw(`
            ALTER TABLE tax_templates
            ADD CONSTRAINT chk_tax_templates_math_sign
            CHECK (math_sign IN (1, -1));
        `)

        // Prevent same currency pair
        .raw(`
            ALTER TABLE exchange_rates
            ADD CONSTRAINT chk_exchange_rate_currency_pair
            CHECK (from_currency_id <> to_currency_id);
        `)

        // At least one role on party
        .raw(`
            ALTER TABLE parties
            ADD CONSTRAINT chk_parties_at_least_one_role
            CHECK (
                is_customer = true OR
                is_supplier = true OR
                is_lead = true
            );
        `);
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema
        // Raw constraints first
        .raw('ALTER TABLE parties DROP CONSTRAINT IF EXISTS chk_parties_at_least_one_role')
        .raw('ALTER TABLE exchange_rates DROP CONSTRAINT IF EXISTS chk_exchange_rate_currency_pair')
        .raw('ALTER TABLE tax_templates DROP CONSTRAINT IF EXISTS chk_tax_templates_math_sign')
        .raw('ALTER TABLE tax_types DROP CONSTRAINT IF EXISTS chk_tax_types_math_sign')
        .raw('ALTER TABLE journal_lines DROP CONSTRAINT IF EXISTS chk_debit_credit')

        .raw('DROP INDEX IF EXISTS doc_seq_unique')
        .raw('DROP INDEX IF EXISTS unique_exchange_rate_per_scope')
        .raw('DROP INDEX IF EXISTS unique_org_currency_code')
        .raw('DROP INDEX IF EXISTS unique_global_currency_code')
        .raw('DROP INDEX IF EXISTS unique_base_currency_per_org')
        .raw('DROP INDEX IF EXISTS unique_active_fiscal_year_per_org')

        // Tables in reverse dependency order
        .dropTableIfExists('transaction_types')
        .dropTableIfExists('attachments')
        .dropTableIfExists('document_sequences')
        .dropTableIfExists('journal_lines')
        .dropTableIfExists('journal_entry_tags')
        .dropTableIfExists('journal_entries')
        .dropTableIfExists('transaction_tags')
        .dropTableIfExists('tax_templates')
        .dropTableIfExists('tax_codes')
        .dropTableIfExists('tax_types')
        .dropTableIfExists('party_addresses')
        .dropTableIfExists('parties')
        .dropTableIfExists('accounts')
        .dropTableIfExists('payment_methods')
        .dropTableIfExists('payment_terms')
        .dropTableIfExists('exchange_rates')
        .dropTableIfExists('currencies')
        .dropTableIfExists('fiscal_periods')
        .dropTableIfExists('fiscal_years')
        .dropTableIfExists('branches')
        .dropTableIfExists('organizations')
        .dropTableIfExists('vertical_module_mappings')
        .dropTableIfExists('modules')
        .dropTableIfExists('verticals');
}