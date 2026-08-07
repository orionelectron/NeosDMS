import { MigrationInterface, QueryRunner } from 'typeorm';

export class HrAttendance1786300000000 implements MigrationInterface {
  name = 'HrAttendance1786300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // attendances (decision 34): self-service check-in/out with optional GPS,
    // manager manual corrections, BS-date-keyed reports. One OPEN record per
    // user is enforced by a partial unique index; checkout is optional and
    // must be after check-in; duration is always derived server-side.
    await queryRunner.query(
      `CREATE TABLE "attendances" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "user_id" uuid NOT NULL, "bs_date" character varying(10) NOT NULL, "status" character varying NOT NULL DEFAULT 'OPEN', "source" character varying NOT NULL DEFAULT 'DEVICE', "checkin_at" TIMESTAMP WITH TIME ZONE NOT NULL, "checkin_remarks" text, "checkin_latitude" numeric(10,7), "checkin_longitude" numeric(10,7), "checkout_at" TIMESTAMP WITH TIME ZONE, "checkout_remarks" text, "checkout_latitude" numeric(10,7), "checkout_longitude" numeric(10,7), "duration_minutes" integer, CONSTRAINT "PK_attendances" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_attendances_org_user_bs" ON "attendances"  ("organization_id", "user_id", "bs_date") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_attendances_org_bs" ON "attendances"  ("organization_id", "bs_date") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_attendances_open_per_user" ON "attendances"  ("organization_id", "user_id") WHERE status = 'OPEN'`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendances" ADD CONSTRAINT "chk_attendances_status" CHECK (status IN ('OPEN','CLOSED'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendances" ADD CONSTRAINT "chk_attendances_source" CHECK (source IN ('DEVICE','MANUAL'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendances" ADD CONSTRAINT "chk_attendances_checkout_after_checkin" CHECK (checkout_at IS NULL OR checkout_at > checkin_at)`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendances" ADD CONSTRAINT "chk_attendances_duration" CHECK (duration_minutes IS NULL OR duration_minutes >= 0)`,
    );

    // Foreign keys
    await queryRunner.query(
      `ALTER TABLE "attendances" ADD CONSTRAINT "FK_attendances_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendances" ADD CONSTRAINT "FK_attendances_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "attendances" DROP CONSTRAINT "FK_attendances_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendances" DROP CONSTRAINT "FK_attendances_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendances" DROP CONSTRAINT "chk_attendances_duration"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendances" DROP CONSTRAINT "chk_attendances_checkout_after_checkin"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendances" DROP CONSTRAINT "chk_attendances_source"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendances" DROP CONSTRAINT "chk_attendances_status"`,
    );
    await queryRunner.query(`DROP INDEX "uq_attendances_open_per_user"`);
    await queryRunner.query(`DROP INDEX "idx_attendances_org_bs"`);
    await queryRunner.query(`DROP INDEX "idx_attendances_org_user_bs"`);
    await queryRunner.query(`DROP TABLE "attendances"`);
  }
}
