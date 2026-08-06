import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { Response } from 'express';
import { SKIP_ENVELOPE_KEY } from '../decorators/skip-envelope.decorator';

export interface Envelope<T> {
  success: boolean;
  data: T;
  requestId: string;
}

@Injectable()
export class ResponseEnvelopeInterceptor<T> implements NestInterceptor<
  T,
  Envelope<T> | T
> {
  constructor(
    private readonly reflector: Reflector,
    private readonly cls: ClsService,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<Envelope<T> | T> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_ENVELOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data) => {
        if (
          skip ||
          data instanceof StreamableFile ||
          response.statusCode === 204
        ) {
          return data;
        }

        const requestId = this.cls.getId() ?? 'unknown';

        if (this.isPaginated(data)) {
          return {
            success: true,
            ...data,
            requestId,
          };
        }

        return { success: true, data, requestId };
      }),
    );
  }

  private isPaginated(data: T): data is T & { data: unknown; meta: unknown } {
    return (
      data !== null &&
      typeof data === 'object' &&
      'data' in (data as Record<string, unknown>) &&
      'meta' in (data as Record<string, unknown>)
    );
  }
}
