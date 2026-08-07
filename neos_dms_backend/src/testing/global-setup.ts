import { createTestDataSource } from './test-db';

/**
 * Runs before any test file so migrations are applied exactly once per jest
 * run instead of racing across parallel workers.
 */
export default async function globalSetup(): Promise<void> {
  const dataSource = await createTestDataSource();
  await dataSource.destroy();
}
