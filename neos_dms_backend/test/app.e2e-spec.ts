import { INestApplication } from '@nestjs/common';
import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  Query,
} from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';
import { IsEmail } from 'class-validator';
import request from 'supertest';
import { App } from 'supertest/types';
import { Test, TestingModule } from '@nestjs/testing';
import { configureApp } from './../src/app.setup';
import { CommonModule } from './../src/common/common.module';
import { clsModuleOptions } from './../src/common/request-context';
import { Public } from './../src/iam/decorators/public.decorator';
import { SkipEnvelope } from './../src/common/decorators/skip-envelope.decorator';
import { PaginationQueryDto } from './../src/common/dto/pagination.dto';
import { HealthModule } from './../src/health/health.module';

class TestBodyDto {
  @IsEmail()
  email!: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  requestId: string;
}

interface ApiError {
  status: number;
  code: string;
  message: string;
  details?: unknown;
  requestId: string;
}

@Controller('test')
@Public()
class TestController {
  @Get('value')
  value(@Query() query: PaginationQueryDto): Record<string, unknown> {
    return { page: query.page, limit: query.limit, hello: 'world' };
  }

  @Get('error')
  error(): never {
    throw new NotFoundException('Missing thing');
  }

  @Get('raw')
  @SkipEnvelope()
  raw(): Record<string, string> {
    return { hello: 'raw' };
  }

  @Post('validate')
  validate(@Body() body: TestBodyDto): TestBodyDto {
    return body;
  }
}

describe('Foundation (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ClsModule.forRoot(clsModuleOptions),
        CommonModule,
        HealthModule,
      ],
      controllers: [TestController],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health returns an enveloped liveness response', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);

    const body = res.body as ApiEnvelope<{ status: string }>;
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('ok');
    expect(body.requestId).toBeTruthy();
  });

  it('echoes an inbound X-Request-Id and surfaces it in the body', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('X-Request-Id', 'trace-42')
      .expect(200);

    expect(res.headers['x-request-id']).toBe('trace-42');
    const body = res.body as ApiEnvelope<{ status: string }>;
    expect(body.requestId).toBe('trace-42');
  });

  it('envelopes handler data', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/test/value')
      .expect(200);

    const body = res.body as ApiEnvelope<{
      page: number;
      limit: number;
      hello: string;
    }>;
    expect(body).toEqual({
      success: true,
      data: { page: 1, limit: 20, hello: 'world' },
      requestId: expect.any(String) as string,
    });
  });

  it('keeps @SkipEnvelope responses raw', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/test/raw')
      .expect(200);

    expect(res.body as Record<string, string>).toEqual({ hello: 'raw' });
  });

  it('returns structured errors with a requestId', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/test/error')
      .expect(404);

    expect(res.body as ApiError).toEqual({
      status: 404,
      code: 'NOT_FOUND',
      message: 'Missing thing',
      requestId: expect.any(String) as string,
    });
  });

  it('rejects invalid payloads via the global ValidationPipe', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/test/validate')
      .send({ email: 'not-an-email' })
      .expect(400);

    const body = res.body as ApiError & { details: string[] };
    expect(body).toEqual({
      status: 400,
      code: 'BAD_REQUEST',
      message: 'Request validation failed',
      details: expect.arrayContaining([
        expect.stringContaining('email'),
      ]) as string[],
      requestId: expect.any(String) as string,
    });
  });

  it('forbids unknown query parameters', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/test/value?bogus=1')
      .expect(400);

    expect((res.body as ApiError).code).toBe('BAD_REQUEST');
  });

  it('serves Swagger UI at /api/v1/docs', async () => {
    await request(app.getHttpServer()).get('/api/v1/docs').expect(200);
  });
});
