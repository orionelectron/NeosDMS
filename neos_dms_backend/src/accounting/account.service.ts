import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type { CoaType } from './accounting.constants';
import {
  AccountCodeAlreadyUsedException,
  AccountHasChildrenException,
  AccountInUseException,
  AccountNotFoundException,
  AccountParentMustBeGroupException,
  SystemAccountProtectedException,
} from './accounting.errors';
import { AuditService } from '../audit/audit.service';
import { AccountEntity } from './entities/account.entity';
import { JournalLineEntity } from './entities/journal-line.entity';

export interface CreateAccountInput {
  name: string;
  code: string;
  coaType: CoaType;
  parentAccountId?: string | null;
  branchId?: string | null;
  isGroup?: boolean;
}

export interface UpdateAccountInput {
  name?: string;
  parentAccountId?: string | null;
  isGroup?: boolean;
  isActive?: boolean;
}

export interface ListAccountsQuery {
  parentId?: string;
  coaType?: string;
  search?: string;
}

@Injectable()
export class AccountService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(AccountEntity)
    private readonly accountRepo: Repository<AccountEntity>,
    private readonly auditService: AuditService,
  ) {}

  async listAccounts(
    organizationId: string,
    query: ListAccountsQuery,
  ): Promise<AccountEntity[]> {
    const qb = this.accountRepo
      .createQueryBuilder('account')
      .where('account.organizationId = :organizationId', { organizationId });

    if (query.parentId) {
      qb.andWhere('account.parentAccountId = :parentId', {
        parentId: query.parentId,
      });
    }
    if (query.coaType) {
      qb.andWhere('account.coaType = :coaType', { coaType: query.coaType });
    }
    if (query.search) {
      qb.andWhere(
        '(account.name ILIKE :search OR account.code ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    return qb
      .orderBy('account.path', 'ASC')
      .addOrderBy('account.code', 'ASC')
      .getMany();
  }

  async getAccount(
    organizationId: string,
    accountId: string,
  ): Promise<AccountEntity> {
    const account = await this.accountRepo.findOne({
      where: { id: accountId, organizationId },
    });
    if (!account) throw new AccountNotFoundException(accountId);
    return account;
  }

  async createAccount(
    organizationId: string,
    input: CreateAccountInput,
    actorId: string,
  ): Promise<AccountEntity> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(AccountEntity);

      const conflict = await repo.findOne({
        where: { organizationId, code: input.code },
      });
      if (conflict) throw new AccountCodeAlreadyUsedException(input.code);

      let parentAccountId: string | null = null;
      let level = 1;
      let path = input.code;
      if (input.parentAccountId) {
        const parent = await repo.findOne({
          where: { id: input.parentAccountId, organizationId },
        });
        if (!parent) throw new AccountNotFoundException(input.parentAccountId);
        if (!parent.isGroup)
          throw new AccountParentMustBeGroupException(parent.code);
        parentAccountId = parent.id;
        level = (parent.level ?? 1) + 1;
        path = parent.path ? `${parent.path}/${input.code}` : input.code;
      }

      const account = await repo.save(
        repo.create({
          organizationId,
          parentAccountId,
          name: input.name,
          code: input.code,
          coaType: input.coaType,
          isGroup: input.isGroup ?? false,
          branchId: input.branchId ?? null,
          isSystemAccount: false,
          systemPurpose: null,
          isLocked: false,
          isActive: true,
          level,
          path,
        }),
      );

      await this.auditService.record(
        {
          organizationId,
          userId: actorId,
          action: 'accounting.account.create',
          entityType: 'account',
          entityId: account.id,
          newData: {
            code: account.code,
            name: account.name,
            coaType: account.coaType,
          },
        },
        manager,
      );

      return account;
    });
  }

  async updateAccount(
    organizationId: string,
    accountId: string,
    input: UpdateAccountInput,
    actorId: string,
  ): Promise<AccountEntity> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(AccountEntity);
      const account = await repo.findOne({
        where: { id: accountId, organizationId },
      });
      if (!account) throw new AccountNotFoundException(accountId);
      if (account.isSystemAccount || account.isLocked)
        throw new SystemAccountProtectedException();

      if (input.name !== undefined) account.name = input.name;
      if (input.isGroup !== undefined) account.isGroup = input.isGroup;
      if (input.isActive !== undefined) account.isActive = input.isActive;

      if (input.parentAccountId !== undefined) {
        if (input.parentAccountId === null) {
          account.parentAccountId = null;
          account.level = 1;
          account.path = account.code;
        } else {
          if (input.parentAccountId === account.id)
            throw new AccountParentMustBeGroupException(account.code);
          const parent = await repo.findOne({
            where: { id: input.parentAccountId, organizationId },
          });
          if (!parent)
            throw new AccountNotFoundException(input.parentAccountId);
          if (!parent.isGroup)
            throw new AccountParentMustBeGroupException(parent.code);
          account.parentAccountId = parent.id;
          account.level = (parent.level ?? 1) + 1;
          account.path = parent.path
            ? `${parent.path}/${account.code}`
            : account.code;
        }
      }

      const updated = await repo.save(account);

      await this.auditService.record(
        {
          organizationId,
          userId: actorId,
          action: 'accounting.account.update',
          entityType: 'account',
          entityId: accountId,
          newData: {
            name: updated.name,
            code: updated.code,
            isGroup: updated.isGroup,
            isActive: updated.isActive,
          },
        },
        manager,
      );

      return updated;
    });
  }

  async deleteAccount(
    organizationId: string,
    accountId: string,
    actorId: string,
  ): Promise<void> {
    const account = await this.accountRepo.findOne({
      where: { id: accountId, organizationId },
    });
    if (!account) throw new AccountNotFoundException(accountId);
    if (account.isSystemAccount || account.isLocked)
      throw new SystemAccountProtectedException();

    const childCount = await this.accountRepo.count({
      where: { organizationId, parentAccountId: accountId },
    });
    if (childCount > 0) throw new AccountHasChildrenException(account.code);

    const lineCount = await this.accountRepo.manager
      .getRepository(JournalLineEntity)
      .count({
        where: { organizationId, accountId },
      });
    if (lineCount > 0) throw new AccountInUseException(account.code);

    await this.accountRepo.softDelete({ id: accountId, organizationId });

    await this.auditService.record({
      organizationId,
      userId: actorId,
      action: 'accounting.account.delete',
      entityType: 'account',
      entityId: accountId,
      oldData: { code: account.code, name: account.name },
    });
  }
}
