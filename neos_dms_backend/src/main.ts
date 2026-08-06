import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { API_PREFIX, configureApp } from './app.setup';
import { AppModule } from './app.module';
import { AppConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const config = app.get(ConfigService<AppConfig, true>);
  const port = config.get('port', { infer: true });

  configureApp(app);

  await app.listen(port);
  Logger.log(
    `NEOS DMS API running at http://localhost:${port}/${API_PREFIX}`,
    'Bootstrap',
  );
}

void bootstrap();
