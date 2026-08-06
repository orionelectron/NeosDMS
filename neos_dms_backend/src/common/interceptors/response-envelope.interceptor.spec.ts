import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';
import { firstValueFrom, of } from 'rxjs';
import { ResponseEnvelopeInterceptor } from './response-envelope.interceptor';
import { SKIP_ENVELOPE_KEY } from '../decorators/skip-envelope.decorator';

describe('ResponseEnvelopeInterceptor', () => {
  let interceptor: ResponseEnvelopeInterceptor<unknown>;
  let cls: { getId: jest.Mock };
  let reflector: { getAllAndOverride: jest.Mock };
  let response: { statusCode: number };

  const context = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getResponse: () => response }),
  };

  const resultOf = async <T>(data: T): Promise<unknown> => {
    const next = { handle: () => of(data) };
    return firstValueFrom(
      interceptor.intercept(context as never, next as never),
    );
  };

  beforeEach(async () => {
    cls = { getId: jest.fn().mockReturnValue('req-123') };
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) };
    response = { statusCode: 200 };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResponseEnvelopeInterceptor,
        { provide: Reflector, useValue: reflector },
        { provide: ClsService, useValue: cls },
      ],
    }).compile();

    interceptor = module.get(ResponseEnvelopeInterceptor);
  });

  it('wraps plain data in the envelope', async () => {
    await expect(resultOf({ foo: 1 })).resolves.toEqual({
      success: true,
      data: { foo: 1 },
      requestId: 'req-123',
    });
  });

  it('merges paginated responses', async () => {
    const payload = {
      data: [{ id: 1 }],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    };
    await expect(resultOf(payload)).resolves.toEqual({
      success: true,
      ...payload,
      requestId: 'req-123',
    });
  });

  it('honors @SkipEnvelope', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const raw = { data: 'raw' };

    await expect(resultOf(raw)).resolves.toBe(raw);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      SKIP_ENVELOPE_KEY,
      [context.getHandler(), context.getClass()],
    );
  });

  it('leaves 204 responses untouched', async () => {
    response.statusCode = 204;
    await expect(resultOf(undefined)).resolves.toBeUndefined();
  });
});
