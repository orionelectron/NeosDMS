import { randomUUID } from 'crypto';
import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { AuditService } from '../audit/audit.service';
import { NepaliDateConverter } from '../nepali-date/nepali-date-converter';
import { DocumentSequenceService } from './document-sequence.service';
import { AccountEntity } from './entities/account.entity';
import { FiscalPeriodEntity } from './entities/fiscal-period.entity';
import { FiscalYearEntity } from './entities/fiscal-year.entity';
import { JournalEntryEntity } from './entities/journal-entry.entity';
import { JournalLineEntity } from './entities/journal-line.entity';
import {
  FiscalPeriodLockedException,
  GroupAccountPostingException,
  InvalidAccountForPostingException,
  JournalAlreadyPostedException,
  JournalNotDraftException,
  UnbalancedJournalException,
} from './accounting.errors';
import { JournalService } from './journal.service';

type AnyEntity = { id?: string };

function makeEntity<T extends object>(
  Entity: new () => T,
  data: Partial<T>,
): T {
  return Object.assign(Object.create(Entity.prototype as object) as T, data);
}

interface Store {
  accounts: AccountEntity[];
  fiscalYears: FiscalYearEntity[];
  fiscalPeriods: FiscalPeriodEntity[];
  entries: JournalEntryEntity[];
  lines: JournalLineEntity[];
}

function valueMatches(
  item: Record<string, unknown>,
  key: string,
  value: unknown,
): boolean {
  const current = item[key];
  if (value && typeof value === 'object') {
    const op = (value as { _type?: string })._type;
    const operand = (value as { _value?: unknown })._value;
    if (op === 'in') return Array.isArray(operand) && operand.includes(current);
    if (op === 'lessThanOrEqual')
      return (current as Date).getTime() <= (operand as Date).getTime();
    if (op === 'moreThanOrEqual')
      return (current as Date).getTime() >= (operand as Date).getTime();
  }
  return current === value;
}

function createRepo<T extends AnyEntity>(rows: T[]) {
  return {
    create: jest.fn((data: Partial<T>) => ({ ...data }) as T),
    save: jest.fn((entity: T | T[]) => {
      const list = Array.isArray(entity) ? entity : [entity];
      for (const item of list) {
        if (!item.id) {
          item.id = randomUUID();
          rows.push(item);
        } else {
          const index = rows.findIndex((row) => row.id === item.id);
          if (index === -1) rows.push(item);
          else rows[index] = item;
        }
      }
      return entity;
    }),
    find: jest.fn((options: { where?: Record<string, unknown> }) => {
      const where = options?.where ?? {};
      return rows.filter((item) =>
        Object.entries(where).every(([key, value]) =>
          valueMatches(item as Record<string, unknown>, key, value),
        ),
      );
    }),
    findOne: jest.fn((options: { where?: Record<string, unknown> }) => {
      const where = options?.where ?? {};
      return (
        rows.find((item) =>
          Object.entries(where).every(([key, value]) =>
            valueMatches(item as Record<string, unknown>, key, value),
          ),
        ) ?? null
      );
    }),
    count: jest.fn((options: { where?: Record<string, unknown> }) => {
      const where = options?.where ?? {};
      return rows.filter((item) =>
        Object.entries(where).every(([key, value]) =>
          valueMatches(item as Record<string, unknown>, key, value),
        ),
      ).length;
    }),
  };
}

function createManager(store: Store) {
  const listFor = (Entity: new () => unknown): AnyEntity[] => {
    if (Entity === AccountEntity) return store.accounts;
    if (Entity === FiscalYearEntity) return store.fiscalYears;
    if (Entity === FiscalPeriodEntity) return store.fiscalPeriods;
    if (Entity === JournalEntryEntity) return store.entries;
    if (Entity === JournalLineEntity) return store.lines;
    return [];
  };

  const repos = new Map<new () => unknown, unknown>();
  return {
    manager: {
      getRepository: jest.fn((Entity: new () => unknown) => {
        if (!repos.has(Entity)) {
          repos.set(Entity, createRepo(listFor(Entity)));
        }
        return repos.get(Entity);
      }),
    },
    listFor,
  };
}

function seedStore(): Store {
  return {
    accounts: [
      makeEntity(AccountEntity, {
        id: 'acc-cash',
        organizationId: 'org-1',
        code: '1101',
        isGroup: false,
        isActive: true,
      }),
      makeEntity(AccountEntity, {
        id: 'acc-ap',
        organizationId: 'org-1',
        code: '2101',
        isGroup: false,
        isActive: true,
      }),
      makeEntity(AccountEntity, {
        id: 'acc-group',
        organizationId: 'org-1',
        code: '1100',
        isGroup: true,
        isActive: true,
      }),
      makeEntity(AccountEntity, {
        id: 'acc-inactive',
        organizationId: 'org-1',
        code: '5103',
        isGroup: false,
        isActive: false,
      }),
    ],
    fiscalYears: [
      makeEntity(FiscalYearEntity, {
        id: 'fy-1',
        organizationId: 'org-1',
        name: '2083/84',
        startDate: new Date(2026, 3, 14),
        endDate: new Date(2027, 3, 13),
        isActive: true,
        isClosed: false,
      }),
    ],
    fiscalPeriods: [
      makeEntity(FiscalPeriodEntity, {
        id: 'fp-1',
        fiscalYearId: 'fy-1',
        name: 'Baishakh',
        sequence: 1,
        startDateBs: '2083-01-01',
        endDateBs: '2083-01-32',
        startDate: new Date(2026, 3, 14),
        endDate: new Date(2026, 4, 13),
        isLocked: false,
      }),
    ],
    entries: [],
    lines: [],
  };
}

