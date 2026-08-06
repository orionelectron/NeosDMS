import { MigrationInterface, QueryRunner } from 'typeorm';

export class IamAndAuth1786035687494 implements MigrationInterface {
  name = 'IamAndAuth1786035687494';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organization_id" uuid NOT NULL, "branch_id" uuid, "user_id" uuid, "action" character varying NOT NULL, "entity_type" character varying NOT NULL, "entity_id" character varying, "old_data" jsonb, "new_data" jsonb, "ip_address" character varying, "bs_date" character varying, "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_logs_org_entity" ON "audit_logs"  ("organization_id", "entity_type") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_logs_org_created" ON "audit_logs"  ("organization_id", "occurred_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "permissions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "module_id" uuid NOT NULL, "code" character varying NOT NULL, "description" text, CONSTRAINT "UQ_8dad765629e83229da6feda1c1d" UNIQUE ("code"), CONSTRAINT "PK_920331560282b8bd21bb02290df" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "role_permission_mappings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "role_id" uuid NOT NULL, "permission_id" uuid NOT NULL, CONSTRAINT "PK_c9f7101b4f2c356db70447b64e5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_role_permission_mappings" ON "role_permission_mappings"  ("role_id", "permission_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "roles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "code" character varying NOT NULL, "name" character varying NOT NULL, "description" text, "is_system" boolean NOT NULL DEFAULT false, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_roles_org_code" ON "roles"  ("organization_id", "code") `,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "organization_id" uuid NOT NULL, "branch_id" uuid NOT NULL, "role_id" uuid, "full_name" character varying NOT NULL, "username" character varying, "email" character varying NOT NULL, "password_hash" character varying NOT NULL, "is_owner" boolean NOT NULL DEFAULT false, "is_active" boolean NOT NULL DEFAULT true, "must_change_password" boolean NOT NULL DEFAULT false, "last_login_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_users_org" ON "users"  ("organization_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_users_email" ON "users"  ("email") `,
    );
    await queryRunner.query(
      `CREATE TABLE "refresh_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "createdBy" uuid, "updatedBy" uuid, "user_id" uuid NOT NULL, "token_hash" character varying NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, "ip_address" character varying, "user_agent" character varying, CONSTRAINT "PK_9190032f6967b7971dca07d69f3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_refresh_sessions_user" ON "refresh_sessions"  ("user_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_refresh_sessions_token_hash" ON "refresh_sessions"  ("token_hash") `,
    );
    await queryRunner.query(
      `ALTER TABLE "permissions" ADD CONSTRAINT "FK_738f46bb9ac6ea356f1915835d0" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_permission_mappings" ADD CONSTRAINT "FK_61588973774efc9f12b61e6b6ea" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_permission_mappings" ADD CONSTRAINT "FK_ca14831660adc54d04964a095b4" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "FK_21a659804ed7bf61eb91688dea7" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "FK_5a58f726a41264c8b3e86d4a1de" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "FK_a2cecd1a3531c0b041e29ba46e1" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_sessions" ADD CONSTRAINT "FK_a7ab4fd82c654c85b9de53d971a" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "refresh_sessions" DROP CONSTRAINT "FK_a7ab4fd82c654c85b9de53d971a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "FK_a2cecd1a3531c0b041e29ba46e1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "FK_5a58f726a41264c8b3e86d4a1de"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "FK_21a659804ed7bf61eb91688dea7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_permission_mappings" DROP CONSTRAINT "FK_ca14831660adc54d04964a095b4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_permission_mappings" DROP CONSTRAINT "FK_61588973774efc9f12b61e6b6ea"`,
    );
    await queryRunner.query(
      `ALTER TABLE "permissions" DROP CONSTRAINT "FK_738f46bb9ac6ea356f1915835d0"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_refresh_sessions_token_hash"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_refresh_sessions_user"`);
    await queryRunner.query(`DROP TABLE "refresh_sessions"`);
    await queryRunner.query(`DROP INDEX "public"."uq_users_email"`);
    await queryRunner.query(`DROP INDEX "public"."idx_users_org"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP INDEX "public"."uq_roles_org_code"`);
    await queryRunner.query(`DROP TABLE "roles"`);
    await queryRunner.query(
      `DROP INDEX "public"."uq_role_permission_mappings"`,
    );
    await queryRunner.query(`DROP TABLE "role_permission_mappings"`);
    await queryRunner.query(`DROP TABLE "permissions"`);
    await queryRunner.query(`DROP INDEX "public"."idx_audit_logs_org_created"`);
    await queryRunner.query(`DROP INDEX "public"."idx_audit_logs_org_entity"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
  }
}
