import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import type { Request, Response } from 'express';

export interface ErrorResponse {
  status: number;
  code: string;
  message: string;
  details?: unknown;
  requestId: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly cls: ClsService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const payload = this.toErrorResponse(exception, status);

    if (status >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json(payload);
  }

  private toErrorResponse(exception: unknown, status: number): ErrorResponse {
    const requestId = this.cls.getId() ?? 'unknown';

    if (exception instanceof HttpException) {
      const body = exception.getResponse();

      if (typeof body === 'string') {
        return { status, code: this.codeFor(status), message: body, requestId };
      }

      if (body !== null && typeof body === 'object') {
        const { message, code, details } = body as {
          message?: unknown;
          code?: unknown;
          details?: unknown;
        };
        const messageIsArray = Array.isArray(message);

        return {
          status,
          code: typeof code === 'string' ? code : this.codeFor(status),
          message: messageIsArray
            ? 'Request validation failed'
            : typeof message === 'string'
              ? message
              : 'Request failed',
          details: messageIsArray ? message : (details ?? undefined),
          requestId,
        };
      }
    }

    return {
      status,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
      requestId,
    };
  }

  private codeFor(status: number): string {
    const name = (HttpStatus as Record<number, string>)[status];
    return name ?? `HTTP_${status}`;
  }
}
