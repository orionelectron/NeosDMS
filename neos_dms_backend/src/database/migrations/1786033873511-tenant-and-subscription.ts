import { MigrationInterface, QueryRunner } from 'typeorm';

export class TenantAndSubscription1786033873511 implements MigrationInterface {
  name = 'TenantAndSubscription1786033873511';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(
      `CREATE TABLE "branches" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "name" character varying NOT NULL, "code" character varying NOT NULL, "location" character varying, "is_main_branch" boolean NOT NULL DEFAULT false, "is_active" boolean NOT NULL DEFAULT true, "phone" character varying, "email" character varying, CONSTRAINT "PK_7f37d3b42defea97f1df0d19535" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_branches_org_code" ON "branches"  ("organization_id", "code") `,
    );
    await queryRunner.query(
      `CREATE TABLE "organizations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "name" character varying NOT NULL, "legal_name" character varying, "trade_name" character varying, "email" character varying NOT NULL, "phone_number" character varying NOT NULL, "pan_number" character varying NOT NULL, "vat_number" character varying, "logo_url" character varying, "address" character varying, CONSTRAINT "UQ_7fbc3f780b04df98c263c1a6ced" UNIQUE ("pan_number"), CONSTRAINT "UQ_a231924e749d759b53c20cc2da1" UNIQUE ("vat_number"), CONSTRAINT "PK_6b031fcd0863e3f6b44230163f9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4ad920935f4d4eb73fc58b40f7" ON "organizations"  ("email") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_eadfde877ac42f1e2ef832d3fa" ON "organizations"  ("phone_number") `,
    );
    await queryRunner.query(
      `CREATE TABLE "subscription_history" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "subscription_id" uuid NOT NULL, "plan_id" uuid, "status" character varying NOT NULL, "changed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "changed_by" uuid, "reason" text, CONSTRAINT "PK_91a0ee8b462f23bfb2ad7924754" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "subscription_transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "subscription_id" uuid NOT NULL, "organization_id" uuid NOT NULL, "invoice_number" character varying NOT NULL, "amount" numeric(12,2) NOT NULL, "currency" character varying(3) NOT NULL DEFAULT 'NPR', "status" character varying(16) NOT NULL DEFAULT 'pending', "payment_gateway" character varying, "gateway_transaction_id" character varying, "gateway_payload" jsonb, "paid_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_29ce9be558db139887e25398498" UNIQUE ("invoice_number"), CONSTRAINT "UQ_fba12c65e74757496df32c4af79" UNIQUE ("gateway_transaction_id"), CONSTRAINT "chk_subscription_transactions_amount" CHECK (amount >= 0), CONSTRAINT "chk_subscription_transactions_status" CHECK (status IN ('pending', 'completed', 'failed', 'refunded')), CONSTRAINT "PK_b8a90f16868b06508776988e16e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "subscriptions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "plan_id" uuid NOT NULL, "billing_period_id" uuid NOT NULL, "amount" numeric(12,2) NOT NULL, "currency" character varying(3) NOT NULL DEFAULT 'NPR', "status" character varying(16) NOT NULL DEFAULT 'trialing', "trial_end_date" date, "current_period_start" TIMESTAMP WITH TIME ZONE NOT NULL, "current_period_end" TIMESTAMP WITH TIME ZONE NOT NULL, "auto_renew" boolean NOT NULL DEFAULT false, "canceled_at" TIMESTAMP WITH TIME ZONE, "grace_period_end" TIMESTAMP WITH TIME ZONE, CONSTRAINT "chk_subscriptions_amount" CHECK (amount >= 0), CONSTRAINT "chk_subscriptions_period_order" CHECK (current_period_end >= current_period_start), CONSTRAINT "chk_subscriptions_status" CHECK (status IN ('trialing', 'active', 'past_due', 'canceled')), CONSTRAINT "PK_a87248d73155605cf782be9ee5e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_subscriptions_one_live_per_org" ON "subscriptions"  ("organization_id") WHERE status IN ('trialing', 'active', 'past_due')`,
    );
    await queryRunner.query(
      `CREATE TABLE "plans" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "code" character varying NOT NULL, "name" character varying NOT NULL, "description" text, "grace_period_days" integer NOT NULL DEFAULT '3', "is_active" boolean NOT NULL DEFAULT true, "limits" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "UQ_95f7ef3fc4c31a3545b4d825dd4" UNIQUE ("code"), CONSTRAINT "chk_plans_grace_period_days" CHECK (grace_period_days >= 0), CONSTRAINT "PK_3720521a81c7c24fe9b7202ba61" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "price_matrices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "plan_id" uuid NOT NULL, "billing_period_id" uuid NOT NULL, "base_price" numeric(12,2) NOT NULL, "currency" character varying(3) NOT NULL DEFAULT 'NPR', "is_tax_inclusive" boolean NOT NULL DEFAULT false, "valid_from" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "is_current" boolean NOT NULL DEFAULT true, "superseded_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "chk_price_matrices_base_price" CHECK (base_price >= 0), CONSTRAINT "PK_d78f874c230a7bc56e659e4570d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_price_matrices_current_price_point" ON "price_matrices"  ("plan_id", "billing_period_id") WHERE "is_current" = true`,
    );
    await queryRunner.query(
      `CREATE TABLE "billing_periods" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "name" character varying NOT NULL, "duration_days" integer NOT NULL, CONSTRAINT "UQ_63aa25da9fdd106521cf0c37384" UNIQUE ("name"), CONSTRAINT "chk_billing_periods_duration_days" CHECK (duration_days > 0), CONSTRAINT "PK_d879023c65fe1ec2e0735f5fa68" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "organization_usages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organization_id" uuid NOT NULL, "resource_code" character varying NOT NULL, "current_usage" integer NOT NULL DEFAULT '0', "last_reset_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "chk_organization_usages_current_usage" CHECK (current_usage >= 0), CONSTRAINT "PK_276d3c5cc880bade21c476848ce" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_organization_usages_org_resource" ON "organization_usages"  ("organization_id", "resource_code") `,
    );
    await queryRunner.query(
      `CREATE TABLE "modules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "name" character varying NOT NULL, "code" character varying NOT NULL, "description" text, CONSTRAINT "UQ_8cd1abde4b70e59644c98668c06" UNIQUE ("name"), CONSTRAINT "UQ_25b42b11ac8b697cdb2eddcef1a" UNIQUE ("code"), CONSTRAINT "PK_7dbefd488bd96c5bf31f0ce0c95" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "branches" ADD CONSTRAINT "FK_9ecf73d5ca57108dc33c87f7d88" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscription_history" ADD CONSTRAINT "FK_153e2b7a1a2d9cac822d93fe15f" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscription_transactions" ADD CONSTRAINT "FK_87972f688732a2251f2bcd9f886" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscription_transactions" ADD CONSTRAINT "FK_078156e20f1e198f7e6032b9cd7" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_9ea1509175fa294fc64d43a9fe6" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_e45fca5d912c3a2fab512ac25dc" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_5436cb52f7fb79a751806344b4d" FOREIGN KEY ("billing_period_id") REFERENCES "billing_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "price_matrices" ADD CONSTRAINT "FK_2d5fbf87f90d4d9e1045a900555" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "price_matrices" ADD CONSTRAINT "FK_aa3dbfdbec06f0f5ae92001fb1c" FOREIGN KEY ("billing_period_id") REFERENCES "billing_periods"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_usages" ADD CONSTRAINT "FK_32c122a0356aa64ec5c4c297ffb" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "organization_usages" DROP CONSTRAINT "FK_32c122a0356aa64ec5c4c297ffb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "price_matrices" DROP CONSTRAINT "FK_aa3dbfdbec06f0f5ae92001fb1c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "price_matrices" DROP CONSTRAINT "FK_2d5fbf87f90d4d9e1045a900555"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_5436cb52f7fb79a751806344b4d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_e45fca5d912c3a2fab512ac25dc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_9ea1509175fa294fc64d43a9fe6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscription_transactions" DROP CONSTRAINT "FK_078156e20f1e198f7e6032b9cd7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscription_transactions" DROP CONSTRAINT "FK_87972f688732a2251f2bcd9f886"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscription_history" DROP CONSTRAINT "FK_153e2b7a1a2d9cac822d93fe15f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "branches" DROP CONSTRAINT "FK_9ecf73d5ca57108dc33c87f7d88"`,
    );
    await queryRunner.query(`DROP TABLE "modules"`);
    await queryRunner.query(
      `DROP INDEX "public"."uq_organization_usages_org_resource"`,
    );
    await queryRunner.query(`DROP TABLE "organization_usages"`);
    await queryRunner.query(`DROP TABLE "billing_periods"`);
    await queryRunner.query(
      `DROP INDEX "public"."uq_price_matrices_current_price_point"`,
    );
    await queryRunner.query(`DROP TABLE "price_matrices"`);
    await queryRunner.query(`DROP TABLE "plans"`);
    await queryRunner.query(
      `DROP INDEX "public"."uq_subscriptions_one_live_per_org"`,
    );
    await queryRunner.query(`DROP TABLE "subscriptions"`);
    await queryRunner.query(`DROP TABLE "subscription_transactions"`);
    await queryRunner.query(`DROP TABLE "subscription_history"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_eadfde877ac42f1e2ef832d3fa"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4ad920935f4d4eb73fc58b40f7"`,
    );
    await queryRunner.query(`DROP TABLE "organizations"`);
    await queryRunner.query(`DROP INDEX "public"."uq_branches_org_code"`);
    await queryRunner.query(`DROP TABLE "branches"`);
  }
}
