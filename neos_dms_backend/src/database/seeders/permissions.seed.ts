import type { Seed } from './seed.interface';
import { PERMISSIONS } from './permissions';

export const permissionsSeed: Seed = {
  version: 5,
  name: 'permissions-catalog',
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
  },
};
