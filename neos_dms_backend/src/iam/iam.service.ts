import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import {
  BASE_ROLES,
  PERMISSIONS,
  expandGlobs,
  type RoleDefinition,
} from '../database/seeders/permissions';
import { BranchEntity } from '../tenancy/entities/branch.entity';
import { ModuleEntity } from '../tenancy/entities/module.entity';
import { AuditService } from './audit/audit.service';
import { SUPERUSER_ROLE_CODE } from './auth.constants';
import {
  EmailAlreadyUsedException,
  InvalidCredentialsException,
} from './auth.errors';
import { PermissionEntity } from './entities/permission.entity';
import { RefreshSessionEntity } from './entities/refresh-session.entity';
import { RolePermissionMappingEntity } from './entities/role-permission-mapping.entity';
import { RoleEntity } from './entities/role.entity';
import { UserEntity } from './entities/user.entity';
import {
  BranchNotFoundException,
  CannotDeleteSelfException,
  PermissionNotFoundException,
  RoleCodeAlreadyUsedException,
  RoleNotFoundException,
  SystemRoleProtectedException,
  UserNotFoundException,
} from './iam.errors';
import { PasswordService } from './password.service';
import { PlanLimitService } from '../subscription/plan-limits/plan-limit.service';

export interface CreateUserInput {
  organizationId: string;
  branchId: string;
  roleId: string | null;
  fullName: string;
  email: string;
  password: string;
  username?: string | null;
  isOwner?: boolean;
  mustChangePassword?: boolean;
}

export interface UpdateUserInput {
  branchId?: string;
  roleId?: string | null;
  fullName?: string;
  email?: string;
  username?: string | null;
  isActive?: boolean;
}

export interface CreateRoleInput {
  code: string;
  name: string;
  description?: string | null;
  permissionCodes: string[];
}

export interface PermissionGroup {
  module: string;
  permissions: string[];
}

