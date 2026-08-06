import { AppDataSource } from '../data-source';
import { SEEDS } from './registry';
import { runSeeds } from './seed-runner';

async function main(): Promise<void> {
  await AppDataSource.initialize();

  try {
    const applied = await runSeeds(AppDataSource, SEEDS);
    const names =
      applied.length > 0 ? applied.map((s) => s.name).join(', ') : 'none';
    console.log(`Seed run complete. Applied: ${names}`);
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((error) => {
  console.error('Seed run failed', error);
  process.exit(1);
});
