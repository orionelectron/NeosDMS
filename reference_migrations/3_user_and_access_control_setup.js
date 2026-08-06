export function up(knex) {
    return knex.schema
       

        // 2. Roles
        .createTable('roles', (table) => {
            table.increments('id').primary();
            table.integer('organization_id').unsigned().nullable();
            table.integer('branch_id').unsigned().nullable(); // NULL means "Org-wide Role"
            table.string('name').notNullable();
            table.boolean('is_system').defaultTo(false);
            table.timestamps(true, true);

            table.foreign('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
            table.foreign('branch_id').references('id').inTable('branches').onDelete('CASCADE');
        })

        // 3. Permissions & Mapping (Same as before)
        .createTable('permissions', (table) => {
            table.increments('id').primary();
            table.integer('module_id').unsigned().notNullable();
            table.text('description').nullable();
            table.string('code').notNullable().unique(); 
            table.timestamps(true, true);
        })
        .createTable('role_permission_mappings', (table) => {
            table.increments('id').primary();
            table.integer('organization_id').unsigned().nullable();
            table.integer('role_id').unsigned().notNullable();
            table.integer('permission_id').unsigned().notNullable();
            table.unique(['role_id', 'permission_id']);
            table.foreign('role_id').references('id').inTable('roles').onDelete('CASCADE');
            table.foreign('permission_id').references('id').inTable('permissions').onDelete('CASCADE');
            table.foreign('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
        })

        // 4. Users (Assigned to a specific Branch)
        .createTable('users', (table) => {
            table.increments('id').primary();
            table.integer('organization_id').unsigned().notNullable();
            table.integer('branch_id').unsigned().notNullable(); // Every user must be at a branch
            table.integer('role_id').unsigned().nullable();
            
            table.string('full_name').notNullable();
            table.string('username').nullable();
            table.string('email').notNullable().unique();
            table.string('password').notNullable();
            table.boolean('is_owner').defaultTo(false); 
            table.boolean('is_active').defaultTo(true); // New field to track active/inactive status

            table.foreign('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
            table.foreign('branch_id').references('id').inTable('branches').onDelete('RESTRICT');
            table.foreign('role_id').references('id').inTable('roles').onDelete('SET NULL');
            table.timestamps(true, true);
        })

        // 5. Audit Log (Track WHICH branch the action happened in)
        .createTable('audit_logs', (table) => {
            table.increments('id').primary();
            table.integer('organization_id').unsigned().notNullable();
            table.integer('branch_id').unsigned().nullable(); 
            table.integer('user_id').unsigned().nullable();
            table.string('action').notNullable();
            table.string('entity_type').notNullable();
            table.integer('entity_id').nullable();
            table.jsonb('old_data').nullable();
            table.jsonb('new_data').nullable();
            table.timestamp('created_at').defaultTo(knex.fn.now());

            table.foreign('organization_id').references('id').inTable('organizations').onDelete('CASCADE');
            table.foreign('branch_id').references('id').inTable('branches').onDelete('SET NULL');
            table.index(['organization_id', 'branch_id']);
        });
}


export function down(knex) {
    return knex.schema
        .dropTableIfExists('audit_logs')
        .dropTableIfExists('users')
        .dropTableIfExists('role_permission_mappings')
        .dropTableIfExists('permissions')
        .dropTableIfExists('roles');
}