import { MigrationInterface, QueryRunner } from 'typeorm';

export class HrLeave1786100000000 implements MigrationInterface {
  name = 'HrLeave1786100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // users.manager_id (approval hierarchy, decision 28)
    await queryRunner.query(`ALTER TABLE "users" ADD "manager_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "FK_users_manager" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    // leave_types (org-scoped leave catalogue)
    await queryRunner.query(
      `CREATE TABLE "leave_types" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "code" character varying NOT NULL, "name" character varying NOT NULL, "is_paid" boolean NOT NULL DEFAULT true, "days_per_year" integer NOT NULL DEFAULT 0, "carryover_limit_days" integer NOT NULL DEFAULT 0, "max_consecutive_days" integer NOT NULL DEFAULT 0, "requires_balance" boolean NOT NULL DEFAULT true, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_leave_types" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_leave_types_org_code" ON "leave_types"  ("organization_id", "code") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_leave_types_org" ON "leave_types"  ("organization_id") `,
    );

    // leave_balances (annual BS-calendar-year grant, decision 29)
    await queryRunner.query(
      `CREATE TABLE "leave_balances" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "user_id" uuid NOT NULL, "leave_type_id" uuid NOT NULL, "bs_year" integer NOT NULL, "entitled_days" numeric(6,1) NOT NULL DEFAULT 0, "carryover_days" numeric(6,1) NOT NULL DEFAULT 0, "used_days" numeric(6,1) NOT NULL DEFAULT 0, CONSTRAINT "PK_leave_balances" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_leave_balances_org_user_type_year" ON "leave_balances"  ("organization_id", "user_id", "leave_type_id", "bs_year") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_leave_balances_org_user" ON "leave_balances"  ("organization_id", "user_id") `,
    );

    // leave_requests (BS date range; AD dates for calendar correctness)
    await queryRunner.query(
      `CREATE TABLE "leave_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "user_id" uuid NOT NULL, "leave_type_id" uuid NOT NULL, "status" character varying NOT NULL DEFAULT 'PENDING', "from_date" date NOT NULL, "to_date" date NOT NULL, "from_bs_date" character varying(10) NOT NULL, "to_bs_date" character varying(10) NOT NULL, "days" integer NOT NULL, "reason" text, "reviewer_note" text, "approved_by" uuid, "approved_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_leave_requests" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_leave_requests_org_user" ON "leave_requests"  ("organization_id", "user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_leave_requests_org_status" ON "leave_requests"  ("organization_id", "status") `,
    );
    await queryRunner.query(
      `ALTER TABLE "leave_requests" ADD CONSTRAINT "chk_leave_requests_status" CHECK (status IN ('PENDING','APPROVED','REJECTED','CANCELLED'))`,
    );

    // approval_events (shared generic approval trail)
    await queryRunner.query(
      `CREATE TABLE "approval_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "entity_type" character varying NOT NULL, "entity_id" uuid NOT NULL, "actor_id" uuid NOT NULL, "action" character varying NOT NULL, "note" text, CONSTRAINT "PK_approval_events" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_approval_events_org_entity" ON "approval_events"  ("organization_id", "entity_type", "entity_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_events" ADD CONSTRAINT "chk_approval_events_action" CHECK (action IN ('SUBMIT','APPROVE','REJECT','CANCEL','UPDATE'))`,
    );

    // Foreign keys
    await queryRunner.query(
      `ALTER TABLE "leave_types" ADD CONSTRAINT "FK_leave_types_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "leave_balances" ADD CONSTRAINT "FK_leave_balances_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "leave_balances" ADD CONSTRAINT "FK_leave_balances_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "leave_balances" ADD CONSTRAINT "FK_leave_balances_type" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "leave_requests" ADD CONSTRAINT "FK_leave_requests_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "leave_requests" ADD CONSTRAINT "FK_leave_requests_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "leave_requests" ADD CONSTRAINT "FK_leave_requests_type" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "leave_requests" ADD CONSTRAINT "FK_leave_requests_approver" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_events" ADD CONSTRAINT "FK_approval_events_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_events" ADD CONSTRAINT "FK_approval_events_actor" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "approval_events" DROP CONSTRAINT "FK_approval_events_actor"`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_events" DROP CONSTRAINT "FK_approval_events_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "leave_requests" DROP CONSTRAINT "FK_leave_requests_approver"`,
    );
    await queryRunner.query(
      `ALTER TABLE "leave_requests" DROP CONSTRAINT "FK_leave_requests_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "leave_requests" DROP CONSTRAINT "FK_leave_requests_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "leave_requests" DROP CONSTRAINT "FK_leave_requests_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "leave_balances" DROP CONSTRAINT "FK_leave_balances_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "leave_balances" DROP CONSTRAINT "FK_leave_balances_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "leave_balances" DROP CONSTRAINT "FK_leave_balances_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "leave_types" DROP CONSTRAINT "FK_leave_types_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "leave_requests" DROP CONSTRAINT "chk_leave_requests_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_events" DROP CONSTRAINT "chk_approval_events_action"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_approval_events_org_entity"`,
    );
    await queryRunner.query(`DROP TABLE "approval_events"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_leave_requests_org_status"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_leave_requests_org_user"`,
    );
    await queryRunner.query(`DROP TABLE "leave_requests"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_leave_balances_org_user"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_leave_balances_org_user_type_year"`,
    );
    await queryRunner.query(`DROP TABLE "leave_balances"`);
    await queryRunner.query(`DROP INDEX "public"."idx_leave_types_org"`);
    await queryRunner.query(`DROP INDEX "public"."uq_leave_types_org_code"`);
    await queryRunner.query(`DROP TABLE "leave_types"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "FK_users_manager"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "manager_id"`);
  }
}
