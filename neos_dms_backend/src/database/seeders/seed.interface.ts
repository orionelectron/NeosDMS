export interface SeedEntityManager {
  query(query: string, parameters?: unknown[]): Promise<unknown>;
}

export interface Seed<TManager extends SeedEntityManager = SeedEntityManager> {
  version: number;
  name: string;
  run(manager: TManager): void | Promise<void>;
}
