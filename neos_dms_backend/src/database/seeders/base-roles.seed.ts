import type { Seed } from './seed.interface';
import { BASE_ROLES, PERMISSIONS, expandGlobs } from './permissions';
import { SUPERUSER_ROLE_CODE } from '../../iam/auth.constants';

const ROLE_ROWS = BASE_ROLES.map((role) => ({
  code: role.code,
  name: role.name,
}));

const MAPPING_ROWS = BASE_ROLES.filter(
  (role) => role.code !== SUPERUSER_ROLE_CODE,
).flatMap((role) =>
  expandGlobs(role.permissions, PERMISSIONS).map((permission) => ({
    role_code: role.code,
    permission_code: permission,
  })),
);

/**
 * Creates the 5 base roles + permission mappings for every organization that
 * does not already have them (idempotent backfill for pre-existing orgs).
 * Onboarding creates them in-transaction instead; this seed only covers orgs
 * created before Phase 2. The `admin` role is superuser by code and needs no
 * mappings.
 */
export const baseRolesSeed: Seed = {
  version: 6,
  name: 'base-roles-per-org',
  async run(manager) {
    await manager.query(
      `INSERT INTO roles (id, organization_id, code, name, description, is_system, is_active)
       SELECT uuid_generate_v4(), o.id, m.code, m.name, NULL, true, true
       FROM organizations o
       CROSS JOIN jsonb_to_recordset($1::jsonb) AS m(code text, name text)
       ON CONFLICT (organization_id, code) DO NOTHING`,
      [JSON.stringify(ROLE_ROWS)],
    );

    if (MAPPING_ROWS.length === 0) return;
    await manager.query(
      `INSERT INTO role_permission_mappings (id, role_id, permission_id)
       SELECT uuid_generate_v4(), r.id, p.id
       FROM jsonb_to_recordset($1::jsonb)
            AS m(role_code text, permission_code text)
       JOIN roles r ON r.code = m.role_code
       JOIN permissions p ON p.code = m.permission_code
       ON CONFLICT (role_id, permission_id) DO NOTHING`,
      [JSON.stringify(MAPPING_ROWS)],
    );
  },
};
