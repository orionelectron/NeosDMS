import type { Seed } from './seed.interface';

/**
 * IAM + tenant modules for the permission catalog. The Phase 1 module seed
 * covered FMCG operational modules only; these are added so permission codes
 * under `tenant.*`, `subscription.*` and `iam.*` have a valid module FK.
 */
const IAM_MODULE_CATALOG: ReadonlyArray<{
  name: string;
  code: string;
  description: string;
}> = [
  {
    name: 'Tenant',
    code: 'tenant',
    description: 'Organization and branch administration',
  },
  {
    name: 'Subscription',
    code: 'subscription',
    description: 'Plans, billing, usage and limits',
  },
  {
    name: 'IAM',
    code: 'iam',
    description: 'Users, roles, permissions and audit',
  },
];

export const modulesIamSeed: Seed = {
  version: 4,
  name: 'modules-iam-catalog',
  async run(manager) {
    await manager.query(
      `INSERT INTO modules (id, name, code, description)
       SELECT uuid_generate_v4(), m.name, m.code, m.description
       FROM jsonb_to_recordset($1::jsonb)
            AS m(name text, code text, description text)
       ON CONFLICT (code) DO NOTHING`,
      [JSON.stringify(IAM_MODULE_CATALOG)],
    );
  },
};
