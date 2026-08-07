import type { Seed } from './seed.interface';
import { BASE_ROLES, PERMISSIONS, expandGlobs } from './permissions';
import { SUPERUSER_ROLE_CODE } from '../../iam/auth.constants';

const MAPPING_ROWS = BASE_ROLES.filter(
  (role) => role.code !== SUPERUSER_ROLE_CODE,
).flatMap((role) =>
  expandGlobs(role.permissions, PERMISSIONS).map((permission) => ({
    role_code: role.code,
    permission_code: permission,
  })),
);

/**
 * Phase 5d backfill: inserts the new `sales.outlet.*`, `sales.route.*`,
 * `sales.route_assignment.*`, and `sales.visit.*` permission codes and
 * re-ensures every org's base-role mappings (salesman now gets full
 * outlet/route/visit access; warehouse_manager gains route-assignment +
 * field-sales read). Idempotent — mirrors v10 (trading-permissions) as a
 * new version so already-seeded DBs pick up the diff.
 */
export const fieldPermissionsSeed: Seed = {
  version: 11,
  name: 'field-permissions-backfill',
  async run(manager) {
    const rows = PERMISSIONS.map((code) => ({
      code,
      module_code: code.split('.')[0],
    }));

    await manager.query(
      `INSERT INTO permissions (id, module_id, code, description)
       SELECT uuid_generate_v4(), m.id, p.code, NULL
       FROM jsonb_to_recordset($1::jsonb)
            AS p(code text, module_code text)
       JOIN modules m ON m.code = p.module_code
       ON CONFLICT (code) DO NOTHING`,
      [JSON.stringify(rows)],
    );

    await manager.query(
      `INSERT INTO role_permission_mappings (id, role_id, permission_id)
       SELECT uuid_generate_v4(), r.id, p.id
       FROM organizations o
       JOIN roles r ON r.organization_id = o.id
       JOIN jsonb_to_recordset($1::jsonb)
            AS m(role_code text, permission_code text)
         ON r.code = m.role_code
       JOIN permissions p ON p.code = m.permission_code
       ON CONFLICT (role_id, permission_id) DO NOTHING`,
      [JSON.stringify(MAPPING_ROWS)],
    );
  },
};
