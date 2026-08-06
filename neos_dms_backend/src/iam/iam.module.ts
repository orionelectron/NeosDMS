import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { AppConfig } from '../config/configuration';
import { NepaliDateModule } from '../nepali-date/nepali-date.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { AuditService } from './audit/audit.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuditLogEntity } from './entities/audit-log.entity';
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
      AuditLogEntity,
    ]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        secret: config.get('jwt', { infer: true }).secret,
      }),
    }),
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
    AuditService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [IamService, AuthService, TokenService],
})
export class IamModule {}
