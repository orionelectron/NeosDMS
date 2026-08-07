import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { AuditService } from '../audit/audit.service';
import {
  AccountCodeAlreadyUsedException,
  AccountHasChildrenException,
  AccountInUseException,
  AccountNotFoundException,
  AccountParentMustBeGroupException,
  SystemAccountProtectedException,
} from './accounting.errors';
import { AccountService } from './account.service';
import { AccountEntity } from './entities/account.entity';
import { JournalLineEntity } from './entities/journal-line.entity';
import {
  createFakeManager,
  makeEntity,
  type FakeManager,
  type FakeRepo,
} from '../testing/accounting-fakes';

describe('AccountService', () => {
  const orgId = 'org-1';
  const actorId = 'user-1';

  let service: AccountService;
  let manager: FakeManager;
  let getRepo: ReturnType<typeof createFakeManager>['repo'];
  let accountRepo: FakeRepo<AccountEntity>;
  let audit: { record: jest.Mock };

  const groupAccount = () =>
    makeEntity(AccountEntity, {
      id: 'acc-group',
      organizationId: orgId,
      code: '1000',
      name: 'Assets',
      coaType: 'asset',
      isGroup: true,
      isActive: true,
      isSystemAccount: false,
      isLocked: false,
      level: 1,
      path: '1000',
    });

  const leafAccount = () =>
    makeEntity(AccountEntity, {
      id: 'acc-leaf',
      organizationId: orgId,
      code: '1001',
      name: 'Bank',
      coaType: 'asset',
      isGroup: false,
      isActive: true,
      isSystemAccount: false,
      isLocked: false,
      level: 2,
      path: '1000/1001',
      parentAccountId: 'acc-group',
    });

  beforeEach(async () => {
    const { manager: m, repo } = createFakeManager();
    manager = m;
    getRepo = repo;
    accountRepo = repo(AccountEntity);
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    const dataSource = {
      transaction: jest.fn((fn: (m: unknown) => unknown) => fn(manager)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AccountService,
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: getRepositoryToken(AccountEntity), useValue: accountRepo },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = moduleRef.get(AccountService);
  });

  describe('listAccounts', () => {
    it('filters by organization, parent, type and search', async () => {
      const rows = [leafAccount()];
      const qb: {
        where: jest.Mock;
        andWhere: jest.Mock;
        orderBy: jest.Mock;
        addOrderBy: jest.Mock;
        getMany: jest.Mock;
      } = {
        where: jest.fn(() => qb),
        andWhere: jest.fn(() => qb),
        orderBy: jest.fn(() => qb),
        addOrderBy: jest.fn(() => qb),
        getMany: jest.fn(() => rows),
      };
      accountRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.listAccounts(orgId, {
        parentId: 'acc-group',
        coaType: 'asset',
        search: 'bank',
      });

      expect(result).toBe(rows);
      expect(qb.where).toHaveBeenCalledWith(
        'account.organizationId = :organizationId',
        { organizationId: orgId },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'account.parentAccountId = :parentId',
        { parentId: 'acc-group' },
      );
      expect(qb.andWhere).toHaveBeenCalledWith('account.coaType = :coaType', {
        coaType: 'asset',
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        '(account.name ILIKE :search OR account.code ILIKE :search)',
        { search: '%bank%' },
      );
      expect(qb.orderBy).toHaveBeenCalledWith('account.path', 'ASC');
      expect(qb.addOrderBy).toHaveBeenCalledWith('account.code', 'ASC');
    });
  });

  describe('getAccount', () => {
    it('returns an account for the organization', async () => {
      accountRepo.rows.push(leafAccount());
      await expect(
        service.getAccount(orgId, 'acc-leaf'),
      ).resolves.toMatchObject({
        id: 'acc-leaf',
        code: '1001',
      });
    });

    it('throws AccountNotFoundException when missing', async () => {
      await expect(service.getAccount(orgId, 'nope')).rejects.toThrow(
        AccountNotFoundException,
      );
    });
  });

  describe('createAccount', () => {
    it('creates a root-level leaf account and audits', async () => {
      const account = await service.createAccount(
        orgId,
        { name: 'Petty Cash', code: '1102', coaType: 'asset' },
        actorId,
      );

      expect(account).toMatchObject({
        organizationId: orgId,
        name: 'Petty Cash',
        code: '1102',
        coaType: 'asset',
        parentAccountId: null,
        level: 1,
        path: '1102',
        isSystemAccount: false,
        isActive: true,
      });
      expect(accountRepo.rows).toContainEqual(account);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'accounting.account.create' }),
        manager,
      );
    });

    it('creates a child under a group parent with level and path maintained', async () => {
      accountRepo.rows.push(groupAccount());

      const account = await service.createAccount(
        orgId,
        {
          name: 'Cash',
          code: '1100',
          coaType: 'asset',
          parentAccountId: 'acc-group',
        },
        actorId,
      );

      expect(account).toMatchObject({
        parentAccountId: 'acc-group',
        level: 2,
        path: '1000/1100',
      });
    });

    it('rejects a duplicate code', async () => {
      accountRepo.rows.push(leafAccount());

      await expect(
        service.createAccount(
          orgId,
          { name: 'Dup', code: '1001', coaType: 'asset' },
          actorId,
        ),
      ).rejects.toThrow(AccountCodeAlreadyUsedException);
      expect(accountRepo.rows).toHaveLength(1);
    });

    it('rejects a non-group parent', async () => {
      accountRepo.rows.push(leafAccount());

      await expect(
        service.createAccount(
          orgId,
          {
            name: 'Child',
            code: '1002',
            coaType: 'asset',
            parentAccountId: 'acc-leaf',
          },
          actorId,
        ),
      ).rejects.toThrow(AccountParentMustBeGroupException);
    });

    it('rejects a missing parent', async () => {
      await expect(
        service.createAccount(
          orgId,
          {
            name: 'Child',
            code: '1002',
            coaType: 'asset',
            parentAccountId: 'nope',
          },
          actorId,
        ),
      ).rejects.toThrow(AccountNotFoundException);
    });
  });

  describe('updateAccount', () => {
    it('updates name and active flag', async () => {
      accountRepo.rows.push(leafAccount());

      const updated = await service.updateAccount(
        orgId,
        'acc-leaf',
        { name: 'NMB Bank', isActive: false },
        actorId,
      );

      expect(updated).toMatchObject({ name: 'NMB Bank', isActive: false });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'accounting.account.update' }),
        manager,
      );
    });

    it('reparenting recomputes level and path', async () => {
      accountRepo.rows.push(groupAccount());
      accountRepo.rows.push(
        makeEntity(AccountEntity, {
          id: 'acc-root',
          organizationId: orgId,
          code: '5000',
          name: 'Other',
          coaType: 'expense',
          isGroup: false,
          isActive: true,
          isSystemAccount: false,
          isLocked: false,
          level: 1,
          path: '5000',
        }),
      );

      const updated = await service.updateAccount(
        orgId,
        'acc-root',
        { parentAccountId: 'acc-group' },
        actorId,
      );

      expect(updated).toMatchObject({
        parentAccountId: 'acc-group',
        level: 2,
        path: '1000/5000',
      });
    });

    it('moving to root clears the parent', async () => {
      accountRepo.rows.push(leafAccount());

      const updated = await service.updateAccount(
        orgId,
        'acc-leaf',
        { parentAccountId: null },
        actorId,
      );

      expect(updated).toMatchObject({
        parentAccountId: null,
        level: 1,
        path: '1001',
      });
    });

    it('rejects a self-parent', async () => {
      accountRepo.rows.push(leafAccount());

      await expect(
        service.updateAccount(
          orgId,
          'acc-leaf',
          { parentAccountId: 'acc-leaf' },
          actorId,
        ),
      ).rejects.toThrow(AccountParentMustBeGroupException);
    });

    it('protects system accounts', async () => {
      accountRepo.rows.push(
        makeEntity(AccountEntity, {
          id: 'acc-sys',
          organizationId: orgId,
          code: '9001',
          isSystemAccount: true,
          isLocked: true,
          isActive: true,
        }),
      );

      await expect(
        service.updateAccount(orgId, 'acc-sys', { name: 'Hacked' }, actorId),
      ).rejects.toThrow(SystemAccountProtectedException);
    });

    it('throws AccountNotFoundException when missing', async () => {
      await expect(
        service.updateAccount(orgId, 'nope', { name: 'X' }, actorId),
      ).rejects.toThrow(AccountNotFoundException);
    });
  });

  describe('deleteAccount', () => {
    it('soft-deletes a leaf account with no journal usage and audits', async () => {
      accountRepo.rows.push(leafAccount());

      await service.deleteAccount(orgId, 'acc-leaf', actorId);

      expect(accountRepo.rows).toHaveLength(0);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'accounting.account.delete' }),
      );
    });

    it('rejects deleting an account with children', async () => {
      accountRepo.rows.push(groupAccount());
      accountRepo.rows.push(leafAccount());

      await expect(
        service.deleteAccount(orgId, 'acc-group', actorId),
      ).rejects.toThrow(AccountHasChildrenException);
    });

    it('rejects deleting an account used in journal lines', async () => {
      accountRepo.rows.push(leafAccount());
      getRepo(JournalLineEntity).rows.push(
        makeEntity(JournalLineEntity, {
          id: 'line-1',
          organizationId: orgId,
          accountId: 'acc-leaf',
        }),
      );

      await expect(
        service.deleteAccount(orgId, 'acc-leaf', actorId),
      ).rejects.toThrow(AccountInUseException);
    });

    it('protects system accounts', async () => {
      accountRepo.rows.push(
        makeEntity(AccountEntity, {
          id: 'acc-sys',
          organizationId: orgId,
          code: '9001',
          isSystemAccount: true,
          isLocked: true,
        }),
      );

      await expect(
        service.deleteAccount(orgId, 'acc-sys', actorId),
      ).rejects.toThrow(SystemAccountProtectedException);
    });

    it('throws AccountNotFoundException when missing', async () => {
      await expect(
        service.deleteAccount(orgId, 'nope', actorId),
      ).rejects.toThrow(AccountNotFoundException);
    });
  });
});
