// banking.js
export function up(knex) {
    return knex.schema
        .createTable('cheques', (table) => {
            table.increments('id').primary();
            table.integer('organization_id').unsigned().notNullable();
            table.integer('party_id').unsigned().notNullable(); // Who gave/received it?

            // Is this a cheque we RECEIVED (In) or ISSUED (Out)?
            table.string('direction').notNullable(); // 'IN' or 'OUT'

            table.string('cheque_number').notNullable();
            table.string('bank_name').notNullable(); // "Nabil Bank", "Global IME"
            table.date('cheque_date').notNullable(); // The date WRITTEN on the cheque (Maturity)
            table.decimal('amount', 15, 2).notNullable();

            // The Lifecycle
            // ON_HAND: In your drawer (Safe)
            // DEPOSITED: Sent to bank, waiting for clearing
            // CLEARED: Money is in account
            // BOUNCED: Dishonored (Create Debit Note automatically?)
            // RETURNED: Given back to party
            table.string('status').defaultTo('ON_HAND');

            table.integer('payment_id').unsigned().nullable(); // Link to the accounting entry
            table.integer('deposit_account_id').unsigned().nullable(); // Which bank did we drop it in?

            table.string('image_url').nullable(); // Photo of cheque (Very useful)

            table.foreign('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
            table.foreign('payment_id').references('id').inTable('payments').onDelete('SET NULL');
            table.foreign('party_id').references('id').inTable('parties').onDelete('RESTRICT');

            table.index(['organization_id', 'status', 'cheque_date']); // "Show me cheques maturing this week"
            table.timestamps(true, true);
        })


        .createTable('landed_cost_vouchers', (table) => {
            table.increments('id').primary();
            table.integer('organization_id').unsigned().notNullable();

            table.date('date').notNullable();
            table.string('voucher_number').notNullable();

            // Which Purchase Bills are we adding cost TO? (The Goods)
            // In simple systems, 1 voucher = 1 bill. In complex, 1 voucher = many bills.
            // Let's store the total amount we are distributing.
            table.decimal('total_amount', 15, 2).notNullable();

            table.foreign('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
            table.timestamps(true, true);
        })

        // Which Expense Bills (Freight/Customs) are being allocated?
        .createTable('landed_cost_expenses', (table) => {
            table.increments('id').primary();
            table.integer('landed_cost_id').unsigned().notNullable();

            // Link to the Expense/Bill entered in the system
            table.integer('expense_id').unsigned().nullable();
            table.integer('purchase_bill_id').unsigned().nullable(); // If customs was entered as a Bill

            table.decimal('amount', 15, 2).notNullable(); // How much of this bill to allocate?

            // Allocation Method: 'VALUE' (Price based) or 'QUANTITY' (Weight based)
            table.string('allocation_method').defaultTo('VALUE');

            table.foreign('landed_cost_id').references('id').inTable('landed_cost_vouchers').onDelete('CASCADE');
        })

        // The Result: How much cost was added to specific items?
        .createTable('landed_cost_item_adjustments', (table) => {
            table.increments('id').primary();
            table.integer('landed_cost_id').unsigned().notNullable();
            table.integer('purchase_bill_line_id').unsigned().notNullable(); // The specific item line

            table.decimal('added_cost', 15, 4).notNullable(); // The extra cost added per unit

            table.foreign('landed_cost_id').references('id').inTable('landed_cost_vouchers').onDelete('CASCADE');
            table.foreign('purchase_bill_line_id').references('id').inTable('purchase_bill_lines').onDelete('CASCADE');
        })

        .createTable('quotations', (table) => {
            table.increments('id').primary();
            table.integer('organization_id').unsigned().notNullable();
            table.integer('branch_id').unsigned().notNullable();
            table.integer('party_id').unsigned().notNullable(); // Lead or Customer
            table.integer('fiscal_year_id').unsigned().notNullable();

            table.string('quotation_number').notNullable(); // EST-1001
            table.date('date').notNullable();
            table.date('valid_until').notNullable(); // "Valid for 15 days"

            table.decimal('subtotal', 15, 2).defaultTo(0);
            table.decimal('tax_total', 15, 2).defaultTo(0);
            table.decimal('grand_total', 15, 2).notNullable();

            // DRAFT -> SENT -> ACCEPTED -> REJECTED -> CONVERTED
            table.string('status').defaultTo('DRAFT');

            table.text('terms_conditions').nullable();
            table.text('notes').nullable();

            table.foreign('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
            table.foreign('party_id').references('id').inTable('parties').onDelete('RESTRICT');
            table.unique(['organization_id', 'quotation_number']);
            table.timestamps(true, true);
        })

        .createTable('quotation_lines', (table) => {
            table.increments('id').primary();
            table.integer('quotation_id').unsigned().notNullable();
            table.integer('item_id').unsigned().nullable(); // References items (variants are items with parent_item_id set)
            table.string('description').nullable();
            table.decimal('quantity', 15, 4).notNullable();
            table.decimal('rate', 15, 4).notNullable();
            table.decimal('total', 15, 2).notNullable();

            table.foreign('quotation_id').references('id').inTable('quotations').onDelete('CASCADE');
            table.foreign('item_id').references('id').inTable('items').onDelete('SET NULL');
        })

        .createTable('purchase_orders', (table) => {
            table.increments('id').primary();
            table.integer('organization_id').unsigned().notNullable();
            table.integer('branch_id').unsigned().notNullable();
            table.integer('party_id').unsigned().notNullable(); // Vendor
            table.integer('fiscal_year_id').unsigned().notNullable();

            table.string('po_number').notNullable();
            table.date('order_date').notNullable();
            table.date('expected_delivery_date').nullable();

            table.decimal('total_amount', 15, 2).notNullable();

            // OPEN -> PARTIAL -> CLOSED -> CANCELLED
            table.string('status').defaultTo('OPEN');

            table.foreign('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
            table.unique(['organization_id', 'po_number']);
            table.timestamps(true, true);
        })

        .createTable('purchase_order_lines', (table) => {
            table.increments('id').primary();
            table.integer('purchase_order_id').unsigned().notNullable();
            table.integer('item_id').unsigned().notNullable(); // References items (variants are items with parent_item_id set)

            table.decimal('quantity_ordered', 15, 4).notNullable();

            // CRITICAL: Track the lifecycle
            table.decimal('quantity_received', 15, 4).defaultTo(0); // Via GRN
            table.decimal('quantity_billed', 15, 4).defaultTo(0); // Via Bill

            table.decimal('rate', 15, 4).notNullable(); // Agreed Price

            table.foreign('purchase_order_id').references('id').inTable('purchase_orders').onDelete('CASCADE');
            table.foreign('item_id').references('id').inTable('items').onDelete('CASCADE');
        })

        .createTable('goods_received_notes', (table) => {
            table.increments('id').primary();
            table.integer('organization_id').unsigned().notNullable();
            table.integer('branch_id').unsigned().notNullable();
            table.integer('warehouse_id').unsigned().notNullable(); // Which godown?
            table.integer('purchase_order_id').unsigned().nullable(); // Link to PO

            table.string('grn_number').notNullable();
            table.string('vendor_challan_number').nullable(); // Their delivery note #
            table.date('received_date').notNullable();

            table.text('remarks').nullable();

            table.foreign('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
            table.foreign('purchase_order_id').references('id').inTable('purchase_orders').onDelete('SET NULL');
            table.unique(['organization_id', 'grn_number']);
            table.timestamps(true, true);
        })

        .createTable('grn_lines', (table) => {
            table.increments('id').primary();
            table.integer('grn_id').unsigned().notNullable();
            table.integer('purchase_order_line_id').unsigned().nullable();
            table.integer('item_id').unsigned().notNullable(); // References items (variants are items with parent_item_id set)

            table.decimal('quantity_received', 15, 4).notNullable();
            table.decimal('quantity_accepted', 15, 4).notNullable(); // Used for stock add
            table.decimal('quantity_rejected', 15, 4).defaultTo(0);

            table.string('batch_number').nullable();
            table.date('expiry_date').nullable();

            table.foreign('grn_id').references('id').inTable('goods_received_notes').onDelete('CASCADE');
            table.foreign('item_id').references('id').inTable('items').onDelete('CASCADE');
        });
}


export function down(knex) {
    return knex.schema
        .dropTable('grn_lines')
        .dropTable('goods_received_notes')
        .dropTable('purchase_order_lines')
        .dropTable('purchase_orders')
        .dropTable('quotation_lines')
        .dropTable('quotations')
        .dropTable('landed_cost_item_adjustments')
        .dropTable('landed_cost_expenses')
        .dropTable('landed_cost_vouchers')
        .dropTable('cheques');
}   