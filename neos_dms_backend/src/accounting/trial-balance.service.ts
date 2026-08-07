import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type { CoaType } from './accounting.constants';
import {
  FiscalYearNotFoundException,
  InvalidReportRangeException,
} from './accounting.errors';
import { AccountEntity } from './entities/account.entity';
import { FiscalYearEntity } from './entities/fiscal-year.entity';

export interface TrialBalanceQuery {
  fiscalYearId?: string;
  from?: string;
  to?: string;
}

export interface TrialBalanceLine {
  accountId: string;
  code: string;
  name: string;
  coaType: CoaType;
  level: number | null;
  path: string | null;
  openingDebit: number;
  openingCredit: number;
  debit: number;
  credit: number;
  closingDebit: number;
  closingCredit: number;
  netBalance: number;
}

export interface TrialBalance {
  fiscalYearId: string;
  fiscalYearName: string;
  from: string;
  to: string;
  balanced: boolean;
  lines: TrialBalanceLine[];
  totals: {
    openingDebit: number;
    openingCredit: number;
    debit: number;
    credit: number;
    closingDebit: number;
    closingCredit: number;
  };
}

const round4 = (n: number): number => Math.round(n * 10000) / 10000;

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toDateString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const CREDIT_NORMAL = new Set<CoaType>(['LIABILITY', 'EQUITY', 'INCOME']);

/**
 * Minimal trial balance read over POSTED journal entries within a fiscal
 * year: per-account opening (before `from`), activity (in `[from, to]`) and
 * closing balances, plus totals and a `balanced` flag that validates the
 * posting engine end-to-end. Read-only; the pretty report layer lands in
 * Phase 8.
 */
@Injectable()
export class TrialBalanceService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(FiscalYearEntity)
    private readonly fyRepo: Repository<FiscalYearEntity>,
    @InjectRepository(AccountEntity)
    private readonly accountRepo: Repository<AccountEntity>,
  ) {}

  async trialBalance(
    organizationId: string,
    query: TrialBalanceQuery,
  ): Promise<TrialBalance> {
    const fiscalYear = query.fiscalYearId
      ? await this.fyRepo.findOne({
          where: { id: query.fiscalYearId, organizationId },
        })
      : await this.fyRepo.findOne({
          where: { organizationId, isActive: true },
        });
    if (!fiscalYear) throw new FiscalYearNotFoundException(organizationId);

    const from = query.from
      ? parseLocalDate(query.from)
      : new Date(fiscalYear.startDate);
    const to = query.to
      ? parseLocalDate(query.to)
      : new Date(fiscalYear.endDate);
    if (from.getTime() > to.getTime()) {
      throw new InvalidReportRangeException(
        toDateString(from),
        toDateString(to),
      );
    }

    const fromClamped =
      from.getTime() < fiscalYear.startDate.getTime()
        ? new Date(fiscalYear.startDate)
        : from;
    const toClamped =
      to.getTime() > fiscalYear.endDate.getTime()
        ? new Date(fiscalYear.endDate)
        : to;

    const rows: Array<{
      account_id: string;
      opening_debit: string;
      opening_credit: string;
      debit: string;
      credit: string;
    }> = await this.dataSource.query(
      `SELECT line.account_id::text AS account_id,
              COALESCE(SUM(CASE WHEN entry.entry_date < $3 THEN line.debit_amount END), 0)::numeric AS opening_debit,
              COALESCE(SUM(CASE WHEN entry.entry_date < $3 THEN line.credit_amount END), 0)::numeric AS opening_credit,
              COALESCE(SUM(CASE WHEN entry.entry_date >= $3 AND entry.entry_date <= $4 THEN line.debit_amount END), 0)::numeric AS debit,
              COALESCE(SUM(CASE WHEN entry.entry_date >= $3 AND entry.entry_date <= $4 THEN line.credit_amount END), 0)::numeric AS credit
       FROM journal_lines line
       JOIN journal_entries entry ON entry.id = line.journal_entry_id
       WHERE entry.organization_id = $1
         AND entry.status = 'POSTED'
         AND entry.entry_date >= $2
         AND entry.entry_date <= $4
       GROUP BY line.account_id`,
      [organizationId, fiscalYear.startDate, fromClamped, toClamped],
    );

    const accounts = await this.accountRepo.find({
      where: { organizationId },
      select: {
        id: true,
        code: true,
        name: true,
        coaType: true,
        level: true,
        path: true,
      },
    });
    const metaById = new Map(accounts.map((account) => [account.id, account]));

    const lines: TrialBalanceLine[] = [];
    for (const row of rows) {
      const account = metaById.get(row.account_id);
      if (!account) continue;

      const openingDebit = Number(row.opening_debit);
      const openingCredit = Number(row.opening_credit);
      const debit = Number(row.debit);
      const credit = Number(row.credit);
      const openingNet = round4(openingDebit - openingCredit);
      const activityNet = round4(debit - credit);
      if (openingNet === 0 && activityNet === 0) continue;

      const closingNet = round4(openingNet + activityNet);
      const closingDebit = closingNet > 0 ? closingNet : 0;
      const closingCredit = closingNet < 0 ? -closingNet : 0;

      lines.push({
        accountId: account.id,
        code: account.code,
        name: account.name,
        coaType: account.coaType,
        level: account.level ?? null,
        path: account.path ?? null,
        openingDebit,
        openingCredit,
        debit,
        credit,
        closingDebit,
        closingCredit,
        netBalance: CREDIT_NORMAL.has(account.coaType)
          ? closingCredit - closingDebit
          : closingDebit - closingCredit,
      });
    }
    lines.sort((a, b) => a.code.localeCompare(b.code));

    const sum = (pick: (line: TrialBalanceLine) => number) =>
      round4(lines.reduce((total, line) => total + pick(line), 0));

    const totals = {
      openingDebit: sum((line) => line.openingDebit),
      openingCredit: sum((line) => line.openingCredit),
      debit: sum((line) => line.debit),
      credit: sum((line) => line.credit),
      closingDebit: sum((line) => line.closingDebit),
      closingCredit: sum((line) => line.closingCredit),
    };

    return {
      fiscalYearId: fiscalYear.id,
      fiscalYearName: fiscalYear.name,
      from: toDateString(fromClamped),
      to: toDateString(toClamped),
      balanced: round4(totals.closingDebit) === round4(totals.closingCredit),
      lines,
      totals,
    };
  }
}
