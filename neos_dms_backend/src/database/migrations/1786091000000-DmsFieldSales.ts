import { MigrationInterface, QueryRunner } from 'typeorm';

export class DmsFieldSales1786091000000 implements MigrationInterface {
  name = 'DmsFieldSales1786091000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // outlets (before outlet_routes; references parties)
    await queryRunner.query(
      `CREATE TABLE "outlets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "party_id" uuid, "name" character varying NOT NULL, "owner_name" character varying, "email" character varying, "phone" character varying, "address" character varying, "province" character varying, "district" character varying, "latitude" numeric(10,7), "longitude" numeric(10,7), "photo_key" character varying, "description" text, "channel" character varying NOT NULL DEFAULT 'GENERAL_TRADE', "category" character varying, "status" character varying NOT NULL DEFAULT 'ACTIVE', CONSTRAINT "PK_outlets" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_outlets_org_name" ON "outlets"  ("organization_id", "name") `,
    );

    // routes (before outlet_routes / route_assignments)
    await queryRunner.query(
      `CREATE TABLE "routes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "name" character varying NOT NULL, "code" character varying NOT NULL, "description" character varying, "province" character varying, "district" character varying, "status" character varying NOT NULL DEFAULT 'ACTIVE', CONSTRAINT "PK_routes" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_routes_org_code" ON "routes"  ("organization_id", "code") `,
    );

    // outlet_routes (junction; outlet can be on many routes, route has many outlets)
    await queryRunner.query(
      `CREATE TABLE "outlet_routes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "outlet_id" uuid NOT NULL, "route_id" uuid NOT NULL, CONSTRAINT "PK_outlet_routes" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_outlet_routes_org_outlet_route" ON "outlet_routes"  ("organization_id", "outlet_id", "route_id") `,
    );

    // route_assignments (salesman owns a route for weekdays)
    await queryRunner.query(
      `CREATE TABLE "route_assignments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "user_id" uuid NOT NULL, "route_id" uuid NOT NULL, "weekdays" jsonb NOT NULL DEFAULT '[]', CONSTRAINT "PK_route_assignments" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_route_assignments_org_user_route" ON "route_assignments"  ("organization_id", "user_id", "route_id") `,
    );

    // outlet_visits (field check-in/check-out)
    await queryRunner.query(
      `CREATE TABLE "outlet_visits" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "user_id" uuid NOT NULL, "route_id" uuid NOT NULL, "outlet_id" uuid NOT NULL, "visit_type" character varying NOT NULL DEFAULT 'PLANNED', "status" character varying NOT NULL DEFAULT 'SCHEDULED', "checked_in_at" TIMESTAMP WITH TIME ZONE, "checked_out_at" TIMESTAMP WITH TIME ZONE, "check_in_latitude" numeric(10,7), "check_in_longitude" numeric(10,7), "check_out_latitude" numeric(10,7), "check_out_longitude" numeric(10,7), "distance_from_outlet_meters" numeric(10,2), "is_off_route" boolean, "remarks" text, "photo_key" character varying, CONSTRAINT "PK_outlet_visits" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_outlet_visits_org_user" ON "outlet_visits"  ("organization_id", "user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_outlet_visits_org_route" ON "outlet_visits"  ("organization_id", "route_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_outlet_visits_org_outlet" ON "outlet_visits"  ("organization_id", "outlet_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "outlet_visits" ADD CONSTRAINT "chk_outlet_visits_visit_type" CHECK (visit_type IN ('PLANNED','UNPLANNED'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "outlet_visits" ADD CONSTRAINT "chk_outlet_visits_status" CHECK (status IN ('SCHEDULED','CHECKED_IN','CHECKED_OUT','COMPLETED','CANCELLED'))`,
    );

    // Foreign keys
    await queryRunner.query(
      `ALTER TABLE "outlets" ADD CONSTRAINT "FK_outlets_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "outlets" ADD CONSTRAINT "FK_outlets_party" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "routes" ADD CONSTRAINT "FK_routes_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "outlet_routes" ADD CONSTRAINT "FK_outlet_routes_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "outlet_routes" ADD CONSTRAINT "FK_outlet_routes_outlet" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "outlet_routes" ADD CONSTRAINT "FK_outlet_routes_route" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "route_assignments" ADD CONSTRAINT "FK_route_assignments_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "route_assignments" ADD CONSTRAINT "FK_route_assignments_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "route_assignments" ADD CONSTRAINT "FK_route_assignments_route" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "outlet_visits" ADD CONSTRAINT "FK_outlet_visits_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "outlet_visits" ADD CONSTRAINT "FK_outlet_visits_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "outlet_visits" ADD CONSTRAINT "FK_outlet_visits_route" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "outlet_visits" ADD CONSTRAINT "FK_outlet_visits_outlet" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "outlet_visits" DROP CONSTRAINT "FK_outlet_visits_outlet"`,
    );
    await queryRunner.query(
      `ALTER TABLE "outlet_visits" DROP CONSTRAINT "FK_outlet_visits_route"`,
    );
    await queryRunner.query(
      `ALTER TABLE "outlet_visits" DROP CONSTRAINT "FK_outlet_visits_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "outlet_visits" DROP CONSTRAINT "FK_outlet_visits_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "route_assignments" DROP CONSTRAINT "FK_route_assignments_route"`,
    );
    await queryRunner.query(
      `ALTER TABLE "route_assignments" DROP CONSTRAINT "FK_route_assignments_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "route_assignments" DROP CONSTRAINT "FK_route_assignments_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "outlet_routes" DROP CONSTRAINT "FK_outlet_routes_route"`,
    );
    await queryRunner.query(
      `ALTER TABLE "outlet_routes" DROP CONSTRAINT "FK_outlet_routes_outlet"`,
    );
    await queryRunner.query(
      `ALTER TABLE "outlet_routes" DROP CONSTRAINT "FK_outlet_routes_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "routes" DROP CONSTRAINT "FK_routes_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "outlets" DROP CONSTRAINT "FK_outlets_party"`,
    );
    await queryRunner.query(
      `ALTER TABLE "outlets" DROP CONSTRAINT "FK_outlets_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "outlet_visits" DROP CONSTRAINT "chk_outlet_visits_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "outlet_visits" DROP CONSTRAINT "chk_outlet_visits_visit_type"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_outlet_visits_org_outlet"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_outlet_visits_org_route"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_outlet_visits_org_user"`);
    await queryRunner.query(`DROP TABLE "outlet_visits"`);
    await queryRunner.query(
      `DROP INDEX "public"."uq_route_assignments_org_user_route"`,
    );
    await queryRunner.query(`DROP TABLE "route_assignments"`);
    await queryRunner.query(
      `DROP INDEX "public"."uq_outlet_routes_org_outlet_route"`,
    );
    await queryRunner.query(`DROP TABLE "outlet_routes"`);
    await queryRunner.query(`DROP INDEX "public"."uq_routes_org_code"`);
    await queryRunner.query(`DROP TABLE "routes"`);
    await queryRunner.query(`DROP INDEX "public"."uq_outlets_org_name"`);
    await queryRunner.query(`DROP TABLE "outlets"`);
  }
}
