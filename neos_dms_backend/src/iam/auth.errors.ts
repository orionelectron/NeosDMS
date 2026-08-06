import { HttpException, HttpStatus } from '@nestjs/common';

export class InvalidCredentialsException extends HttpException {
  constructor() {
    super(
      {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class AccountDisabledException extends HttpException {
  constructor() {
    super(
      {
        code: 'ACCOUNT_DISABLED',
        message: 'This account has been disabled',
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class InvalidAccessTokenException extends HttpException {
  constructor() {
    super(
      {
        code: 'INVALID_ACCESS_TOKEN',
        message: 'Access token is invalid or expired',
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class InvalidRefreshTokenException extends HttpException {
  constructor() {
    super(
      {
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token is invalid',
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class RevokedRefreshTokenException extends HttpException {
  constructor() {
    super(
      {
        code: 'REFRESH_TOKEN_REVOKED',
        message: 'Refresh token has been revoked',
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class ExpiredRefreshTokenException extends HttpException {
  constructor() {
    super(
      {
        code: 'REFRESH_TOKEN_EXPIRED',
        message: 'Refresh token has expired',
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class EmailAlreadyUsedException extends HttpException {
  constructor() {
    super(
      {
        code: 'EMAIL_ALREADY_USED',
        message: 'A user with this email already exists',
      },
      HttpStatus.CONFLICT,
    );
  }
}
