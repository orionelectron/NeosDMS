import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { AuthService, type RequestMeta } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { LogoutDto, RefreshTokenDto } from './dto/token.dto';
import { IamService } from './iam.service';

function requestMeta(req: Request): RequestMeta {
  const ua = req.headers['user-agent'];
  const userAgent =
    typeof ua === 'string' ? ua : Array.isArray(ua) ? (ua[0] ?? null) : null;
  return {
    ip: req.ip ?? null,
    userAgent,
  };
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly iamService: IamService,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Onboard org + owner user, return tokens' })
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.authService.register(dto, requestMeta(req));
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Login and receive access + refresh tokens' })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, requestMeta(req));
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate a refresh token into a fresh pair' })
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refresh(dto.refreshToken, requestMeta(req));
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Revoke a refresh token' })
  async logout(@Body() dto: LogoutDto) {
    await this.authService.logout(dto.refreshToken);
    return { loggedOut: true };
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Current user profile + resolved permissions' })
  async me(@CurrentUser() user: AuthenticatedUser) {
    const { user: entity, permissions } = await this.iamService.getProfile(
      user.organizationId,
      user.id,
    );
    return {
      user: this.authService.toPublicUser(entity),
      permissions,
    };
  }
}
