import { MigrationInterface, QueryRunner } from 'typeorm';

export class HrTravel1786200000000 implements MigrationInterface {
  name = 'HrTravel1786200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // travel_requests (manager approval per decision 32)
    await queryRunner.query(
      `CREATE TABLE "travel_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "user_id" uuid NOT NULL, "purpose" text NOT NULL, "from_date" date NOT NULL, "to_date" date NOT NULL, "from_bs_date" character varying(10) NOT NULL, "to_bs_date" character varying(10) NOT NULL, "transport_mode" character varying NOT NULL, "estimated_cost" numeric(14,2) NOT NULL DEFAULT 0, "status" character varying NOT NULL DEFAULT 'PENDING', "reviewer_note" text, "approved_by" uuid, "approved_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_travel_requests" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_travel_requests_org_user" ON "travel_requests"  ("organization_id", "user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_travel_requests_org_status" ON "travel_requests"  ("organization_id", "status") `,
    );
    await queryRunner.query(
      `ALTER TABLE "travel_requests" ADD CONSTRAINT "chk_travel_requests_status" CHECK (status IN ('PENDING','APPROVED','REJECTED','CANCELLED'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "travel_requests" ADD CONSTRAINT "chk_travel_requests_transport" CHECK (transport_mode IN ('AIR','BUS','TAXI','TRAIN','PRIVATE_CAR','OTHER'))`,
    );

    // travel_expense_claims (manager approves, accountant pays — decision 31)
    await queryRunner.query(
      `CREATE TABLE "travel_expense_claims" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "user_id" uuid NOT NULL, "travel_request_id" uuid, "from_date" date NOT NULL, "to_date" date NOT NULL, "from_bs_date" character varying(10) NOT NULL, "to_bs_date" character varying(10) NOT NULL, "total" numeric(14,2) NOT NULL DEFAULT 0, "status" character varying NOT NULL DEFAULT 'PENDING', "reviewer_note" text, "approved_by" uuid, "approved_at" TIMESTAMP WITH TIME ZONE, "paid_by" uuid, "paid_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_travel_expense_claims" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_travel_claims_org_user" ON "travel_expense_claims"  ("organization_id", "user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_travel_claims_org_status" ON "travel_expense_claims"  ("organization_id", "status") `,
    );
    await queryRunner.query(
      `ALTER TABLE "travel_expense_claims" ADD CONSTRAINT "chk_travel_claims_status" CHECK (status IN ('PENDING','APPROVED','REJECTED','PAID','CANCELLED'))`,
    );

    // travel_expense_items (line items; total always derived — decision 33)
    await queryRunner.query(
      `CREATE TABLE "travel_expense_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "claim_id" uuid NOT NULL, "bs_date" character varying(10) NOT NULL, "category" character varying NOT NULL, "description" text NOT NULL, "amount" numeric(14,2) NOT NULL, "approved_amount" numeric(14,2) NOT NULL, "receipt_key" character varying, CONSTRAINT "PK_travel_expense_items" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_travel_items_org_claim" ON "travel_expense_items"  ("organization_id", "claim_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "travel_expense_items" ADD CONSTRAINT "chk_travel_items_category" CHECK (category IN ('HOTEL','FOOD','FUEL','TRANSPORT','TOLL','MISC'))`,
    );

    // Extend the shared approval action CHECK to include the accountant's PAY
    // step (decision 31).
    await queryRunner.query(
      `ALTER TABLE "approval_events" DROP CONSTRAINT "chk_approval_events_action"`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_events" ADD CONSTRAINT "chk_approval_events_action" CHECK (action IN ('SUBMIT','APPROVE','REJECT','CANCEL','UPDATE','PAID'))`,
    );

    // Foreign keys
    await queryRunner.query(
      `ALTER TABLE "travel_requests" ADD CONSTRAINT "FK_travel_requests_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "travel_requests" ADD CONSTRAINT "FK_travel_requests_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "travel_requests" ADD CONSTRAINT "FK_travel_requests_approver" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "travel_expense_claims" ADD CONSTRAINT "FK_travel_claims_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "travel_expense_claims" ADD CONSTRAINT "FK_travel_claims_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "travel_expense_claims" ADD CONSTRAINT "FK_travel_claims_request" FOREIGN KEY ("travel_request_id") REFERENCES "travel_requests"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "travel_expense_claims" ADD CONSTRAINT "FK_travel_claims_approver" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "travel_expense_claims" ADD CONSTRAINT "FK_travel_claims_payer" FOREIGN KEY ("paid_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "travel_expense_items" ADD CONSTRAINT "FK_travel_items_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "travel_expense_items" ADD CONSTRAINT "FK_travel_items_claim" FOREIGN KEY ("claim_id") REFERENCES "travel_expense_claims"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "travel_expense_items" DROP CONSTRAINT "FK_travel_items_claim"`,
    );
    await queryRunner.query(
      `ALTER TABLE "travel_expense_items" DROP CONSTRAINT "FK_travel_items_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "travel_expense_claims" DROP CONSTRAINT "FK_travel_claims_payer"`,
    );
    await queryRunner.query(
      `ALTER TABLE "travel_expense_claims" DROP CONSTRAINT "FK_travel_claims_approver"`,
    );
    await queryRunner.query(
      `ALTER TABLE "travel_expense_claims" DROP CONSTRAINT "FK_travel_claims_request"`,
    );
    await queryRunner.query(
      `ALTER TABLE "travel_expense_claims" DROP CONSTRAINT "FK_travel_claims_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "travel_expense_claims" DROP CONSTRAINT "FK_travel_claims_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "travel_requests" DROP CONSTRAINT "FK_travel_requests_approver"`,
    );
    await queryRunner.query(
      `ALTER TABLE "travel_requests" DROP CONSTRAINT "FK_travel_requests_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "travel_requests" DROP CONSTRAINT "FK_travel_requests_org"`,
    );
    await queryRunner.query(
      `ALTER TABLE "travel_expense_claims" DROP CONSTRAINT "chk_travel_claims_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "travel_expense_items" DROP CONSTRAINT "chk_travel_items_category"`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_events" DROP CONSTRAINT "chk_approval_events_action"`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_events" ADD CONSTRAINT "chk_approval_events_action" CHECK (action IN ('SUBMIT','APPROVE','REJECT','CANCEL','UPDATE'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "travel_requests" DROP CONSTRAINT "chk_travel_requests_transport"`,
    );
    await queryRunner.query(
      `ALTER TABLE "travel_requests" DROP CONSTRAINT "chk_travel_requests_status"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_travel_items_org_claim"`);
    await queryRunner.query(`DROP TABLE "travel_expense_items"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_travel_claims_org_status"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_travel_claims_org_user"`);
    await queryRunner.query(`DROP TABLE "travel_expense_claims"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_travel_requests_org_status"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_travel_requests_org_user"`,
    );
    await queryRunner.query(`DROP TABLE "travel_requests"`);
  }
}
