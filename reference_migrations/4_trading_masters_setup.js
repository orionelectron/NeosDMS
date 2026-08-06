/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema
        // ──────────────────────────────────────
        // 1. Item Categories (Hierarchical)
        // ──────────────────────────────────────
        .createTable('item_categories', (table) => {
            table.increments('id').primary();
            table.integer('organization_id').unsigned().notNullable();
            table.integer('parent_category_id').unsigned().nullable();
            table.string('name').notNullable();
            table.string('code').nullable();

            table.foreign('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
            table.foreign('parent_category_id').references('id').inTable('item_categories').onDelete('SET NULL');
            table.unique(['organization_id', 'code']);
            table.index('parent_category_id');
            table.timestamps(true, true);
        })

        // ──────────────────────────────────────
        // 2. Units of Measure
        // ──────────────────────────────────────
        .createTable('uoms', (table) => {
            table.increments('id').primary();
            table.integer('organization_id').unsigned().notNullable();
            table.string('name').notNullable();
            table.string('short_name').notNullable();

            table.foreign('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
            table.unique(['organization_id', 'short_name']);
            table.timestamps(true, true);
        })

        // ──────────────────────────────────────
        // 3. Brands
        // ──────────────────────────────────────
        .createTable('brands', (table) => {
            table.increments('id').primary();
            table.integer('organization_id').unsigned().notNullable();
            table.string('name').notNullable();

            table.foreign('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
            table.unique(['organization_id', 'name']);
            table.timestamps(true, true);
        })

        // ──────────────────────────────────────
        // 4. Variant Attributes (master data — powers UI picker)
        //    Example: { name: "Color", values: ["Red","Blue","Green"] }
        // ──────────────────────────────────────
        .createTable('variant_attributes', (table) => {
            table.increments('id').primary();
            table.integer('organization_id').unsigned().notNullable();
            table.string('name').notNullable();
            table.jsonb('values').notNullable().defaultTo('[]');

            table.foreign('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
            table.unique(['organization_id', 'name']);
            table.timestamps(true, true);
        })

        // ──────────────────────────────────────
        // 5. Items (single table — standalone, template, or variant)
        //
        //    STANDALONE:  parent_item_id=NULL, has_variants=false  → sellable
        //    TEMPLATE:    parent_item_id=NULL, has_variants=true   → NOT sellable
        //    VARIANT:     parent_item_id=set,  has_variants=false  → sellable
        //
        //    All transactions (invoices, inventory, POs) reference
        //    items WHERE has_variants=false. Always. No exceptions.
        // ──────────────────────────────────────
        .createTable('items', (table) => {
            table.increments('id').primary();
            table.integer('organization_id').unsigned().notNullable();

            // Self-reference: NULL = standalone or template, set = variant child
            table.integer('parent_item_id').unsigned().nullable();

            // ── Identity ──
            table.string('name').notNullable();
            table.string('code').nullable();
            table.string('sku').nullable();
            table.string('barcode').nullable();
            table.text('description').nullable();

            // ── Classification (denormalized to variants for zero-join queries) ──
            table.enu('type', ['GOODS', 'SERVICE', 'RAW', 'ASSET']).defaultTo('GOODS').notNullable();
            table.integer('category_id').unsigned().nullable();
            table.integer('brand_id').unsigned().nullable();
            table.integer('base_uom_id').unsigned().notNullable();
            table.string('hsn_code').nullable();
            table.enu('valuation_method', ['FIFO', 'WEIGHTED_AVERAGE']).defaultTo('FIFO').notNullable();
            table.integer('tax_code_id').unsigned().nullable();

            // ── Variant Data ──
            // true = this is a template (groups variants, not usable in transactions)
            table.boolean('has_variants').defaultTo(false);
            // Attribute snapshot for variant children, NULL for standalone/template
            // Example: [{"name":"Color","value":"Red"},{"name":"Size","value":"S"}]
            table.jsonb('attributes').nullable();

            // ── Pricing (meaningful on sellable items, ignored on templates) ──
            table.decimal('mrp', 15, 2).defaultTo(0);
            table.decimal('sale_price', 15, 2).defaultTo(0);
            table.decimal('standard_cost', 15, 2).defaultTo(0);
            table.integer('reorder_level').defaultTo(0);

            // ── Flags ──

            table.enu('inventory_tracking', ['NONE', 'QUANTITY', 'BATCH', 'SERIAL'])
                .notNullable()
                .defaultTo('QUANTITY');

            table.boolean('track_expiry').notNullable().defaultTo(false);
            table.boolean('allow_negative_stock').notNullable().defaultTo(false);
            table.boolean('is_active').defaultTo(true);

            // ── Account Links ──
            table.integer('sales_account_id').unsigned().nullable();
            table.integer('purchase_account_id').unsigned().nullable();
            table.integer('sales_return_account_id').unsigned().nullable();
            table.integer('purchase_return_account_id').unsigned().nullable();

            // ── Constraints ──
            table.foreign('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
            table.foreign('parent_item_id').references('id').inTable('items').onDelete('CASCADE');
            table.foreign('category_id').references('id').inTable('item_categories').onDelete('SET NULL');
            table.foreign('brand_id').references('id').inTable('brands').onDelete('SET NULL');
            table.foreign('base_uom_id').references('id').inTable('uoms').onDelete('RESTRICT');

            table.unique(['organization_id', 'sku']);
            table.unique(['organization_id', 'code']);
            table.index('parent_item_id');
            table.index('barcode');
            table.timestamps(true, true);
        })

        // ──────────────────────────────────────
        // 6. UOM Conversions
        // ──────────────────────────────────────
        .createTable('uom_conversions', (table) => {
            table.increments('id').primary();
            table.integer('organization_id').unsigned().notNullable();
            table.integer('item_id').unsigned().nullable();
            table.integer('from_uom_id').unsigned().notNullable();
            table.integer('to_uom_id').unsigned().notNullable();
            table.decimal('conversion_factor', 15, 6).notNullable();

            table.foreign('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
            table.foreign('item_id').references('id').inTable('items').onDelete('RESTRICT');
            table.foreign('from_uom_id').references('id').inTable('uoms').onDelete('RESTRICT');
            table.foreign('to_uom_id').references('id').inTable('uoms').onDelete('RESTRICT');

            table.unique(['organization_id', 'item_id', 'from_uom_id', 'to_uom_id']);
            table.timestamps(true, true);
        });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema
        .dropTableIfExists('uom_conversions')
        .dropTableIfExists('items')
        .dropTableIfExists('variant_attributes')
        .dropTableIfExists('brands')
        .dropTableIfExists('uoms')
        .dropTableIfExists('item_categories');
}