function draftEntry(
  status: 'DRAFT' | 'POSTED' | 'CANCELLED',
): JournalEntryEntity {
  return makeEntity(JournalEntryEntity, {
    id: 'entry-1',
    organizationId: 'org-1',
    branchId: 'branch-1',
    fiscalYearId: 'fy-1',
    fiscalPeriodId: 'fp-1',
    entryDate: new Date(2026, 3, 20),
    status,
    lines: [
      makeEntity(JournalLineEntity, {
        id: 'line-1',
        organizationId: 'org-1',
        accountId: 'acc-cash',
        debitAmount: '1000.0000',
        creditAmount: '0.0000',
      }),
      makeEntity(JournalLineEntity, {
        id: 'line-2',
        organizationId: 'org-1',
        accountId: 'acc-ap',
        debitAmount: '0.0000',
        creditAmount: '1000.0000',
      }),
    ],
  });
}

describe('JournalService', () => {
  const orgId = 'org-1';
  const branchId = 'branch-1';
  const input = {
    branchId,
    entryDate: '2026-04-20',
    description: 'Test entry',
    lines: [
      { accountId: 'acc-cash', debit: 1000 },
      { accountId: 'acc-ap', credit: 1000 },
    ],
  };

  let service: JournalService;
  let store: Store;
  let manager: ReturnType<typeof createManager>['manager'];
  let nextNumber: jest.Mock;
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    store = seedStore();
    manager = createManager(store).manager;
    dataSource = {
      transaction: jest.fn((fn: (m: unknown) => unknown) => fn(manager)),
    };
    nextNumber = jest.fn().mockResolvedValue('JE-0001');

    const moduleRef = await Test.createTestingModule({
      providers: [
        JournalService,
        { provide: getDataSourceToken(), useValue: dataSource },
        {
          provide: getRepositoryToken(JournalEntryEntity),
          useValue: manager.getRepository(JournalEntryEntity),
        },
        {
          provide: DocumentSequenceService,
          useValue: { nextNumber },
        },
        { provide: NepaliDateConverter, useValue: new NepaliDateConverter() },
        {
          provide: AuditService,
          useValue: { record: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = moduleRef.get(JournalService);
  });

  describe('createDraft', () => {
    it('creates a balanced draft and resolves fiscal context', async () => {
      const entry = await service.createDraft(orgId, input, 'user-1');

      expect(entry.status).toBe('DRAFT');
      expect(entry.referenceNumber).toBeNull();
      expect(entry.fiscalYearId).toBe('fy-1');
      expect(entry.fiscalPeriodId).toBe('fp-1');
      expect(entry.entryDateBs).toMatch(/^2083-\d{2}-\d{2}$/);
      expect(store.lines).toHaveLength(2);
    });

    it('rejects an unbalanced entry', async () => {
      await expect(
        service.createDraft(
          orgId,
          {
            ...input,
            lines: [
              { accountId: 'acc-cash', debit: 100 },
              { accountId: 'acc-ap', credit: 50 },
            ],
          },
          'user-1',
        ),
      ).rejects.toThrow(UnbalancedJournalException);
      expect(store.entries).toHaveLength(0);
    });

    it('rejects posting lines against a group account', async () => {
      await expect(
        service.createDraft(
          orgId,
          {
            ...input,
            lines: [
              { accountId: 'acc-cash', debit: 100 },
              { accountId: 'acc-group', credit: 100 },
            ],
          },
          'user-1',
        ),
      ).rejects.toThrow(GroupAccountPostingException);
    });

    it('rejects an inactive account', async () => {
      await expect(
        service.createDraft(
          orgId,
          {
            ...input,
            lines: [
              { accountId: 'acc-cash', debit: 100 },
              { accountId: 'acc-inactive', credit: 100 },
            ],
          },
          'user-1',
        ),
      ).rejects.toThrow(InvalidAccountForPostingException);
    });
  });

  describe('post', () => {
    it('posts a draft and assigns the JE reference number', async () => {
      store.entries.push(draftEntry('DRAFT'));

      const entry = await service.post(orgId, 'entry-1', 'user-1');

      expect(entry.status).toBe('POSTED');
      expect(entry.referenceNumber).toBe('JE-0001');
      expect(entry.fiscalYearId).toBe('fy-1');
      expect(nextNumber).toHaveBeenCalledWith(
        expect.objectContaining({ documentType: 'journal_entry' }),
        manager,
      );
    });

    it('rejects posting an already-posted entry', async () => {
      store.entries.push(draftEntry('POSTED'));
      await expect(service.post(orgId, 'entry-1', 'user-1')).rejects.toThrow(
        JournalAlreadyPostedException,
      );
    });

    it('rejects posting into a locked fiscal period', async () => {
      store.fiscalPeriods[0].isLocked = true;
      store.entries.push(draftEntry('DRAFT'));

      await expect(service.post(orgId, 'entry-1', 'user-1')).rejects.toThrow(
        FiscalPeriodLockedException,
      );
    });
  });

  describe('cancel', () => {
    it('cancels a draft entry', async () => {
      store.entries.push(draftEntry('DRAFT'));

      const entry = await service.cancel(orgId, 'entry-1', 'user-1');

      expect(entry.status).toBe('CANCELLED');
    });

    it('rejects cancelling a posted entry', async () => {
      store.entries.push(draftEntry('POSTED'));
      await expect(service.cancel(orgId, 'entry-1', 'user-1')).rejects.toThrow(
        JournalNotDraftException,
      );
    });
  });
});
