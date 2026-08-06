import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { SubscriptionEntity } from '../subscription/entities/subscription.entity';
import { BranchEntity } from '../tenancy/entities/branch.entity';
import { OrganizationEntity } from '../tenancy/entities/organization.entity';
import { TenancyService } from '../tenancy/tenancy.service';
import {
  AccountDisabledException,
  ExpiredRefreshTokenException,
  InvalidCredentialsException,
  InvalidRefreshTokenException,
  RevokedRefreshTokenException,
} from './auth.errors';
import { AuditService } from './audit/audit.service';
import { SUPERUSER_ROLE_CODE } from './auth.constants';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshSessionEntity } from './entities/refresh-session.entity';
import { RoleEntity } from './entities/role.entity';
import { UserEntity } from './entities/user.entity';
import { IamService } from './iam.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

export interface RequestMeta {
  ip?: string | null;
  userAgent?: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  expiresAt: Date;
}

export interface PublicUser {
  id: string;
  organizationId: string;
  branchId: string;
  roleId: string | null;
  roleCode: string | null;
  fullName: string;
  email: string;
  username: string | null;
  isOwner: boolean;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
}

export interface RegisterResult {
  organization: OrganizationEntity;
  branch: BranchEntity;
  subscription: SubscriptionEntity;
  user: PublicUser;
  tokens: AuthTokens;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(RefreshSessionEntity)
    private readonly refreshSessionRepo: Repository<RefreshSessionEntity>,
    private readonly tenancyService: TenancyService,
    private readonly iamService: IamService,
    private readonly tokenService: TokenService,
    private readonly passwordService: PasswordService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Full org onboarding: org + main branch + trial subscription + base roles
   * + owner ADMIN user, all in one transaction. Auto-issues tokens.
   */
  async register(dto: RegisterDto, meta: RequestMeta): Promise<RegisterResult> {
    return this.dataSource.transaction(async (manager) => {
      const { organization, branch, subscription } =
        await this.tenancyService.onboard(dto, manager);

      await this.iamService.ensureBaseRolesForOrg(organization.id, manager);

      const adminRole = await manager.getRepository(RoleEntity).findOne({
        where: {
          organizationId: organization.id,
          code: SUPERUSER_ROLE_CODE,
        },
      });

      const owner = await this.iamService.createUserTx(manager, {
        organizationId: organization.id,
        branchId: branch.id,
        roleId: adminRole?.id ?? null,
        fullName: dto.owner.fullName,
        email: dto.owner.email,
        password: dto.owner.password,
        isOwner: true,
      });

      const tokens = await this.issueTokens(manager, owner, meta);

      await this.auditService.record(
        {
          organizationId: organization.id,
          branchId: branch.id,
          userId: owner.id,
          action: 'auth.register',
          entityType: 'organization',
          entityId: organization.id,
          ipAddress: meta.ip ?? null,
        },
        manager,
      );

      return {
        organization,
        branch,
        subscription,
        user: this.toPublicUser(owner),
        tokens,
      };
    });
  }

  async login(
    dto: LoginDto,
    meta: RequestMeta,
  ): Promise<{
    user: PublicUser;
    tokens: AuthTokens;
  }> {
    const user = await this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .leftJoinAndSelect('user.role', 'role')
      .where('user.email = :email', { email: dto.email.toLowerCase() })
      .getOne();
    if (!user) throw new InvalidCredentialsException();

    const valid = await this.passwordService.compare(
      dto.password,
      user.passwordHash,
    );
    if (!valid) throw new InvalidCredentialsException();
    if (!user.isActive) throw new AccountDisabledException();

    await this.userRepo.update({ id: user.id }, { lastLoginAt: new Date() });

    const tokens = await this.dataSource.transaction(async (manager) =>
      this.issueTokens(manager, user, meta),
    );

    await this.auditService.record({
      organizationId: user.organizationId,
      branchId: user.branchId,
      userId: user.id,
      action: 'auth.login',
      entityType: 'user',
      entityId: user.id,
      ipAddress: meta.ip ?? null,
    });

    return { user: this.toPublicUser(user), tokens };
  }

  /** Rotates the refresh session and returns a fresh token pair. */
  async refresh(rawToken: string, meta: RequestMeta): Promise<AuthTokens> {
    const tokenHash = this.tokenService.hashToken(rawToken);

    return this.dataSource.transaction(async (manager) => {
      const sessionRepo = manager.getRepository(RefreshSessionEntity);
      const session = await sessionRepo.findOne({
        where: { tokenHash },
        relations: { user: true },
      });
      if (!session) throw new InvalidRefreshTokenException();
      if (session.revokedAt) throw new RevokedRefreshTokenException();
      if (session.expiresAt.getTime() < Date.now()) {
        throw new ExpiredRefreshTokenException();
      }
      const user = session.user;
      if (!user.isActive) throw new AccountDisabledException();

      await sessionRepo.update({ id: session.id }, { revokedAt: new Date() });

      return this.issueTokens(manager, user, meta);
    });
  }

  async logout(rawToken: string): Promise<void> {
    const tokenHash = this.tokenService.hashToken(rawToken);
    await this.refreshSessionRepo.update(
      { tokenHash, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  private async issueTokens(
    manager: EntityManager,
    user: UserEntity,
    meta: RequestMeta,
  ): Promise<AuthTokens> {
    const sessionRepo = manager.getRepository(RefreshSessionEntity);

    const expiresAt = new Date(
      Date.now() +
        this.tokenService.refreshTokenTtlDays() * 24 * 60 * 60 * 1000,
    );
    const refreshToken = this.tokenService.generateRefreshToken();
    const session = await sessionRepo.save(
      sessionRepo.create({
        userId: user.id,
        tokenHash: this.tokenService.hashToken(refreshToken),
        expiresAt,
        ipAddress: meta.ip ?? null,
        userAgent: meta.userAgent ?? null,
      }),
    );

    return {
      accessToken: this.tokenService.signAccessToken(user),
      refreshToken,
      sessionId: session.id,
      expiresAt,
    };
  }

  toPublicUser(user: UserEntity): PublicUser {
    return {
      id: user.id,
      organizationId: user.organizationId,
      branchId: user.branchId,
      roleId: user.role?.id ?? null,
      roleCode: user.role?.code ?? null,
      fullName: user.fullName,
      email: user.email,
      username: user.username,
      isOwner: user.isOwner,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
      lastLoginAt: user.lastLoginAt,
    };
  }
}
