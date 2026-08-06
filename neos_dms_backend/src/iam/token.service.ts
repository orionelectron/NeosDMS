import { createHash, randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import type { AppConfig } from '../config/configuration';
import { ACCESS_TOKEN_TYPE, REFRESH_TOKEN_BYTES } from './auth.constants';
import { UserEntity } from './entities/user.entity';

export interface AccessTokenClaims {
  sub: string;
  org: string;
  branch: string;
  type: typeof ACCESS_TOKEN_TYPE;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  signAccessToken(
    user: Pick<UserEntity, 'id' | 'organizationId' | 'branchId'>,
  ): string {
    const payload: AccessTokenClaims = {
      sub: user.id,
      org: user.organizationId,
      branch: user.branchId,
      type: ACCESS_TOKEN_TYPE,
    };
    return this.jwtService.sign(payload, {
      secret: this.config.get('jwt', { infer: true }).secret,
      expiresIn: this.config.get('jwt', { infer: true })
        .accessTtl as JwtSignOptions['expiresIn'],
    });
  }

  /** Generate an opaque refresh token. Only its hash is persisted. */
  generateRefreshToken(): string {
    return randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    return this.jwtService.verifyAsync<AccessTokenClaims>(token, {
      secret: this.config.get('jwt', { infer: true }).secret,
    });
  }

  refreshTokenTtlDays(): number {
    return this.config.get('jwt', { infer: true }).refreshTtlDays;
  }
}
