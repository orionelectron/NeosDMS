import { runSeeds, SeedDataSource, SeedEntityManager } from './seed-runner';
import { Seed } from './seed.interface';

function createFakeDataSource(): SeedDataSource & {
  queries: Array<{ sql: string; params?: unknown[] }>;
  appliedVersions: Set<number>;
} {
  const appliedVersions = new Set<number>();
  const queries: Array<{ sql: string; params?: unknown[] }> = [];

  const query = (sql: string, params?: unknown[]): Promise<unknown[]> => {
    queries.push({ sql, params });
    if (sql.includes('SELECT version')) {
      return Promise.resolve(
        [...appliedVersions].map((version) => ({ version })),
      );
    }
    if (sql.includes('INSERT INTO "seed_versions"') && params) {
      appliedVersions.add(Number(params[0]));
    }
    return Promise.resolve([]);
  };

  const transaction = <T>(
    fn: (manager: SeedEntityManager) => Promise<T>,
  ): Promise<T> => {
    const manager: SeedEntityManager = { query };
    return fn(manager);
  };

  return { queries, appliedVersions, query, transaction };
}

describe('runSeeds', () => {
  it('runs pending seeds in version order and records them', async () => {
    const order: string[] = [];
    const seedA: Seed = { version: 1, name: 'a', run: () => order.push('a') };
    const seedB: Seed = { version: 2, name: 'b', run: () => order.push('b') };
    const ds = createFakeDataSource();

    const applied = await runSeeds(ds, [seedB, seedA]);

    expect(order).toEqual(['a', 'b']);
    expect(applied).toEqual([seedA, seedB]);
    expect(ds.appliedVersions).toEqual(new Set([1, 2]));
    expect(ds.queries.some((q) => q.sql.includes('CREATE TABLE'))).toBe(true);
  });

  it('skips seeds already applied (idempotent)', async () => {
    const order: string[] = [];
    const seedA: Seed = { version: 1, name: 'a', run: () => order.push('a') };
    const seedB: Seed = { version: 2, name: 'b', run: () => order.push('b') };
    const ds = createFakeDataSource();
    ds.appliedVersions.add(1);

    const applied = await runSeeds(ds, [seedA, seedB]);

    expect(order).toEqual(['b']);
    expect(applied).toEqual([seedB]);
  });

  it('does not record a version when the seed throws', async () => {
    const seedA: Seed = {
      version: 1,
      name: 'a',
      run: () => {
        throw new Error('boom');
      },
    };
    const ds = createFakeDataSource();

    await expect(runSeeds(ds, [seedA])).rejects.toThrow('boom');
    expect(ds.appliedVersions.has(1)).toBe(false);
  });
});
