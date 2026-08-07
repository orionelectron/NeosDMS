import { randomUUID } from 'crypto';
import type { EntityManager } from 'typeorm';
import { NepaliDateConverter } from '../nepali-date/nepali-date-converter';
import { BASE_CURRENCY_CODE } from './accounting.constants';
import { DEFAULT_COA } from './default-coa';
import { AccountEntity } from './entities/account.entity';
import { CurrencyEntity } from './entities/currency.entity';
import { FiscalPeriodEntity } from './entities/fiscal-period.entity';
import { FiscalYearEntity } from './entities/fiscal-year.entity';
import { PaymentMethodEntity } from './entities/payment-method.entity';
import { PaymentTermEntity } from './entities/payment-term.entity';
import { TaxCodeEntity } from './entities/tax-code.entity';
import { TaxTypeEntity } from './entities/tax-type.entity';
import {
  buildFiscalYearPlan,
  provisionAccounting,
  toDateString,
} from './provisioning.logic';

type AnyEntity = { id?: string };

interface FakeRepo {
  create: jest.Mock;
  save: jest.Mock;
  find: jest.Mock;
  findOne: jest.Mock;
  count: jest.Mock;
}

function valueMatches(
  item: Record<string, unknown>,
  key: string,
  value: unknown,
): boolean {
  const current = item[key];
  if (
    value &&
    typeof value === 'object' &&
    (value as { _type?: string })._type
  ) {
    const op = (value as { _type: string })._type;
    if (op === 'isNull') return current === null || current === undefined;
    if (op === 'in')
      return ((value as { _value?: unknown[] })._value ?? []).includes(current);
    return false;
  }
  return current === value;
}

function matchesWhere<T extends AnyEntity>(
  item: T,
  where: Record<string, unknown>,
): boolean {
  return Object.entries(where).every(([key, value]) =>
    valueMatches(item as Record<string, unknown>, key, value),
  );
}

function createRepo<T extends AnyEntity>(rows: T[]): FakeRepo {
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
    find: jest.fn((options: { where?: Record<string, unknown> }) =>
      rows.filter((item) => matchesWhere(item, options?.where ?? {})),
    ),
    findOne: jest.fn(
      (options: { where?: Record<string, unknown> }) =>
        rows.find((item) => matchesWhere(item, options?.where ?? {})) ?? null,
    ),
    count: jest.fn(
      (options: { where?: Record<string, unknown> }) =>
        rows.filter((item) => matchesWhere(item, options?.where ?? {})).length,
    ),
  };
}

function createManager() {
  const repos = new Map<new () => unknown, unknown>();
  const store = new Map<new () => unknown, AnyEntity[]>();
  const listFor = (Entity: new () => unknown): AnyEntity[] => {
    if (!store.has(Entity)) store.set(Entity, []);
    return store.get(Entity) as AnyEntity[];
  };
  return {
    store,
    listFor,
    manager: {
      getRepository: jest.fn((Entity: new () => unknown) => {
        if (!repos.has(Entity)) {
          repos.set(Entity, createRepo(listFor(Entity)));
        }
        return repos.get(Entity);
      }),
    } as unknown as EntityManager,
  };
}

describe('buildFiscalYearPlan', () => {
  const converter = new NepaliDateConverter();

  it('builds a 12-period plan starting on Shrawan 1 (statutory FY start)', () => {
    const plan = buildFiscalYearPlan(2083, converter);

    expect(plan.name).toBe('2083/84');
    expect(plan.startDate.getFullYear()).toBe(2026);
    expect(plan.startDate.getMonth()).toBe(6);
    expect(plan.startDate.getDate()).toBe(17);
    expect(plan.endDate.getFullYear()).toBe(2027);
    expect(plan.endDate.getMonth()).toBe(6);
    expect(plan.endDate.getDate()).toBe(16);
    expect(plan.periods).toHaveLength(12);
    expect(plan.periods[0]).toMatchObject({
      sequence: 1,
      name: 'Shrawan',
      startDateBs: '2083-04-01',
    });
    expect(plan.periods[11]).toMatchObject({
      sequence: 12,
      name: 'Ashadh',
      startDateBs: '2084-03-01',
    });
  });

  it('keeps consecutive period dates contiguous and matches the FY bounds', () => {
    const plan = buildFiscalYearPlan(2083, converter);

    for (let i = 1; i < plan.periods.length; i++) {
      const previous = plan.periods[i - 1];
      const current = plan.periods[i];
      const dayAfter = new Date(previous.endDate);
      dayAfter.setDate(dayAfter.getDate() + 1);
      expect(current.startDate.getTime()).toBe(dayAfter.getTime());
      expect(current.endDate > current.startDate).toBe(true);
    }

    expect(plan.startDate.getTime()).toBe(plan.periods[0].startDate.getTime());
    expect(plan.endDate.getTime()).toBe(plan.periods[11].endDate.getTime());
    expect(plan.endDate > plan.startDate).toBe(true);
  });

  it('uses the actual days-in-month from the calendar for BS boundaries', () => {
    const plan = buildFiscalYearPlan(2083, converter);

    plan.periods.forEach((period, index) => {
      const month = ((4 - 1 + index) % 12) + 1;
      const year = month < 4 ? 2084 : 2083;
      expect(period.startDateBs).toBe(
        `${year}-${String(month).padStart(2, '0')}-01`,
      );
      expect(period.endDateBs).toBe(
        `${year}-${String(month).padStart(2, '0')}-${converter.getDaysInBsMonth(
          year,
          month,
        )}`,
      );
    });
  });

  it('formats dates as YYYY-MM-DD via toDateString', () => {
    expect(toDateString(new Date(2026, 3, 5))).toBe('2026-04-05');
  });
});