@Injectable()
export class IamService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
    @InjectRepository(PermissionEntity)
    private readonly permissionRepo: Repository<PermissionEntity>,
    @InjectRepository(RolePermissionMappingEntity)
    private readonly mappingRepo: Repository<RolePermissionMappingEntity>,
    @InjectRepository(RefreshSessionEntity)
    private readonly refreshSessionRepo: Repository<RefreshSessionEntity>,
    private readonly passwordService: PasswordService,
    private readonly planLimitService: PlanLimitService,
    private readonly auditService: AuditService,
  ) {}

  /** Seed the global permission catalog (idempotent). Returns all codes. */
  async ensurePermissionCatalog(): Promise<PermissionEntity[]> {
    const existing = await this.permissionRepo.find();
    const known = new Set(existing.map((p) => p.code));
    const missing = PERMISSIONS.filter((code) => !known.has(code));
    if (missing.length === 0) return existing;

    const modules = await this.permissionRepo.manager
      .getRepository(ModuleEntity)
      .find();

    const newPermissions = missing.map((code) => {
      const moduleCode = code.split('.')[0];
      const module = modules.find((m) => m.code === moduleCode);
      return this.permissionRepo.create({
        moduleId: module?.id,
        code,
        description: null,
      });
    });
    await this.permissionRepo.save(newPermissions);
    return this.permissionRepo.find();
  }

  /**
   * Idempotently create the org's base roles + permission mappings. Runs in
   * the caller's transaction when a `manager` is passed (onboarding). The
   * `admin` role is superuser by code and needs no mappings.
   */
  async ensureBaseRolesForOrg(
    organizationId: string,
    manager?: EntityManager,
  ): Promise<void> {
    const roleRepo = manager
      ? manager.getRepository(RoleEntity)
      : this.roleRepo;

    for (const def of BASE_ROLES) {
      const existing = await roleRepo.findOne({
        where: { organizationId, code: def.code },
      });
      if (existing) continue;

      const role = await roleRepo.save(
        roleRepo.create({
          organizationId,
          code: def.code,
          name: def.name,
          description: null,
          isSystem: true,
          isActive: true,
        }),
      );

      if (def.code === SUPERUSER_ROLE_CODE) continue;
      await this.assignPermissionsToRole(role, def, manager);
    }
  }

  private async assignPermissionsToRole(
    role: RoleEntity,
    def: RoleDefinition,
    manager?: EntityManager,
  ): Promise<void> {
    const permissionRepo = manager
      ? manager.getRepository(PermissionEntity)
      : this.permissionRepo;
    const mappingRepo = manager
      ? manager.getRepository(RolePermissionMappingEntity)
      : this.mappingRepo;

    const codes = expandGlobs(def.permissions, PERMISSIONS);
    if (codes.length === 0) return;
    const permissions = await permissionRepo.find({
      where: { code: In(codes) },
    });
    if (permissions.length !== codes.length) {
      const found = new Set(permissions.map((p) => p.code));
      throw new PermissionNotFoundException(
        codes.find((code) => !found.has(code)),
      );
    }
    await mappingRepo.save(
      permissions.map((permission) =>
        mappingRepo.create({ roleId: role.id, permissionId: permission.id }),
      ),
    );
  }

  // ---------- Users ----------

  async createUser(
    input: CreateUserInput,
    actorId: string,
    ipAddress?: string | null,
  ): Promise<UserEntity> {
    return this.dataSource.transaction(async (manager) => {
      const user = await this.createUserTx(manager, input);
      await this.auditService.record(
        {
          organizationId: input.organizationId,
          branchId: input.branchId,
          userId: actorId,
          action: 'iam.user.create',
          entityType: 'user',
          entityId: user.id,
          newData: { fullName: user.fullName, email: user.email },
          ipAddress,
        },
        manager,
      );
      return user;
    });
  }

  /** Internal create used by both the admin path and org registration. */
  async createUserTx(
    manager: EntityManager,
    input: CreateUserInput,
  ): Promise<UserEntity> {
    const userRepo = manager.getRepository(UserEntity);
    const branchRepo = manager.getRepository(BranchEntity);
    const roleRepo = manager.getRepository(RoleEntity);

    const existing = await userRepo.findOne({ where: { email: input.email } });
    if (existing) throw new EmailAlreadyUsedException();

    const branch = await branchRepo.findOne({
      where: { id: input.branchId, organizationId: input.organizationId },
    });
    if (!branch) throw new BranchNotFoundException();

    if (input.roleId) {
      const role = await roleRepo.findOne({
        where: { id: input.roleId, organizationId: input.organizationId },
      });
      if (!role) throw new RoleNotFoundException();
    }

    const currentCount = await userRepo.count({
      where: { organizationId: input.organizationId },
    });
    await this.planLimitService.assertSeat(
      input.organizationId,
      'users',
      currentCount,
      manager,
    );

    const passwordHash = await this.passwordService.hash(input.password);
    const user = await userRepo.save(
      userRepo.create({
        organizationId: input.organizationId,
        branchId: input.branchId,
        roleId: input.roleId,
        fullName: input.fullName,
        email: input.email.toLowerCase(),
        username: input.username ?? null,
        passwordHash,
        isOwner: input.isOwner ?? false,
        isActive: true,
        mustChangePassword: input.mustChangePassword ?? false,
        lastLoginAt: null,
      }),
    );

    return user;
  }

  async listUsers(
    organizationId: string,
    page: number,
    limit: number,
    search?: string,
  ): Promise<[UserEntity[], number]> {
    const qb = this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .where('user.organizationId = :organizationId', { organizationId });

    if (search) {
      qb.andWhere(
        '(user.fullName ILIKE :search OR user.email ILIKE :search OR user.username ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [rows, total] = await qb
      .orderBy('user.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return [rows, total];
  }

  async getUser(organizationId: string, userId: string): Promise<UserEntity> {
    const user = await this.userRepo.findOne({
      where: { id: userId, organizationId },
      relations: { role: true },
    });
    if (!user) throw new UserNotFoundException();
    return user;
  }

  async updateUser(
    organizationId: string,
    userId: string,
    input: UpdateUserInput,
    actorId: string,
  ): Promise<UserEntity> {
    return this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(UserEntity);
      const user = await userRepo.findOne({
        where: { id: userId, organizationId },
      });
      if (!user) throw new UserNotFoundException();

      if (input.branchId !== undefined) {
        const branch = await manager.getRepository(BranchEntity).findOne({
          where: { id: input.branchId, organizationId },
        });
        if (!branch) throw new BranchNotFoundException();
      }
      if (input.roleId !== undefined && input.roleId !== null) {
        const role = await manager.getRepository(RoleEntity).findOne({
          where: { id: input.roleId, organizationId },
        });
        if (!role) throw new RoleNotFoundException();
      }
      if (input.email !== undefined && input.email !== user.email) {
        const conflict = await userRepo.findOne({
          where: { email: input.email },
        });
        if (conflict && conflict.id !== user.id)
          throw new EmailAlreadyUsedException();
      }

      const before = {
        fullName: user.fullName,
        email: user.email,
        isActive: user.isActive,
      };
      Object.assign(user, {
        ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
        ...(input.roleId !== undefined ? { roleId: input.roleId } : {}),
        ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
        ...(input.email !== undefined
          ? { email: input.email.toLowerCase() }
          : {}),
        ...(input.username !== undefined ? { username: input.username } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      });
      const updated = await userRepo.save(user);

      await this.auditService.record(
        {
          organizationId,
          branchId: updated.branchId,
          userId: actorId,
          action: 'iam.user.update',
          entityType: 'user',
          entityId: updated.id,
          oldData: before,
          newData: {
            fullName: updated.fullName,
            email: updated.email,
            isActive: updated.isActive,
          },
        },
        manager,
      );
      return updated;
    });
  }

  async removeUser(
    organizationId: string,
    userId: string,
    actorId: string,
  ): Promise<void> {
    if (userId === actorId) throw new CannotDeleteSelfException();
    const user = await this.userRepo.findOne({
      where: { id: userId, organizationId },
    });
    if (!user) throw new UserNotFoundException();

    await this.userRepo.softDelete({ id: userId });
    await this.refreshSessionRepo.delete({ userId });

    await this.auditService.record({
      organizationId,
      branchId: user.branchId,
      userId: actorId,
      action: 'iam.user.delete',
      entityType: 'user',
      entityId: userId,
      oldData: { email: user.email },
    });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id: userId })
      .getOne();
    if (!user) throw new UserNotFoundException();

    const valid = await this.passwordService.compare(
      currentPassword,
      user.passwordHash,
    );
    if (!valid) {
      throw new InvalidCredentialsException();
    }

    const passwordHash = await this.passwordService.hash(newPassword);
    await this.userRepo.update(
      { id: userId },
      { passwordHash, mustChangePassword: false },
    );
  }

  // ---------- Roles ----------

  async listRoles(organizationId: string): Promise<RoleEntity[]> {
    return this.roleRepo.find({
      where: { organizationId },
      order: { isSystem: 'DESC', code: 'ASC' },
    });
  }

  async getRole(organizationId: string, roleId: string): Promise<RoleEntity> {
    const role = await this.roleRepo.findOne({
      where: { id: roleId, organizationId },
      relations: { permissionMappings: { permission: true } },
    });
    if (!role) throw new RoleNotFoundException();
    return role;
  }

  async createRole(
    organizationId: string,
    input: CreateRoleInput,
    actorId: string,
  ): Promise<RoleEntity> {
    return this.dataSource.transaction(async (manager) => {
      const roleRepo = manager.getRepository(RoleEntity);
      const existing = await roleRepo.findOne({
        where: { organizationId, code: input.code },
      });
      if (existing) throw new RoleCodeAlreadyUsedException(input.code);

      const role = await roleRepo.save(
        roleRepo.create({
          organizationId,
          code: input.code,
          name: input.name,
          description: input.description ?? null,
          isSystem: false,
          isActive: true,
        }),
      );

      await this.replaceRolePermissions(role, input.permissionCodes, manager);

      await this.auditService.record(
        {
          organizationId,
          userId: actorId,
          action: 'iam.role.create',
          entityType: 'role',
          entityId: role.id,
          newData: {
            code: role.code,
            name: role.name,
            permissionCodes: input.permissionCodes,
          },
        },
        manager,
      );
      return role;
    });
  }

  async updateRole(
    organizationId: string,
    roleId: string,
    input: {
      name?: string;
      description?: string | null;
      permissionCodes?: string[];
    },
    actorId: string,
  ): Promise<RoleEntity> {
    return this.dataSource.transaction(async (manager) => {
      const roleRepo = manager.getRepository(RoleEntity);
      const role = await roleRepo.findOne({
        where: { id: roleId, organizationId },
      });
      if (!role) throw new RoleNotFoundException();
      if (role.isSystem) throw new SystemRoleProtectedException();

      if (input.name !== undefined) role.name = input.name;
      if (input.description !== undefined) role.description = input.description;
      const updated = await roleRepo.save(role);

      if (input.permissionCodes !== undefined) {
        await this.replaceRolePermissions(
          updated,
          input.permissionCodes,
          manager,
        );
      }

      await this.auditService.record(
        {
          organizationId,
          userId: actorId,
          action: 'iam.role.update',
          entityType: 'role',
          entityId: updated.id,
          newData: {
            code: updated.code,
            name: updated.name,
            permissionCodes: input.permissionCodes,
          },
        },
        manager,
      );
      return updated;
    });
  }

  async deleteRole(
    organizationId: string,
    roleId: string,
    actorId: string,
  ): Promise<void> {
    const role = await this.roleRepo.findOne({
      where: { id: roleId, organizationId },
    });
    if (!role) throw new RoleNotFoundException();
    if (role.isSystem) throw new SystemRoleProtectedException();

    await this.roleRepo.delete({ id: roleId });

    await this.auditService.record({
      organizationId,
      userId: actorId,
      action: 'iam.role.delete',
      entityType: 'role',
      entityId: roleId,
      oldData: { code: role.code, name: role.name },
    });
  }

  private async replaceRolePermissions(
    role: RoleEntity,
    permissionCodes: string[],
    manager: EntityManager,
  ): Promise<void> {
    const mappingRepo = manager.getRepository(RolePermissionMappingEntity);
    const permissionRepo = manager.getRepository(PermissionEntity);

    await mappingRepo.delete({ roleId: role.id });

    const unique = [...new Set(permissionCodes)];
    if (unique.length === 0) return;
    const permissions = await permissionRepo.find({
      where: { code: In(unique) },
    });
    if (permissions.length !== unique.length) {
      const found = new Set(permissions.map((p) => p.code));
      throw new PermissionNotFoundException(
        unique.find((code) => !found.has(code)),
      );
    }
    await mappingRepo.save(
      permissions.map((permission) =>
        mappingRepo.create({ roleId: role.id, permissionId: permission.id }),
      ),
    );
  }

  // ---------- Permissions ----------

  async listPermissions(): Promise<PermissionGroup[]> {
    const permissions = await this.permissionRepo.find();
    const groups = new Map<string, string[]>();
    for (const permission of permissions) {
      const module = permission.code.split('.')[0];
      const list = groups.get(module) ?? [];
      list.push(permission.code);
      groups.set(module, list);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([module, codes]) => ({
        module,
        permissions: codes.sort((a, b) => a.localeCompare(b)),
      }));
  }

  /** Profile for `/auth/me` — user + role + resolved permission codes. */
  async getProfile(
    organizationId: string,
    userId: string,
  ): Promise<{ user: UserEntity; permissions: string[] }> {
    const user = await this.userRepo.findOne({
      where: { id: userId, organizationId },
      relations: { role: { permissionMappings: { permission: true } } },
    });
    if (!user) throw new UserNotFoundException();

    const permissions =
      user.role?.code === SUPERUSER_ROLE_CODE
        ? [...PERMISSIONS]
        : (user.role?.permissionMappings ?? []).map((m) => m.permission.code);

    return { user, permissions };
  }
}
