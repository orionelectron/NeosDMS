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
 * Phase 6b: adds `sales.invoice.post` to the catalog, then re-ensures every
 * base role's mappings. Salesman automatically gains post/void via the
 * existing `sales.invoice.*` glob; manager via `sales.*`; admin via `*`;
 * accountant keeps read-only (`sales.invoice.read`). Idempotent.
 */
export const salesInvoicePermissionsSeed: Seed = {
  version: 19,
  name: 'sales-invoice-permissions-backfill',
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