describe('provisionAccounting', () => {
  const orgId = 'org-1';

  it('provisions currency, COA, terms, methods, fiscal year and periods', async () => {
    const { manager, store, listFor } = createManager();

    await provisionAccounting(manager, orgId);

    const currencies = store.get(CurrencyEntity) as CurrencyEntity[];
    expect(currencies).toHaveLength(1);
    expect(currencies[0]).toMatchObject({
      organizationId: null,
      code: BASE_CURRENCY_CODE,
    });

    const accounts = store.get(AccountEntity) as AccountEntity[];
    expect(accounts).toHaveLength(DEFAULT_COA.length);

    const accountsById = new Map(accounts.map((a) => [a.id, a]));
    const byCode = new Map(accounts.map((a) => [a.code, a]));
    const cash = byCode.get('1101') as AccountEntity;
    expect(cash).toMatchObject({
      level: 3,
      path: '1000/1100/1101',
      isSystemAccount: true,
      isLocked: true,
    });
    expect(cash.parentAccountId).toBe((byCode.get('1100') as AccountEntity).id);

    const otherIncome = byCode.get('4103') as AccountEntity;
    expect(otherIncome).toMatchObject({
      level: 2,
      path: '4000/4103',
      isSystemAccount: false,
      isLocked: false,
    });

    const tdsPayable = byCode.get('2103') as AccountEntity;
    expect(tdsPayable).toMatchObject({
      systemPurpose: 'TDS_PAYABLE',
      isSystemAccount: true,
      isLocked: true,
    });

    const insertedOrder = accounts.map((a) => a.code);
    expect(insertedOrder.indexOf('1000')).toBeLessThan(
      insertedOrder.indexOf('1100'),
    );
    expect(insertedOrder.indexOf('1100')).toBeLessThan(
      insertedOrder.indexOf('1101'),
    );
    accounts.forEach((account) => {
      if (account.parentAccountId) {
        const parent = accountsById.get(account.parentAccountId);
        if (parent) {
          expect(insertedOrder.indexOf(parent.code)).toBeLessThan(
            insertedOrder.indexOf(account.code),
          );
        }
      }
    });
    expect(accountsById.size).toBe(DEFAULT_COA.length);

    expect(listFor(PaymentTermEntity)).toHaveLength(4);
    expect(listFor(PaymentMethodEntity)).toHaveLength(3);

    const fiscalYears = store.get(FiscalYearEntity) as FiscalYearEntity[];
    expect(fiscalYears).toHaveLength(1);
    expect(fiscalYears[0]).toMatchObject({
      organizationId: orgId,
      isActive: true,
      isClosed: false,
    });

    const periods = store.get(FiscalPeriodEntity) as FiscalPeriodEntity[];
    expect(periods).toHaveLength(12);
    expect(periods[0]).toMatchObject({
      fiscalYearId: fiscalYears[0].id,
      sequence: 1,
      name: 'Shrawan',
      isLocked: false,
    });
    expect(periods[0].startDateBs).toMatch(/^2083-04-01$/);
    expect(periods.map((p) => p.sequence)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);

    expect(store.get(TaxCodeEntity) ?? []).toHaveLength(0);
  });

  it('provisions per-org TDS withholding codes wired to the TDS Payable account (decision 43)', async () => {
    const { manager, store, listFor } = createManager();
    listFor(TaxTypeEntity).push({
      id: 'tds-type',
      name: 'TDS',
      description: null,
      mathSign: -1,
      isSystem: true,
    } as TaxTypeEntity);

    await provisionAccounting(manager, orgId);

    const accounts = store.get(AccountEntity) as AccountEntity[];
    const tdsPayable = accounts.find(
      (account) => account.systemPurpose === 'TDS_PAYABLE',
    ) as AccountEntity;
    expect(tdsPayable).toBeDefined();

    const codes = store.get(TaxCodeEntity) as TaxCodeEntity[];
    expect(codes).toHaveLength(4);
    expect(codes.map((code) => code.name).sort()).toEqual(
      [
        'TDS 1.5% (Services)',
        'TDS 10% (Interest)',
        'TDS 15% (Professional)',
        'TDS 5% (Rent)',
      ].sort(),
    );
    for (const code of codes) {
      expect(code.organizationId).toBe(orgId);
      expect(code.irdCategory).toBe('TDS_WITHHOLDING');
      expect(code.taxTypeId).toBe('tds-type');
      expect(code.accountId).toBe(tdsPayable.id);
      expect(code.isActive).toBe(true);
    }
  });

  it('is idempotent when run again for the same organization', async () => {
    const { manager, store, listFor } = createManager();

    await provisionAccounting(manager, orgId);
    await provisionAccounting(manager, orgId);

    expect(store.get(CurrencyEntity)).toHaveLength(1);
    expect(store.get(AccountEntity)).toHaveLength(DEFAULT_COA.length);
    expect(store.get(FiscalYearEntity)).toHaveLength(1);
    expect(store.get(FiscalPeriodEntity)).toHaveLength(12);
    expect(listFor(PaymentTermEntity)).toHaveLength(4);
    expect(listFor(PaymentMethodEntity)).toHaveLength(3);
  });

  it('does not re-create a second fiscal year for another org in a fresh store', async () => {
    const { manager, store } = createManager();
    await provisionAccounting(manager, orgId);
    await provisionAccounting(manager, 'org-2');

    const orgIds = new Set(
      (store.get(FiscalYearEntity) as FiscalYearEntity[]).map(
        (fy) => fy.organizationId,
      ),
    );
    expect(orgIds).toEqual(new Set([orgId, 'org-2']));
    expect(store.get(FiscalYearEntity)).toHaveLength(2);
    expect(store.get(FiscalPeriodEntity)).toHaveLength(24);
  });
});
