import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import {
  FiscalYearNotFoundException,
  InvalidReportRangeException,
} from './accounting.errors';
import { AccountEntity } from './entities/account.entity';
import { FiscalYearEntity } from './entities/fiscal-year.entity';
import { TrialBalanceService } from './trial-balance.service';
import {
  createFakeManager,
  makeEntity,
  type FakeRepo,
} from '../testing/accounting-fakes';

describe('TrialBalanceService', () => {
  const orgId = 'org-1';

  let service: TrialBalanceService;
  let fyRepo: FakeRepo<FiscalYearEntity>;
  let accountRepo: FakeRepo<AccountEntity>;
  let query: jest.Mock;

  const fiscalYear = () =>
    makeEntity(FiscalYearEntity, {
      id: 'fy-1',
      organizationId: orgId,
      name: '2083/84',
      startDate: new Date(2026, 6, 17),
      endDate: new Date(2027, 6, 16),
      isActive: true,
      isClosed: false,
    });

  const cash = () =>
    makeEntity(AccountEntity, {
      id: 'acc-cash',
      organizationId: orgId,
      code: '1101',
      name: 'Cash',
      coaType: 'ASSET',
      level: 3,
      path: '1000/1100/1101',
    });

  const payable = () =>
    makeEntity(AccountEntity, {
      id: 'acc-ap',
      organizationId: orgId,
      code: '2101',
      name: 'Accounts Payable',
      coaType: 'LIABILITY',
      level: 3,
      path: '2000/2100/2101',
    });

  beforeEach(async () => {
    const bundle = createFakeManager();
    fyRepo = bundle.repo(FiscalYearEntity);
    accountRepo = bundle.repo(AccountEntity);
    query = jest.fn();
    const dataSource = { query };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TrialBalanceService,
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: getRepositoryToken(FiscalYearEntity), useValue: fyRepo },
        { provide: getRepositoryToken(AccountEntity), useValue: accountRepo },
      ],
    }).compile();

    service = moduleRef.get(TrialBalanceService);
  });

  it('defaults to the active fiscal year and only aggregates POSTED entries', async () => {
    fyRepo.rows.push(fiscalYear());
    accountRepo.rows.push(cash(), payable());
    query.mockResolvedValue([
      {
        account_id: 'acc-cash',
        opening_debit: '1000.0000',
        opening_credit: '0',
        debit: '500.0000',
        credit: '0',
      },
      {
        account_id: 'acc-ap',
        opening_debit: '0',
        opening_credit: '1000.0000',
        debit: '0',
        credit: '500.0000',
      },
    ]);

    const tb = await service.trialBalance(orgId, {});

    expect(fyRepo.findOne).toHaveBeenCalledWith({
      where: { organizationId: orgId, isActive: true },
    });
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain(`entry.status = 'POSTED'`);
    expect(params[0]).toBe(orgId);
    expect((params[2] as Date).getTime()).toBe(new Date(2026, 6, 17).getTime());
    expect((params[3] as Date).getTime()).toBe(new Date(2027, 6, 16).getTime());

    expect(tb).toMatchObject({
      fiscalYearId: 'fy-1',
      fiscalYearName: '2083/84',
      from: '2026-07-17',
      to: '2027-07-16',
      balanced: true,
    });
    expect(tb.lines).toHaveLength(2);
    expect(tb.lines[0]).toMatchObject({
      code: '1101',
      openingDebit: 1000,
      debit: 500,
      closingDebit: 1500,
      closingCredit: 0,
      netBalance: 1500,
    });
    expect(tb.lines[1]).toMatchObject({
      code: '2101',
      openingCredit: 1000,
      credit: 500,
      closingDebit: 0,
      closingCredit: 1500,
      netBalance: 1500,
    });
    expect(tb.totals).toEqual({
      openingDebit: 1000,
      openingCredit: 1000,
      debit: 500,
      credit: 500,
      closingDebit: 1500,
      closingCredit: 1500,
    });
  });

  it('uses the requested fiscal year when provided', async () => {
    fyRepo.rows.push(fiscalYear());
    accountRepo.rows.push(cash());
    query.mockResolvedValue([]);

    await service.trialBalance(orgId, { fiscalYearId: 'fy-1' });

    expect(fyRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'fy-1', organizationId: orgId },
    });
  });

  it('throws when no fiscal year covers the request', async () => {
    await expect(service.trialBalance(orgId, {})).rejects.toThrow(
      FiscalYearNotFoundException,
    );
  });

  it('rejects an inverted range', async () => {
    fyRepo.rows.push(fiscalYear());

    await expect(
      service.trialBalance(orgId, { from: '2027-01-01', to: '2026-01-01' }),
    ).rejects.toThrow(InvalidReportRangeException);
    expect(query).not.toHaveBeenCalled();
  });

  it('clamps from/to to the fiscal year bounds', async () => {
    fyRepo.rows.push(fiscalYear());
    accountRepo.rows.push(cash());
    query.mockResolvedValue([]);

    await service.trialBalance(orgId, {
      from: '2026-01-01',
      to: '2028-01-01',
    });

    const [, params] = query.mock.calls[0] as [string, unknown[]];
    expect((params[2] as Date).getTime()).toBe(new Date(2026, 6, 17).getTime());
    expect((params[3] as Date).getTime()).toBe(new Date(2027, 6, 16).getTime());
  });

  it('skips zero-balance rows and rows whose account is missing', async () => {
    fyRepo.rows.push(fiscalYear());
    accountRepo.rows.push(cash());
    query.mockResolvedValue([
      {
        account_id: 'acc-cash',
        opening_debit: '0',
        opening_credit: '0',
        debit: '0',
        credit: '0',
      },
      {
        account_id: 'unknown',
        opening_debit: '10',
        opening_credit: '0',
        debit: '0',
        credit: '0',
      },
    ]);

    const tb = await service.trialBalance(orgId, {});

    expect(tb.lines).toHaveLength(0);
    expect(tb.balanced).toBe(true);
  });

  it('flags an unbalanced ledger', async () => {
    fyRepo.rows.push(fiscalYear());
    accountRepo.rows.push(cash(), payable());
    query.mockResolvedValue([
      {
        account_id: 'acc-cash',
        opening_debit: '100',
        opening_credit: '0',
        debit: '0',
        credit: '0',
      },
      {
        account_id: 'acc-ap',
        opening_debit: '0',
        opening_credit: '40',
        debit: '0',
        credit: '0',
      },
    ]);

    const tb = await service.trialBalance(orgId, {});

    expect(tb.totals.closingDebit).toBe(100);
    expect(tb.totals.closingCredit).toBe(40);
    expect(tb.balanced).toBe(false);
  });
});
