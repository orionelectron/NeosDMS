import { Seed, SeedEntityManager } from './seed.interface';

export interface SeedDataSource<
  TManager extends SeedEntityManager = SeedEntityManager,
> {
  query(query: string, parameters?: unknown[]): Promise<unknown>;
  transaction<T>(fn: (manager: TManager) => Promise<T>): Promise<T>;
}

const SEED_VERSIONS_TABLE = 'seed_versions';

export async function runSeeds<TManager extends SeedEntityManager>(
  dataSource: SeedDataSource<TManager>,
  seeds: readonly Seed<TManager>[],
): Promise<Seed<TManager>[]> {
  await dataSource.query(
    `CREATE TABLE IF NOT EXISTS "${SEED_VERSIONS_TABLE}" (
       version integer PRIMARY KEY,
       name text NOT NULL,
       applied_at timestamptz NOT NULL DEFAULT now()
     )`,
  );

  const appliedRows = (await dataSource.query(
    `SELECT version FROM "${SEED_VERSIONS_TABLE}"`,
  )) as Array<{ version: number }>;

  const appliedVersions = new Set(appliedRows.map((row) => row.version));

  const pending = seeds
    .slice()
    .sort((a, b) => a.version - b.version)
    .filter((seed) => !appliedVersions.has(seed.version));

  const appliedNow: Seed[] = [];
  for (const seed of pending) {
    await dataSource.transaction(async (manager) => {
      await seed.run(manager);
      await manager.query(
        `INSERT INTO "${SEED_VERSIONS_TABLE}" (version, name) VALUES ($1, $2)`,
        [seed.version, seed.name],
      );
    });
    appliedNow.push(seed);
  }

  return appliedNow;
}
