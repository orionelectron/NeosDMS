import { MigrationInterface, QueryRunner } from 'typeorm';

export class Inventory1786500000000 implements MigrationInterface {
  name = 'Inventory1786500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // inventory_locations (decision 36): org-scoped storage places (godown /
    // van / shop / warehouse). One default receive location per org. Soft
    // delete only — balances/transactions keep FK references.
    await queryRunner.query(
      `CREATE TABLE "inventory_locations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "branch_id" uuid, "name" character varying NOT NULL, "code" character varying NOT NULL, "location_type" character varying NOT NULL, "address" character varying, "notes" text, "is_default" boolean NOT NULL DEFAULT false, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_inventory_locations" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_inventory_locations_org_code" ON "inventory_locations"  ("organization_id", "code") WHERE "deletedAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_inventory_locations_org_default" ON "inventory_locations"  ("organization_id") WHERE "is_default" = true AND "deletedAt" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_locations" ADD CONSTRAINT "chk_inventory_locations_type" CHECK (location_type IN ('GODOWN','VAN','SHOP','WAREHOUSE'))`,
    );

    // inventory_transactions: a posted stock movement. For transfers the same
    // transaction covers source (location_id) and destination (to_location_id).
    await queryRunner.query(
      `CREATE TABLE "inventory_transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "location_id" uuid NOT NULL, "to_location_id" uuid, "transaction_number" character varying NOT NULL, "transaction_type" character varying NOT NULL, "reference_type" character varying, "reference_id" uuid, "status" character varying NOT NULL DEFAULT 'POSTED', "bs_date" character varying NOT NULL, "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "notes" text, CONSTRAINT "PK_inventory_transactions" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_inventory_txns_org_location" ON "inventory_transactions"  ("organization_id", "location_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_inventory_txns_org_type" ON "inventory_transactions"  ("organization_id", "transaction_type") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_inventory_txns_org_type_number" ON "inventory_transactions"  ("organization_id", "transaction_type", "transaction_number") `,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transactions" ADD CONSTRAINT "chk_inventory_txns_type" CHECK (transaction_type IN ('opening_stock','stock_adjustment','stock_transfer'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transactions" ADD CONSTRAINT "chk_inventory_txns_status" CHECK (status IN ('POSTED'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transactions" ADD CONSTRAINT "chk_inventory_txns_transfer" CHECK ((transaction_type <> 'stock_transfer') OR (to_location_id IS NOT NULL AND to_location_id <> location_id))`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transactions" ADD CONSTRAINT "chk_inventory_txns_no_target" CHECK ((transaction_type = 'stock_transfer') OR (to_location_id IS NULL))`,
    );

    // inventory_transaction_lines: quantity is always positive in the stated
    // uom. `direction` carries the IN/OUT sign for adjustments; opening_stock
    // lines are IN, stock_transfer lines are IN and apply as +dest / -source.
    await queryRunner.query(
      `CREATE TABLE "inventory_transaction_lines" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "transaction_id" uuid NOT NULL, "item_id" uuid NOT NULL, "uom_id" uuid NOT NULL, "direction" character varying NOT NULL, "quantity" numeric(15,3) NOT NULL, "unit_cost" numeric(15,2) NOT NULL DEFAULT 0, CONSTRAINT "PK_inventory_transaction_lines" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_inventory_lines_txn" ON "inventory_transaction_lines"  ("transaction_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_inventory_lines_org_item" ON "inventory_transaction_lines"  ("organization_id", "item_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transaction_lines" ADD CONSTRAINT "chk_inventory_lines_qty" CHECK (quantity > 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transaction_lines" ADD CONSTRAINT "chk_inventory_lines_direction" CHECK (direction IN ('IN','OUT'))`,
    );

    // inventory_balances: materialized on-hand quantity per org × location ×
    // item in the item's base uom, locked with SELECT ... FOR UPDATE while
    // posting. The negative-stock rule lives in the service (items have
    // allow_negative_stock), so no CHECK here.
    await queryRunner.query(
      `CREATE TABLE "inventory_balances" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "location_id" uuid NOT NULL, "item_id" uuid NOT NULL, "quantity" numeric(15,3) NOT NULL DEFAULT 0, CONSTRAINT "PK_inventory_balances" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_inventory_balances_org_loc_item" ON "inventory_balances"  ("organization_id", "location_id", "item_id") WHERE "deletedAt" IS NULL`,
    );

    // Foreign keys
    await queryRunner.query(
      `ALTER TABLE "inventory_locations" ADD CONSTRAINT "FK_inventory_locations_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_locations" ADD CONSTRAINT "FK_inventory_locations_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "inventory_transactions" ADD CONSTRAINT "FK_inventory_txns_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transactions" ADD CONSTRAINT "FK_inventory_txns_location" FOREIGN KEY ("location_id") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transactions" ADD CONSTRAINT "FK_inventory_txns_to_location" FOREIGN KEY ("to_location_id") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "inventory_transaction_lines" ADD CONSTRAINT "FK_inventory_lines_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transaction_lines" ADD CONSTRAINT "FK_inventory_lines_txn" FOREIGN KEY ("transaction_id") REFERENCES "inventory_transactions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transaction_lines" ADD CONSTRAINT "FK_inventory_lines_item" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transaction_lines" ADD CONSTRAINT "FK_inventory_lines_uom" FOREIGN KEY ("uom_id") REFERENCES "uoms"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "inventory_balances" ADD CONSTRAINT "FK_inventory_balances_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_balances" ADD CONSTRAINT "FK_inventory_balances_location" FOREIGN KEY ("location_id") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_balances" ADD CONSTRAINT "FK_inventory_balances_item" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "inventory_balances" DROP CONSTRAINT "FK_inventory_balances_item"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_balances" DROP CONSTRAINT "FK_inventory_balances_location"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_balances" DROP CONSTRAINT "FK_inventory_balances_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transaction_lines" DROP CONSTRAINT "chk_inventory_lines_direction"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transaction_lines" DROP CONSTRAINT "chk_inventory_lines_qty"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transaction_lines" DROP CONSTRAINT "FK_inventory_lines_item"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transaction_lines" DROP CONSTRAINT "FK_inventory_lines_txn"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transaction_lines" DROP CONSTRAINT "FK_inventory_lines_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transactions" DROP CONSTRAINT "FK_inventory_txns_to_location"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transactions" DROP CONSTRAINT "FK_inventory_txns_location"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transactions" DROP CONSTRAINT "FK_inventory_txns_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_locations" DROP CONSTRAINT "FK_inventory_locations_branch"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_locations" DROP CONSTRAINT "FK_inventory_locations_org"`,
    );
    await queryRunner.query(`DROP TABLE "inventory_balances"`);
    await queryRunner.query(`DROP TABLE "inventory_transaction_lines"`);
    await queryRunner.query(`DROP TABLE "inventory_transactions"`);
    await queryRunner.query(`DROP TABLE "inventory_locations"`);
  }
}
