import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * DMS Phase B (decision 46): dispatch & delivery — the orchestration layer
 * between sales and delivery.
 *
 * A `dispatches` row is one delivery run (vehicle + driver) carrying several
 * allocated orders as `dispatch_stops` (one stop per order). Dispatch itself
 * never moves stock and never posts a journal: the only stock event is the
 * sales-invoice POST at `depart`, which stamps `sales_invoices.dispatch_id`;
 * failed/partial stops later auto-draft `sales_return` credit notes stamped
 * `sales_returns.dispatch_stop_id`.
 *
 * `dispatch_stop_lines` snapshot the allocated (order line) quantity in both
 * the sell and base uom at allocation time and later hold the delivery
 * actuals (`delivered_quantity`/`returned_quantity` in both uoms). A partial
 * unique index on `(organization_id, order_id)` WHERE `deletedAt IS NULL`
 * guarantees an order can never sit on two active runs — cancelling a
 * pre-departure dispatch soft-deletes its pending stops to release orders.
 */
export class Dispatch1787600000000 implements MigrationInterface {
  name = 'Dispatch1787600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── vehicles ────────────────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TABLE "vehicles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "name" character varying NOT NULL, "registration_number" character varying NOT NULL, "vehicle_type" character varying NOT NULL DEFAULT 'van', "capacity_weight_kg" numeric(15,3), "capacity_volume_cbm" numeric(15,3), "is_active" boolean NOT NULL DEFAULT true, "current_driver_id" uuid, CONSTRAINT "PK_vehicles" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_vehicles_org_reg" ON "vehicles"  ("organization_id", "registration_number") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_vehicles_org_active" ON "vehicles"  ("organization_id", "is_active") `,
    );
    await queryRunner.query(
      `ALTER TABLE "vehicles" ADD CONSTRAINT "chk_vehicles_type" CHECK (vehicle_type IN ('van','truck','pickup','motorbike'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "vehicles" ADD CONSTRAINT "chk_vehicles_capacity" CHECK (capacity_weight_kg >= 0 AND capacity_volume_cbm >= 0)`,
    );

    // ── dispatches ──────────────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TABLE "dispatches" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "branch_id" uuid, "dispatch_number" character varying NOT NULL, "vehicle_id" uuid, "driver_id" uuid, "route_id" uuid, "source_inventory_location_id" uuid, "status" character varying NOT NULL DEFAULT 'ALLOCATED', "planned_departure_at" TIMESTAMP WITH TIME ZONE, "departed_at" TIMESTAMP WITH TIME ZONE, "completed_at" TIMESTAMP WITH TIME ZONE, "notes" text, CONSTRAINT "PK_dispatches" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_dispatches_org_number" ON "dispatches"  ("organization_id", "dispatch_number") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_dispatches_org_status" ON "dispatches"  ("organization_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_dispatches_org_driver" ON "dispatches"  ("organization_id", "driver_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_dispatches_org_vehicle" ON "dispatches"  ("organization_id", "vehicle_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "dispatches" ADD CONSTRAINT "chk_dispatches_status" CHECK (status IN ('ALLOCATED','LOADED','IN_TRANSIT','DELIVERED','CANCELLED'))`,
    );

    // ── dispatch_stops ──────────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TABLE "dispatch_stops" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "dispatch_id" uuid NOT NULL, "order_id" uuid NOT NULL, "stop_sequence" integer NOT NULL, "status" character varying NOT NULL DEFAULT 'PENDING', "delivered_at" TIMESTAMP WITH TIME ZONE, "failure_reason" character varying, "pod_receiver_name" character varying, "pod_signature_photo_key" character varying, "pod_gps_latitude" numeric(10,6), "pod_gps_longitude" numeric(10,6), "pod_notes" text, "invoice_id" uuid, "delivery_event_id" character varying, CONSTRAINT "PK_dispatch_stops" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_dispatch_stops_dispatch_seq" ON "dispatch_stops"  ("dispatch_id", "stop_sequence") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_dispatch_stops_org_order_active" ON "dispatch_stops"  ("organization_id", "order_id") WHERE "deletedAt" IS NULL `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_dispatch_stops_org_event" ON "dispatch_stops"  ("organization_id", "delivery_event_id") WHERE delivery_event_id IS NOT NULL `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_dispatch_stops_org_status" ON "dispatch_stops"  ("organization_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_dispatch_stops_org_order" ON "dispatch_stops"  ("organization_id", "order_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "dispatch_stops" ADD CONSTRAINT "chk_dispatch_stops_status" CHECK (status IN ('PENDING','DELIVERED','PARTIAL','FAILED'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispatch_stops" ADD CONSTRAINT "chk_dispatch_stops_reason" CHECK (failure_reason IS NULL OR failure_reason IN ('CUSTOMER_UNAVAILABLE','ROAD_BLOCKED','REJECTED','WRONG_ADDRESS','DAMAGED'))`,
    );

    // ── dispatch_stop_lines ─────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TABLE "dispatch_stop_lines" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "stop_id" uuid NOT NULL, "order_line_id" uuid NOT NULL, "item_id" uuid NOT NULL, "uom_id" uuid NOT NULL, "allocated_quantity" numeric(15,3) NOT NULL, "allocated_base_quantity" numeric(15,3) NOT NULL, "delivered_quantity" numeric(15,3) NOT NULL DEFAULT 0, "returned_quantity" numeric(15,3) NOT NULL DEFAULT 0, "delivered_base_quantity" numeric(15,3) NOT NULL DEFAULT 0, "returned_base_quantity" numeric(15,3) NOT NULL DEFAULT 0, CONSTRAINT "PK_dispatch_stop_lines" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_dispatch_stop_lines_stop_line" ON "dispatch_stop_lines"  ("stop_id", "order_line_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_dispatch_stop_lines_org_item" ON "dispatch_stop_lines"  ("organization_id", "item_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_dispatch_stop_lines_order_line" ON "dispatch_stop_lines"  ("order_line_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "dispatch_stop_lines" ADD CONSTRAINT "chk_dispatch_stop_lines_allocated" CHECK (allocated_quantity >= 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispatch_stop_lines" ADD CONSTRAINT "chk_dispatch_stop_lines_delivered" CHECK (delivered_quantity >= 0 AND delivered_quantity <= allocated_quantity)`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispatch_stop_lines" ADD CONSTRAINT "chk_dispatch_stop_lines_returned" CHECK (returned_quantity >= 0 AND returned_quantity <= allocated_quantity)`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispatch_stop_lines" ADD CONSTRAINT "chk_dispatch_stop_lines_total" CHECK (delivered_quantity + returned_quantity <= allocated_quantity)`,
    );

    // ── sales-invoice dispatch stamp ────────────────────────────────────────
    await queryRunner.query(
      `ALTER TABLE "sales_invoices" ADD "dispatch_id" uuid`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sales_invoices_org_dispatch" ON "sales_invoices"  ("organization_id", "dispatch_id") `,
    );

    // ── sales-return dispatch-stop stamp ────────────────────────────────────
    await queryRunner.query(
      `ALTER TABLE "sales_returns" ADD "dispatch_stop_id" uuid`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_sales_returns_dispatch_stop" ON "sales_returns"  ("dispatch_stop_id") WHERE dispatch_stop_id IS NOT NULL `,
    );

    // ── Foreign keys ────────────────────────────────────────────────────────
    await queryRunner.query(
      `ALTER TABLE "vehicles" ADD CONSTRAINT "FK_vehicles_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "vehicles" ADD CONSTRAINT "FK_vehicles_driver" FOREIGN KEY ("current_driver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "dispatches" ADD CONSTRAINT "FK_dispatches_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispatches" ADD CONSTRAINT "FK_dispatches_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispatches" ADD CONSTRAINT "FK_dispatches_vehicle" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispatches" ADD CONSTRAINT "FK_dispatches_driver" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispatches" ADD CONSTRAINT "FK_dispatches_route" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispatches" ADD CONSTRAINT "FK_dispatches_location" FOREIGN KEY ("source_inventory_location_id") REFERENCES "inventory_locations"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "dispatch_stops" ADD CONSTRAINT "FK_dispatch_stops_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispatch_stops" ADD CONSTRAINT "FK_dispatch_stops_dispatch" FOREIGN KEY ("dispatch_id") REFERENCES "dispatches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispatch_stops" ADD CONSTRAINT "FK_dispatch_stops_order" FOREIGN KEY ("order_id") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispatch_stops" ADD CONSTRAINT "FK_dispatch_stops_invoice" FOREIGN KEY ("invoice_id") REFERENCES "sales_invoices"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "dispatch_stop_lines" ADD CONSTRAINT "FK_dispatch_stop_lines_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispatch_stop_lines" ADD CONSTRAINT "FK_dispatch_stop_lines_stop" FOREIGN KEY ("stop_id") REFERENCES "dispatch_stops"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispatch_stop_lines" ADD CONSTRAINT "FK_dispatch_stop_lines_order_line" FOREIGN KEY ("order_line_id") REFERENCES "sales_order_lines"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispatch_stop_lines" ADD CONSTRAINT "FK_dispatch_stop_lines_item" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispatch_stop_lines" ADD CONSTRAINT "FK_dispatch_stop_lines_uom" FOREIGN KEY ("uom_id") REFERENCES "uoms"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "sales_invoices" ADD CONSTRAINT "FK_sales_invoices_dispatch" FOREIGN KEY ("dispatch_id") REFERENCES "dispatches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_returns" ADD CONSTRAINT "FK_sales_returns_dispatch_stop" FOREIGN KEY ("dispatch_stop_id") REFERENCES "dispatch_stops"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sales_returns" DROP CONSTRAINT "FK_sales_returns_dispatch_stop"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoices" DROP CONSTRAINT "FK_sales_invoices_dispatch"`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispatch_stop_lines" DROP CONSTRAINT "FK_dispatch_stop_lines_uom"`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispatch_stop_lines" DROP CONSTRAINT "FK_dispatch_stop_lines_item"`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispatch_stop_lines" DROP CONSTRAINT "FK_dispatch_stop_lines_order_line"`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispatch_stop_lines" DROP CONSTRAINT "FK_dispatch_stop_lines_stop"`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispatch_stop_lines" DROP CONSTRAINT "FK_dispatch_stop_lines_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispatch_stops" DROP CONSTRAINT "FK_dispatch_stops_invoice"`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispatch_stops" DROP CONSTRAINT "FK_dispatch_stops_order"`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispatch_stops" DROP CONSTRAINT "FK_dispatch_stops_dispatch"`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispatch_stops" DROP CONSTRAINT "FK_dispatch_stops_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispatches" DROP CONSTRAINT "FK_dispatches_location"`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispatches" DROP CONSTRAINT "FK_dispatches_route"`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispatches" DROP CONSTRAINT "FK_dispatches_driver"`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispatches" DROP CONSTRAINT "FK_dispatches_vehicle"`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispatches" DROP CONSTRAINT "FK_dispatches_branch"`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispatches" DROP CONSTRAINT "FK_dispatches_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "vehicles" DROP CONSTRAINT "FK_vehicles_driver"`,
    );
    await queryRunner.query(
      `ALTER TABLE "vehicles" DROP CONSTRAINT "FK_vehicles_org"`,
    );

    await queryRunner.query(
      `ALTER TABLE "sales_returns" DROP INDEX "uq_sales_returns_dispatch_stop"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_returns" DROP COLUMN "dispatch_stop_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoices" DROP INDEX "idx_sales_invoices_org_dispatch"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_invoices" DROP COLUMN "dispatch_id"`,
    );

    await queryRunner.query(
      `ALTER TABLE "dispatch_stop_lines" DROP CONSTRAINT "chk_dispatch_stop_lines_total"`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispatch_stop_lines" DROP CONSTRAINT "chk_dispatch_stop_lines_returned"`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispatch_stop_lines" DROP CONSTRAINT "chk_dispatch_stop_lines_delivered"`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispatch_stop_lines" DROP CONSTRAINT "chk_dispatch_stop_lines_allocated"`,
    );
    await queryRunner.query(`DROP TABLE "dispatch_stop_lines"`);
    await queryRunner.query(
      `ALTER TABLE "dispatch_stops" DROP CONSTRAINT "chk_dispatch_stops_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispatch_stops" DROP CONSTRAINT "chk_dispatch_stops_status"`,
    );
    await queryRunner.query(`DROP TABLE "dispatch_stops"`);
    await queryRunner.query(
      `ALTER TABLE "dispatches" DROP CONSTRAINT "chk_dispatches_status"`,
    );
    await queryRunner.query(`DROP TABLE "dispatches"`);
    await queryRunner.query(
      `ALTER TABLE "vehicles" DROP CONSTRAINT "chk_vehicles_capacity"`,
    );
    await queryRunner.query(
      `ALTER TABLE "vehicles" DROP CONSTRAINT "chk_vehicles_type"`,
    );
    await queryRunner.query(`DROP TABLE "vehicles"`);
  }
}
