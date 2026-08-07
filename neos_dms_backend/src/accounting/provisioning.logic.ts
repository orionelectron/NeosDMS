import { EntityManager, IsNull } from 'typeorm';
import { NepaliDateConverter } from '../nepali-date/nepali-date-converter';
import {
  BASE_CURRENCY_CODE,
  DEFAULT_PAYMENT_METHODS,
  DEFAULT_PAYMENT_TERMS,
  GLOBAL_NPR_CURRENCY,
} from './accounting.constants';
import { DEFAULT_COA } from './default-coa';
import { AccountEntity } from './entities/account.entity';
import { CurrencyEntity } from './entities/currency.entity';
import { FiscalPeriodEntity } from './entities/fiscal-period.entity';
import { FiscalYearEntity } from './entities/fiscal-year.entity';
import { PaymentMethodEntity } from './entities/payment-method.entity';
import { PaymentTermEntity } from './entities/payment-term.entity';
import { TaxCodeEntity } from './entities/tax-code.entity';
import { TaxTemplateEntity } from './entities/tax-template.entity';

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function localDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

function addDaysLocal(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export interface FiscalYearPlan {
  name: string;
  startDate: Date;
  endDate: Date;
  periods: Array<{
    name: string;
    sequence: number;
    startDateBs: string;
    endDateBs: string;
    startDate: Date;
    endDate: Date;
  }>;
}

/**
 * Build the fiscal-year plan (FY + 12 BS months) for a given Bikram Sambat
 * year. Baisakh 1 is the fiscal year start. Framework-free so both the Nest
 * provisioning service and the versioned backfill seed reuse it.
 */
export function buildFiscalYearPlan(
  bsYear: number,
  converter: NepaliDateConverter,
): FiscalYearPlan {
  const firstOfYear = converter.bsToAd(bsYear, 1, 1);
  const firstOfNext = converter.bsToAd(bsYear + 1, 1, 1);
  const startDate = localDate(
    firstOfYear.adYear,
    firstOfYear.adMonth,
    firstOfYear.adDay,
  );
  const endDate = addDaysLocal(
    localDate(firstOfNext.adYear, firstOfNext.adMonth, firstOfNext.adDay),
    -1,
  );

  const periods: FiscalYearPlan['periods'] = [];
  for (let month = 1; month <= 12; month++) {
    const daysInMonth = converter.getDaysInBsMonth(bsYear, month);
    const monthStart = converter.bsToAd(bsYear, month, 1);
    const monthEnd =
      month < 12
        ? addDaysLocal(
            (() => {
              const next = converter.bsToAd(bsYear, month + 1, 1);
              return localDate(next.adYear, next.adMonth, next.adDay);
            })(),
            -1,
          )
        : endDate;

    periods.push({
      name: converter.getBsMonthName(month, 'en'),
      sequence: month,
      startDateBs: `${bsYear}-${pad(month)}-01`,
      endDateBs: `${bsYear}-${pad(month)}-${daysInMonth}`,
      startDate: localDate(
        monthStart.adYear,
        monthStart.adMonth,
        monthStart.adDay,
      ),
      endDate: monthEnd,
    });
  }

  return {
    name: `${bsYear}/${pad((bsYear + 1) % 100)}`,
    startDate,
    endDate,
    periods,
  };
}

function levelOf(
  code: string,
  byCode: Map<string, DefaultAccountResolved>,
): number {
  const entry = byCode.get(code);
  if (!entry) return 1;
  if (!entry.parentCode) return 1;
  return levelOf(entry.parentCode, byCode) + 1;
}

function pathOf(
  code: string,
  byCode: Map<string, DefaultAccountResolved>,
): string {
  const entry = byCode.get(code);
  if (!entry) return code;
  if (!entry.parentCode) return entry.code;
  return `${pathOf(entry.parentCode, byCode)}/${entry.code}`;
}

interface DefaultAccountResolved {
  code: string;
  parentCode: string | null;
}

/**
 * Idempotent per-organization accounting provisioning, designed to run inside
 * the caller's transaction:
 *  - global NPR base currency (falls back to creating it if the seed is missing)
 *  - default chart of accounts
 *  - current Nepali fiscal year + 12 periods
 *  - default payment terms + methods
 *  - default VAT / exempt tax codes wired to the VAT accounts
 */
export async function provisionAccounting(
  manager: EntityManager,
  organizationId: string,
): Promise<void> {
  await ensureBaseCurrency(manager);
  await ensureDefaultCoa(manager, organizationId);
  await ensureDefaultPaymentTerms(manager, organizationId);
  await ensureDefaultPaymentMethods(manager, organizationId);
  await ensureFiscalYear(manager, organizationId);
  await ensureDefaultTaxCodes(manager, organizationId);
}

async function ensureBaseCurrency(manager: EntityManager): Promise<void> {
  const repo = manager.getRepository(CurrencyEntity);
  const existing = await repo.findOne({
    where: { organizationId: IsNull(), code: BASE_CURRENCY_CODE },
  });
  if (existing) return;
  await repo.save(
    repo.create({ organizationId: null, ...GLOBAL_NPR_CURRENCY }),
  );
}

async function ensureDefaultCoa(
  manager: EntityManager,
  organizationId: string,
): Promise<void> {
  const repo = manager.getRepository(AccountEntity);
  const existing = await repo.find({
    where: { organizationId },
    select: { id: true, code: true },
  });
  const idByCode = new Map(
    existing.map((account) => [account.code, account.id]),
  );
  const byCode = new Map<string, DefaultAccountResolved>(
    DEFAULT_COA.map((account) => [
      account.code,
      { code: account.code, parentCode: account.parentCode },
    ]),
  );

  const ordered = [...DEFAULT_COA].sort((a, b) => {
    const la = levelOf(a.code, byCode);
    const lb = levelOf(b.code, byCode);
    return la - lb || a.code.localeCompare(b.code);
  });

  for (const account of ordered) {
    if (idByCode.has(account.code)) continue;
    const parentAccountId = account.parentCode
      ? (idByCode.get(account.parentCode) ?? null)
      : null;
    const saved = await repo.save(
      repo.create({
        organizationId,
        parentAccountId,
        name: account.name,
        code: account.code,
        coaType: account.coaType,
        isGroup: account.isGroup ?? false,
        isSystemAccount: Boolean(account.systemPurpose),
        systemPurpose: account.systemPurpose ?? null,
        isLocked: Boolean(account.systemPurpose),
        isActive: true,
        level: levelOf(account.code, byCode),
        path: pathOf(account.code, byCode),
      }),
    );
    idByCode.set(account.code, saved.id);
  }
}

async function ensureDefaultPaymentTerms(
  manager: EntityManager,
  organizationId: string,
): Promise<void> {
  const repo = manager.getRepository(PaymentTermEntity);
  const count = await repo.count({ where: { organizationId } });
  if (count > 0) return;
  await repo.save(
    DEFAULT_PAYMENT_TERMS.map((term) =>
      repo.create({ organizationId, name: term.name, dueDays: term.dueDays }),
    ),
  );
}

async function ensureDefaultPaymentMethods(
  manager: EntityManager,
  organizationId: string,
): Promise<void> {
  const repo = manager.getRepository(PaymentMethodEntity);
  const count = await repo.count({ where: { organizationId } });
  if (count > 0) return;
  await repo.save(
    DEFAULT_PAYMENT_METHODS.map((method) =>
      repo.create({
        organizationId,
        name: method.name,
        methodType: method.methodType,
        linkedAccountId: null,
        isActive: true,
      }),
    ),
  );
}

async function ensureFiscalYear(
  manager: EntityManager,
  organizationId: string,
): Promise<void> {
  const yearRepo = manager.getRepository(FiscalYearEntity);
  const existing = await yearRepo.count({ where: { organizationId } });
  if (existing > 0) return;

  const converter = new NepaliDateConverter();
  const today = new Date();
  const bs = converter.adToBs(
    today.getFullYear(),
    today.getMonth() + 1,
    today.getDate(),
  );
  const plan = buildFiscalYearPlan(bs.bsYear, converter);

  const fiscalYear = await yearRepo.save(
    yearRepo.create({
      organizationId,
      name: plan.name,
      startDate: plan.startDate,
      endDate: plan.endDate,
      isActive: true,
      isClosed: false,
      closedAt: null,
      closedBy: null,
    }),
  );

  const periodRepo = manager.getRepository(FiscalPeriodEntity);
  await periodRepo.save(
    plan.periods.map((period) =>
      periodRepo.create({
        fiscalYearId: fiscalYear.id,
        name: period.name,
        sequence: period.sequence,
        startDateBs: period.startDateBs,
        endDateBs: period.endDateBs,
        startDate: period.startDate,
        endDate: period.endDate,
        isLocked: false,
        lockedAt: null,
        lockedBy: null,
      }),
    ),
  );
}

async function ensureDefaultTaxCodes(
  manager: EntityManager,
  organizationId: string,
): Promise<void> {
  const codeRepo = manager.getRepository(TaxCodeEntity);
  const existing = await codeRepo.count({ where: { organizationId } });
  if (existing > 0) return;

  const accountRepo = manager.getRepository(AccountEntity);
  const accountByPurpose = new Map(
    (
      await accountRepo.find({
        where: { organizationId, isSystemAccount: true },
        select: { id: true, systemPurpose: true },
      })
    ).map((account) => [account.systemPurpose, account.id]),
  );

  const templateRepo = manager.getRepository(TaxTemplateEntity);
  const templates = await templateRepo.find({ relations: { taxType: true } });
  const vatTemplate = templates.find(
    (template) =>
      template.irdCategory === 'TAXABLE' && template.rate === '13.0000',
  );
  const exemptTemplate = templates.find(
    (template) => template.irdCategory === 'EXEMPT',
  );
  const vatTypeId = vatTemplate?.taxTypeId ?? null;
  const exemptTypeId = exemptTemplate?.taxTypeId ?? null;

  const today = new Date();
  const rows = [
    {
      name: 'VAT 13% (Output)',
      taxTypeId: vatTypeId,
      accountId: accountByPurpose.get('TAX_PAYABLE') ?? null,
      irdCategory: 'TAXABLE' as const,
      rate: '13',
    },
    {
      name: 'VAT 13% (Input)',
      taxTypeId: vatTypeId,
      accountId: accountByPurpose.get('TAX_RECEIVABLE') ?? null,
      irdCategory: 'TAXABLE' as const,
      rate: '13',
    },
    {
      name: 'Exempt',
      taxTypeId: exemptTypeId,
      accountId: null,
      irdCategory: 'EXEMPT' as const,
      rate: '0',
    },
  ].filter((row) => row.taxTypeId !== null);

  if (rows.length === 0) return;
  await codeRepo.save(
    rows.map((row) =>
      codeRepo.create({
        organizationId,
        taxTypeId: row.taxTypeId as string,
        accountId: row.accountId,
        name: row.name,
        irdCategory: row.irdCategory,
        rate: row.rate,
        effectiveFrom: today,
        effectiveTo: null,
        isLocked: true,
        isActive: true,
      }),
    ),
  );
}
