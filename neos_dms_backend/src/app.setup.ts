import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

export const API_PREFIX = 'api/v1';
export const SWAGGER_PATH = 'docs';

export function configureApp(app: INestApplication): void {
  app.use(helmet());
  app.enableCors();
  app.setGlobalPrefix(API_PREFIX);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const documentConfig = new DocumentBuilder()
    .setTitle('NEOS DMS API')
    .setDescription(
      'Distribution management system for Nepal (NPR, VAT/TDS, Nepali fiscal year)',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, documentConfig);
  SwaggerModule.setup(`${API_PREFIX}/${SWAGGER_PATH}`, app, document);

  Logger.log(
    `Swagger docs mounted at /${API_PREFIX}/${SWAGGER_PATH}`,
    'Bootstrap',
  );
}
