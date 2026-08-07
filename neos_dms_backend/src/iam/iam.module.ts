import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { AppConfig } from '../config/configuration';
import { AuditModule } from '../audit/audit.module';
import { NepaliDateModule } from '../nepali-date/nepali-date.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PermissionEntity } from './entities/permission.entity';
import { RefreshSessionEntity } from './entities/refresh-session.entity';
import { RolePermissionMappingEntity } from './entities/role-permission-mapping.entity';
import { RoleEntity } from './entities/role.entity';
import { UserEntity } from './entities/user.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { IamController } from './iam.controller';
import { IamService } from './iam.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      RoleEntity,
      PermissionEntity,
      RolePermissionMappingEntity,
      RefreshSessionEntity,
    ]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        secret: config.get('jwt', { infer: true }).secret,
      }),
    }),
    AuditModule,
    TenancyModule,
    SubscriptionModule,
    NepaliDateModule,
  ],
  controllers: [AuthController, IamController],
  providers: [
    AuthService,
    IamService,
    TokenService,
    PasswordService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [IamService, AuthService, TokenService],
})
export class IamModule {}
