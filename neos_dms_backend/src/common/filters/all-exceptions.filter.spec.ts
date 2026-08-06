import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let cls: { getId: jest.Mock };
  let response: {
    status: jest.Mock;
    json: jest.Mock;
  };
  let host: {
    switchToHttp: jest.Mock;
  };

  const mockRequest = () => ({ method: 'GET', url: '/test' });

  beforeEach(async () => {
    cls = { getId: jest.fn().mockReturnValue('req-123') };
    response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    host = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: () => mockRequest(),
        getResponse: () => response,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AllExceptionsFilter, { provide: ClsService, useValue: cls }],
    }).compile();

    filter = module.get(AllExceptionsFilter);
  });

  it('shapes a plain HttpException', () => {
    const exception = new HttpException('Nope', HttpStatus.NOT_FOUND);

    filter.catch(exception, host as never);

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({
      status: 404,
      code: 'NOT_FOUND',
      message: 'Nope',
      requestId: 'req-123',
    });
  });

  it('exposes validation-style details', () => {
    const exception = new HttpException(
      {
        statusCode: 400,
        message: ['email must be an email', 'name should not be empty'],
        error: 'Bad Request',
      },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, host as never);

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 400,
        code: 'BAD_REQUEST',
        message: 'Request validation failed',
        details: ['email must be an email', 'name should not be empty'],
        requestId: 'req-123',
      }),
    );
  });

  it('falls back to INTERNAL_SERVER_ERROR for unknown errors', () => {
    filter.catch(new Error('boom'), host as never);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
      requestId: 'req-123',
    });
  });
});
