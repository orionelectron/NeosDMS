/**
 * Inventory core v2
 *
 * Supports:
 * - quantity, batch, serial tracking
 * - multi-location inventory
 * - ledger + balance tables
 * - draft/post/cancel workflow
 * - transfer headers with source/destination locations
 *
 * Assumes existing tables:
 * - organizations
 * - items
 * - uoms
 *
 * PostgreSQL recommended.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    // ──────────────────────────────────────
    // 0. Extend items with inventory behavior
    // ──────────────────────────────────────
    await knex.schema.alterTable('items', (table) => {
        table
            .enu('inventory_tracking', ['NONE', 'QUANTITY', 'BATCH', 'SERIAL'], {
                useNative: true,
                enumName: 'item_inventory_tracking_enum',
            })
            .notNullable()
            .defaultTo('QUANTITY');

        table.boolean('track_expiry').notNullable().defaultTo(false);
        table.boolean('allow_negative_stock').notNullable().defaultTo(false);

        // Optional but useful distinction:
        // valuation_method on items may still exist in your schema.
        // If later you want FEFO as issue strategy rather than valuation,
        // add another column in a future migration.
    });

    // ──────────────────────────────────────
    // 1. Inventory Locations
    // ──────────────────────────────────────
    await knex.schema.createTable('inventory_locations', (table) => {
        table.increments('id').primary();
        table.integer('organization_id').unsigned().notNullable();

        table.string('name').notNullable();
        table.string('code').nullable();

        table
            .enu(
                'location_type',
                ['STORE', 'WAREHOUSE', 'KITCHEN', 'BAR', 'WASTAGE', 'TRANSIT'],
                {
                    useNative: true,
                    enumName: 'inventory_location_type_enum',
                }
            )
            .notNullable()
            .defaultTo('STORE');

        table.boolean('is_active').notNullable().defaultTo(true);
        table.text('notes').nullable();

        table
            .foreign('organization_id')
            .references('id')
            .inTable('organizations')
            .onDelete('CASCADE');

        table.unique(['organization_id', 'code']);
        table.index(['organization_id']);
        table.index(['organization_id', 'is_active']);
        table.timestamps(true, true);
    });

    // ──────────────────────────────────────
    // 2. Inventory Transactions (header)
    // ──────────────────────────────────────
    await knex.schema.createTable('inventory_transactions', (table) => {
        table.increments('id').primary();
        table.integer('organization_id').unsigned().notNullable();

        table.string('document_no').nullable();

        table
            .enu(
                'transaction_type',
                [
                    'OPENING',
                    'PURCHASE_RECEIPT',
                    'PURCHASE_RETURN',
                    'SALE',
                    'SALE_RETURN',
                    'TRANSFER_OUT',
                    'TRANSFER_IN',
                    'ADJUSTMENT_IN',
                    'ADJUSTMENT_OUT',
                    'PRODUCTION_CONSUME',
                    'PRODUCTION_OUTPUT',
                    'WASTAGE',
                    'STOCK_COUNT',
                ],
                {
                    useNative: true,
                    enumName: 'inventory_transaction_type_enum',
                }
            )
            .notNullable();

        table
            .enu('posting_status', ['DRAFT', 'POSTED', 'CANCELLED'], {
                useNative: true,
                enumName: 'inventory_posting_status_enum',
            })
            .notNullable()
            .defaultTo('DRAFT');

        // Useful for transfer headers and document context
        table.integer('source_location_id').unsigned().nullable();
        table.integer('destination_location_id').unsigned().nullable();

        table.string('reference_type').nullable(); // PURCHASE, INVOICE, POS_SALE, etc
        table.integer('reference_id').unsigned().nullable();

        table.dateTime('transaction_date').notNullable();
        table.dateTime('posted_at').nullable();

        table.dateTime('voided_at').nullable();
        table.text('void_reason').nullable();

        table.text('notes').nullable();

        table
            .foreign('organization_id')
            .references('id')
            .inTable('organizations')
            .onDelete('CASCADE');

        table
            .foreign('source_location_id')
            .references('id')
            .inTable('inventory_locations')
            .onDelete('RESTRICT');

        table
            .foreign('destination_location_id')
            .references('id')
            .inTable('inventory_locations')
            .onDelete('RESTRICT');

        table.unique(['organization_id', 'document_no']);
        table.index(['organization_id', 'transaction_type']);
        table.index(['organization_id', 'posting_status']);
        table.index(['reference_type', 'reference_id']);
        table.index(['transaction_date']);
        table.index(['source_location_id']);
        table.index(['destination_location_id']);
        table.timestamps(true, true);
    });

    // ──────────────────────────────────────
    // 3. Inventory Transaction Lines
    // ──────────────────────────────────────
    await knex.schema.createTable('inventory_transaction_lines', (table) => {
        table.increments('id').primary();
        table.integer('transaction_id').unsigned().notNullable();
        table.integer('organization_id').unsigned().notNullable();

        table.integer('line_no').unsigned().notNullable().defaultTo(1);

        table.integer('item_id').unsigned().notNullable();
        table.integer('location_id').unsigned().notNullable();

        table
            .enu('direction', ['IN', 'OUT'], {
                useNative: true,
                enumName: 'inventory_direction_enum',
            })
            .notNullable();

        // Quantity entered in chosen UOM
        table.decimal('quantity', 15, 6).notNullable();

        // UOM used during entry
        table.integer('uom_id').unsigned().notNullable();

        // Converted to item base UOM
        table.decimal('base_quantity', 15, 6).notNullable();

        // Costing
        table.decimal('unit_cost', 15, 6).nullable();
        table.decimal('total_cost', 15, 6).nullable();

        table.text('notes').nullable();

        table
            .foreign('transaction_id')
            .references('id')
            .inTable('inventory_transactions')
            .onDelete('CASCADE');

        table
            .foreign('organization_id')
            .references('id')
            .inTable('organizations')
            .onDelete('CASCADE');

        table.foreign('item_id').references('id').inTable('items').onDelete('RESTRICT');

        table
            .foreign('location_id')
            .references('id')
            .inTable('inventory_locations')
            .onDelete('RESTRICT');

        table.foreign('uom_id').references('id').inTable('uoms').onDelete('RESTRICT');

        table.unique(['transaction_id', 'line_no']);
        table.index(['transaction_id']);
        table.index(['organization_id', 'item_id']);
        table.index(['organization_id', 'location_id']);
        table.index(['organization_id', 'item_id', 'location_id']);
        table.timestamps(true, true);
    });

    // ──────────────────────────────────────
    // 4. Inventory Batches / Lots
    // ──────────────────────────────────────
    await knex.schema.createTable('inventory_batches', (table) => {
        table.increments('id').primary();
        table.integer('organization_id').unsigned().notNullable();
        table.integer('item_id').unsigned().notNullable();

        table.string('batch_no').notNullable();
        table.date('manufactured_on').nullable();
        table.date('expiry_date').nullable();

        table.decimal('purchase_unit_cost', 15, 6).nullable();
        table.text('notes').nullable();

        table
            .foreign('organization_id')
            .references('id')
            .inTable('organizations')
            .onDelete('CASCADE');

        table.foreign('item_id').references('id').inTable('items').onDelete('RESTRICT');

        table.unique(['organization_id', 'item_id', 'batch_no']);
        table.index(['organization_id', 'item_id']);
        table.index(['item_id', 'expiry_date']);
        table.timestamps(true, true);
    });

    // ──────────────────────────────────────
    // 5. Batch allocations per transaction line
    // ──────────────────────────────────────
    await knex.schema.createTable('inventory_transaction_line_batches', (table) => {
        table.increments('id').primary();
        table.integer('transaction_line_id').unsigned().notNullable();
        table.integer('batch_id').unsigned().notNullable();

        // Always base UOM quantity
        table.decimal('quantity', 15, 6).notNullable();

        table
            .foreign('transaction_line_id')
            .references('id')
            .inTable('inventory_transaction_lines')
            .onDelete('CASCADE');

        table
            .foreign('batch_id')
            .references('id')
            .inTable('inventory_batches')
            .onDelete('RESTRICT');

        table.unique(['transaction_line_id', 'batch_id']);
        table.index(['transaction_line_id']);
        table.index(['batch_id']);
        table.timestamps(true, true);
    });

    // ──────────────────────────────────────
    // 6. Inventory Serials
    // ──────────────────────────────────────
    await knex.schema.createTable('inventory_serials', (table) => {
        table.increments('id').primary();
        table.integer('organization_id').unsigned().notNullable();
        table.integer('item_id').unsigned().notNullable();

        table.string('serial_no').notNullable();

        table.integer('batch_id').unsigned().nullable();
        table.date('expiry_date').nullable();

        table
            .enu(
                'status',
                ['IN_STOCK', 'SOLD', 'RETURNED', 'SCRAPPED', 'IN_TRANSIT'],
                {
                    useNative: true,
                    enumName: 'inventory_serial_status_enum',
                }
            )
            .notNullable()
            .defaultTo('IN_STOCK');

        table.integer('current_location_id').unsigned().nullable();

        table
            .foreign('organization_id')
            .references('id')
            .inTable('organizations')
            .onDelete('CASCADE');

        table.foreign('item_id').references('id').inTable('items').onDelete('RESTRICT');
        table.foreign('batch_id').references('id').inTable('inventory_batches').onDelete('SET NULL');

        table
            .foreign('current_location_id')
            .references('id')
            .inTable('inventory_locations')
            .onDelete('SET NULL');

        table.unique(['organization_id', 'item_id', 'serial_no']);
        table.index(['organization_id', 'item_id']);
        table.index(['item_id', 'status']);
        table.index(['current_location_id']);
        table.timestamps(true, true);
    });

    // ──────────────────────────────────────
    // 7. Serial allocations per transaction line
    // ──────────────────────────────────────
    await knex.schema.createTable('inventory_transaction_line_serials', (table) => {
        table.increments('id').primary();
        table.integer('transaction_line_id').unsigned().notNullable();
        table.integer('serial_id').unsigned().notNullable();

        table
            .foreign('transaction_line_id')
            .references('id')
            .inTable('inventory_transaction_lines')
            .onDelete('CASCADE');

        table
            .foreign('serial_id')
            .references('id')
            .inTable('inventory_serials')
            .onDelete('RESTRICT');

        table.unique(['transaction_line_id', 'serial_id']);
        table.index(['transaction_line_id']);
        table.index(['serial_id']);
        table.timestamps(true, true);
    });

    // ──────────────────────────────────────
    // 8. Current item/location balances
    // ──────────────────────────────────────
    await knex.schema.createTable('inventory_balances', (table) => {
        table.increments('id').primary();
        table.integer('organization_id').unsigned().notNullable();
        table.integer('item_id').unsigned().notNullable();
        table.integer('location_id').unsigned().notNullable();

        table.decimal('quantity_on_hand', 15, 6).notNullable().defaultTo(0);
        table.decimal('quantity_reserved', 15, 6).notNullable().defaultTo(0);
        table.decimal('quantity_available', 15, 6).notNullable().defaultTo(0);

        table
            .foreign('organization_id')
            .references('id')
            .inTable('organizations')
            .onDelete('CASCADE');

        table.foreign('item_id').references('id').inTable('items').onDelete('RESTRICT');

        table
            .foreign('location_id')
            .references('id')
            .inTable('inventory_locations')
            .onDelete('RESTRICT');

        table.unique(['organization_id', 'item_id', 'location_id']);
        table.index(['organization_id', 'item_id']);
        table.index(['organization_id', 'location_id']);
        table.timestamps(true, true);
    });

    // ──────────────────────────────────────
    // 9. Current batch balances
    // ──────────────────────────────────────
    await knex.schema.createTable('inventory_batch_balances', (table) => {
        table.increments('id').primary();
        table.integer('organization_id').unsigned().notNullable();
        table.integer('item_id').unsigned().notNullable();
        table.integer('location_id').unsigned().notNullable();
        table.integer('batch_id').unsigned().notNullable();

        table.decimal('quantity_on_hand', 15, 6).notNullable().defaultTo(0);

        table
            .foreign('organization_id')
            .references('id')
            .inTable('organizations')
            .onDelete('CASCADE');

        table.foreign('item_id').references('id').inTable('items').onDelete('RESTRICT');

        table
            .foreign('location_id')
            .references('id')
            .inTable('inventory_locations')
            .onDelete('RESTRICT');

        table.foreign('batch_id').references('id').inTable('inventory_batches').onDelete('RESTRICT');

        table.unique(['organization_id', 'item_id', 'location_id', 'batch_id']);
        table.index(['organization_id', 'item_id', 'location_id']);
        table.index(['batch_id']);
        table.timestamps(true, true);
    });

    // ──────────────────────────────────────
    // 10. Helpful DB-level CHECK constraints
    // PostgreSQL raw SQL because knex lacks neat portable helpers for these.
    // ──────────────────────────────────────

    // Non-negative entered quantities
    await knex.raw(`
    ALTER TABLE inventory_transaction_lines
    ADD CONSTRAINT inventory_transaction_lines_quantity_positive_chk
    CHECK (quantity > 0)
  `);

    await knex.raw(`
    ALTER TABLE inventory_transaction_lines
    ADD CONSTRAINT inventory_transaction_lines_base_quantity_positive_chk
    CHECK (base_quantity > 0)
  `);

    await knex.raw(`
    ALTER TABLE inventory_transaction_line_batches
    ADD CONSTRAINT inventory_transaction_line_batches_quantity_positive_chk
    CHECK (quantity > 0)
  `);

    // Balance fields non-negative
    await knex.raw(`
    ALTER TABLE inventory_balances
    ADD CONSTRAINT inventory_balances_qoh_non_negative_chk
    CHECK (quantity_on_hand >= 0)
  `);

    await knex.raw(`
    ALTER TABLE inventory_balances
    ADD CONSTRAINT inventory_balances_qreserved_non_negative_chk
    CHECK (quantity_reserved >= 0)
  `);

    await knex.raw(`
    ALTER TABLE inventory_balances
    ADD CONSTRAINT inventory_balances_qavailable_non_negative_chk
    CHECK (quantity_available >= 0)
  `);

    await knex.raw(`
    ALTER TABLE inventory_batch_balances
    ADD CONSTRAINT inventory_batch_balances_qoh_non_negative_chk
    CHECK (quantity_on_hand >= 0)
  `);

    // Transaction header consistency:
    // - TRANSFER_OUT / TRANSFER_IN should usually have source/destination in service logic,
    //   but we keep DB checks light to avoid blocking valid edge cases.
    // - CANCELLED can optionally have voided_at.
    // - POSTED can optionally have posted_at.
    //
    // Keep strict rules mostly in service layer, not hard DB, to preserve flexibility.

    // Optional sanity: source and destination should not be same when both present
    await knex.raw(`
    ALTER TABLE inventory_transactions
    ADD CONSTRAINT inventory_transactions_source_dest_diff_chk
    CHECK (
      source_location_id IS NULL
      OR destination_location_id IS NULL
      OR source_location_id <> destination_location_id
    )
  `);
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    // Drop explicit CHECK constraints first
    await knex.raw(`
    ALTER TABLE inventory_transactions
    DROP CONSTRAINT IF EXISTS inventory_transactions_source_dest_diff_chk
  `);

    await knex.raw(`
    ALTER TABLE inventory_batch_balances
    DROP CONSTRAINT IF EXISTS inventory_batch_balances_qoh_non_negative_chk
  `);

    await knex.raw(`
    ALTER TABLE inventory_balances
    DROP CONSTRAINT IF EXISTS inventory_balances_qavailable_non_negative_chk
  `);

    await knex.raw(`
    ALTER TABLE inventory_balances
    DROP CONSTRAINT IF EXISTS inventory_balances_qreserved_non_negative_chk
  `);

    await knex.raw(`
    ALTER TABLE inventory_balances
    DROP CONSTRAINT IF EXISTS inventory_balances_qoh_non_negative_chk
  `);

    await knex.raw(`
    ALTER TABLE inventory_transaction_line_batches
    DROP CONSTRAINT IF EXISTS inventory_transaction_line_batches_quantity_positive_chk
  `);

    await knex.raw(`
    ALTER TABLE inventory_transaction_lines
    DROP CONSTRAINT IF EXISTS inventory_transaction_lines_base_quantity_positive_chk
  `);

    await knex.raw(`
    ALTER TABLE inventory_transaction_lines
    DROP CONSTRAINT IF EXISTS inventory_transaction_lines_quantity_positive_chk
  `);

    // Drop tables in dependency order
    await knex.schema.dropTableIfExists('inventory_batch_balances');
    await knex.schema.dropTableIfExists('inventory_balances');
    await knex.schema.dropTableIfExists('inventory_transaction_line_serials');
    await knex.schema.dropTableIfExists('inventory_serials');
    await knex.schema.dropTableIfExists('inventory_transaction_line_batches');
    await knex.schema.dropTableIfExists('inventory_batches');
    await knex.schema.dropTableIfExists('inventory_transaction_lines');
    await knex.schema.dropTableIfExists('inventory_transactions');
    await knex.schema.dropTableIfExists('inventory_locations');

    // Remove item columns
    await knex.schema.alterTable('items', (table) => {
        table.dropColumn('inventory_tracking');
        table.dropColumn('track_expiry');
        table.dropColumn('allow_negative_stock');
    });

    // Drop enums
    await knex.raw(`
    DO $$ BEGIN
      DROP TYPE IF EXISTS inventory_serial_status_enum;
    EXCEPTION
      WHEN undefined_object THEN null;
    END $$;
  `);

    await knex.raw(`
    DO $$ BEGIN
      DROP TYPE IF EXISTS inventory_direction_enum;
    EXCEPTION
      WHEN undefined_object THEN null;
    END $$;
  `);

    await knex.raw(`
    DO $$ BEGIN
      DROP TYPE IF EXISTS inventory_posting_status_enum;
    EXCEPTION
      WHEN undefined_object THEN null;
    END $$;
  `);

    await knex.raw(`
    DO $$ BEGIN
      DROP TYPE IF EXISTS inventory_transaction_type_enum;
    EXCEPTION
      WHEN undefined_object THEN null;
    END $$;
  `);

    await knex.raw(`
    DO $$ BEGIN
      DROP TYPE IF EXISTS inventory_location_type_enum;
    EXCEPTION
      WHEN undefined_object THEN null;
    END $$;
  `);

    await knex.raw(`
    DO $$ BEGIN
      DROP TYPE IF EXISTS item_inventory_tracking_enum;
    EXCEPTION
      WHEN undefined_object THEN null;
    END $$;
  `);
}