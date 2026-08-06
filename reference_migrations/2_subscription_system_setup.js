/**
 * @param { import("knex").Knex } knex
 */
export function up(knex) {
    return knex.schema
        // 1. Subscription Plans (e.g., 'Basic', 'Professional', 'Enterprise')
        .createTable('plans', (table) => {
            table.increments('id').primary();
            table.string('name').notNullable();
            table.string('description').nullable();
            table.integer('grace_period_days').defaultTo(3); // Days to allow access after payment failure
            table.boolean('is_active').defaultTo(true);
            table.timestamps(true, true);
        })

        // 2. Billing Periods (e.g., 'Monthly' with 30 days, 'Annually' with 365 days)
        .createTable('billing_periods', (table) => {
            table.increments('id').primary();
            table.string('name').notNullable();
            table.integer('duration_days').notNullable();
            table.timestamps(true, true);
        })

        // 3. Price Matrix (The "Anchor" for Pricing)
        // This allows different prices for the same Plan across different Verticals
        .createTable('price_matrices', (table) => {
            table.increments('id').primary();
            table.integer('plan_id').unsigned().notNullable().references('id').inTable('plans').onDelete('CASCADE');
            table.integer('vertical_id').unsigned().notNullable().references('id').inTable('verticals').onDelete('CASCADE');
            table.integer('billing_period_id').unsigned().notNullable().references('id').inTable('billing_periods').onDelete('CASCADE');

            table.decimal('base_price', 12, 2).notNullable();
            table.string('currency', 3).notNullable().defaultTo('NPR');
            table.boolean('is_tax_inclusive').defaultTo(false);

            table.unique(['plan_id', 'vertical_id', 'billing_period_id'], 'unique_price_point');
            table.timestamps(true, true);
        })

        // 4. Plan Module Mapping & Resource Limits
        // Defines which modules are active for a plan and their specific limits
        .createTable('plan_module_mappings', (table) => {
            table.increments('id').primary();
            table.integer('plan_id').unsigned().notNullable().references('id').inTable('plans').onDelete('CASCADE');
            table.integer('module_id').unsigned().notNullable().references('id').inTable('modules').onDelete('CASCADE');

            // e.g., {"max_users": 5, "max_invoices_per_month": 1000, "multi_branch": false}
            table.jsonb('features_config').nullable();

            table.unique(['plan_id', 'module_id']);
            table.timestamps(true, true);
        })

        // 5. Subscriptions (The Link between Tenant and Price)
        .createTable('subscriptions', (table) => {
            table.increments('id').primary();
            table.integer('organization_id').unsigned().notNullable().references('id').inTable('organizations').onDelete('CASCADE');

            // We reference price_matrix_id so if you change plan prices later, 
            // existing customers stay on the price they signed up for.
            table.integer('price_matrix_id').unsigned().notNullable().references('id').inTable('price_matrices');

            table.enum('status', ['trialing', 'active', 'past_due', 'canceled']).notNullable().defaultTo('trialing');

            table.date('trial_end_date').nullable();
            table.timestamp('current_period_start').notNullable();
            table.timestamp('current_period_end').notNullable();

            table.boolean('auto_renew').defaultTo(false);
            table.timestamp('canceled_at').nullable();

            table.timestamps(true, true);
        })

        // 6. Organization Usage (Performance optimized tracking)
        // Tracks current resource counts so you don't have to run heavy COUNT(*) queries
        .createTable('organization_usages', (table) => {
            table.increments('id').primary();
            table.integer('organization_id').unsigned().notNullable().references('id').inTable('organizations').onDelete('CASCADE');
            table.string('resource_code').notNullable(); // 'total_users', 'monthly_invoices'
            table.integer('current_usage').defaultTo(0);
            table.timestamp('last_reset_at').nullable(); // For monthly reset limits

            table.unique(['organization_id', 'resource_code']);
        })

        // 7. Payment Transactions
        .createTable('subscription_transactions', (table) => {
            table.increments('id').primary();
            table.integer('subscription_id').unsigned().notNullable().references('id').inTable('subscriptions').onDelete('CASCADE');
            table.integer('organization_id').unsigned().notNullable().references('id').inTable('organizations').onDelete('CASCADE');

            table.string('invoice_number').notNullable().unique();
            table.decimal('amount', 12, 2).notNullable();
            table.string('currency', 3).notNullable().defaultTo('NPR');

            table.string('status').notNullable().defaultTo('pending'); // pending, completed, failed, refunded
            table.string('payment_gateway').nullable(); // 'esewa', 'khalti', 'manual'
            table.string('gateway_transaction_id').nullable();

            table.jsonb('gateway_payload').nullable(); // To debug gateway callbacks
            table.timestamps(true, true);
        })

        .createTable('subscription_history', table => {
            table.increments('id').primary();
            table.integer('subscription_id').unsigned().notNullable().references('id').inTable('subscriptions').onDelete('CASCADE');
            table.integer('price_matrix_id').unsigned().notNullable();
            table.string('status').notNullable();
            table.timestamp('changed_at').defaultTo(knex.fn.now());
        })
}

export function down(knex) {
    return knex.schema
        .dropTableIfExists('subscription_history')
        .dropTableIfExists('subscription_transactions')
        .dropTableIfExists('organization_usages')
        .dropTableIfExists('subscriptions')
        .dropTableIfExists('plan_module_mappings')
        .dropTableIfExists('price_matrices')
        .dropTableIfExists('billing_periods')
        .dropTableIfExists('plans');
}