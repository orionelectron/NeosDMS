import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { API_PREFIX, configureApp } from './app.setup';
import { AppModule } from './app.module';
import { AppConfig } from './config/configuration';
import { SEEDS } from './database/seeders/registry';
import { runSeeds } from './database/seeders/seed-runner';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const config = app.get(ConfigService<AppConfig, true>);
  const port = config.get('port', { infer: true });

  configureApp(app);

  const dataSource = app.get(DataSource);
  const appliedSeeds = await runSeeds(dataSource, SEEDS);
  if (appliedSeeds.length > 0) {
    Logger.log(
      `Seed run complete. Applied: ${appliedSeeds.map((seed) => seed.name).join(', ')}`,
      'Bootstrap',
    );
  }

  await app.listen(port);
  Logger.log(
    `NEOS DMS API running at http://localhost:${port}/${API_PREFIX}`,
    'Bootstrap',
  );
}

void bootstrap();
