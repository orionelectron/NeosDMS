import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  In,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { NepaliDateConverter } from '../nepali-date/nepali-date-converter';
import { DOCUMENT_TYPES } from './accounting.constants';
import {
  FiscalPeriodLockedException,
  FiscalPeriodNotFoundException,
  FiscalYearNotFoundException,
  GroupAccountPostingException,
  InvalidAccountForPostingException,
  InvalidJournalLineException,
  JournalAlreadyPostedException,
  JournalEntryNotFoundException,
  JournalNotDraftException,
  UnbalancedJournalException,
} from './accounting.errors';
import { DocumentSequenceService } from './document-sequence.service';
import { AccountEntity } from './entities/account.entity';
import { FiscalPeriodEntity } from './entities/fiscal-period.entity';
import { FiscalYearEntity } from './entities/fiscal-year.entity';
import { JournalEntryEntity } from './entities/journal-entry.entity';
import { JournalLineEntity } from './entities/journal-line.entity';

export interface CreateJournalLineInput {
  accountId: string;
  partyId?: string | null;
  debit?: string | number;
  credit?: string | number;
  description?: string | null;
}

export interface CreateJournalEntryInput {
  branchId: string;
  entryDate: string;
  description?: string | null;
  lines: CreateJournalLineInput[];
}

export interface ListJournalEntriesQuery {
  page: number;
  limit: number;
  status?: string;
  from?: string;
  to?: string;
  accountId?: string;
}

interface ValidatableLine {
  accountId: string;
  debit?: string | number;
  credit?: string | number;
  debitAmount?: string;
  creditAmount?: string;
}

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

const round4 = (n: number): number => Math.round(n * 10000) / 10000;

/**
 * Journal posting engine. Drafts are created and validated eagerly; posting
 * re-validates the ledger (balance, group/system accounts, fiscal period
 * locks) inside one transaction and assigns the JE reference number.
 */
@Injectable()
export class JournalService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(JournalEntryEntity)
    private readonly entryRepo: Repository<JournalEntryEntity>,
    private readonly documentSequenceService: DocumentSequenceService,
    private readonly nepaliDate: NepaliDateConverter,
    private readonly auditService: AuditService,
  ) {}

  async createDraft(
    organizationId: string,
    input: CreateJournalEntryInput,
    actorId: string,
  ): Promise<JournalEntryEntity> {
    return this.dataSource.transaction(async (manager) =>
      this.createDraftIn(manager, organizationId, input, actorId),
    );
  }

  /**
   * Manager-scoped createDraft for callers that post inside their own
   * transaction (e.g. sales invoices). All persistence uses the passed
   * manager so the entry participates in the caller's transaction.
   */
  async createDraftIn(
    manager: EntityManager,
    organizationId: string,
    input: CreateJournalEntryInput,
    actorId: string,
  ): Promise<JournalEntryEntity> {
    const entryDate = parseLocalDate(input.entryDate);
    const { totalDebit, totalCredit } = await this.validateLines(
      manager,
      organizationId,
      input.lines,
    );
    if (round4(totalDebit) !== round4(totalCredit)) {
      throw new UnbalancedJournalException(
        round4(totalDebit),
        round4(totalCredit),
      );
    }
    const { fiscalYear, period } = await this.resolveFiscalContext(
      manager,
      organizationId,
      entryDate,
    );

    const entryRepo = manager.getRepository(JournalEntryEntity);
    const entry = await entryRepo.save(
      entryRepo.create({
        organizationId,
        branchId: input.branchId,
        fiscalYearId: fiscalYear.id,
        fiscalPeriodId: period.id,
        currencyId: null,
        exchangeRate: '1.000000',
        entryDate,
        entryDateBs: this.toBs(entryDate),
        description: input.description ?? null,
        referenceNumber: null,
        status: 'DRAFT',
        sourceType: null,
        sourceId: null,
      }),
    );

    const lineRepo = manager.getRepository(JournalLineEntity);
    await lineRepo.save(
      input.lines.map((line) =>
        lineRepo.create({
          organizationId,
          branchId: input.branchId,
          journalEntryId: entry.id,
          accountId: line.accountId,
          partyId: line.partyId ?? null,
          debitAmount: String(round4(Number(line.debit ?? 0))),
          creditAmount: String(round4(Number(line.credit ?? 0))),
          description: line.description ?? null,
          isReconciled: false,
          reconciledDate: null,
        }),
      ),
    );

    await this.auditService.record(
      {
        organizationId,
        branchId: input.branchId,
        userId: actorId,
        action: 'accounting.journal-entry.create',
        entityType: 'journal-entry',
        entityId: entry.id,
        newData: { entryDate: input.entryDate, status: 'DRAFT' },
      },
      manager,
    );

    return this.getIn(manager, organizationId, entry.id);
  }

  async post(
    organizationId: string,
    entryId: string,
    actorId: string,
  ): Promise<JournalEntryEntity> {
    return this.dataSource.transaction(async (manager) =>
      this.postIn(manager, organizationId, entryId, actorId),
    );
  }

  /**
   * Manager-scoped post for callers that post inside their own transaction.
   * Assigns the JE reference number via the shared document sequence so the
   * caller's transaction commits the number atomically.
   */
  async postIn(
    manager: EntityManager,
    organizationId: string,
    entryId: string,
    actorId: string,
  ): Promise<JournalEntryEntity> {
    const entryRepo = manager.getRepository(JournalEntryEntity);
    const entry = await entryRepo.findOne({
      where: { id: entryId, organizationId },
      relations: { lines: true },
    });
    if (!entry) throw new JournalEntryNotFoundException(entryId);
    if (entry.status === 'POSTED')
      throw new JournalAlreadyPostedException(entryId);
    if (entry.status !== 'DRAFT')
      throw new JournalNotDraftException(entryId, entry.status);

    const { totalDebit, totalCredit } = await this.validateLines(
      manager,
      organizationId,
      entry.lines,
    );
    if (round4(totalDebit) !== round4(totalCredit)) {
      throw new UnbalancedJournalException(
        round4(totalDebit),
        round4(totalCredit),
      );
    }

    const { fiscalYear, period } = await this.resolveFiscalContext(
      manager,
      organizationId,
      entry.entryDate,
    );
    const entryDate =
      typeof entry.entryDate === 'string'
        ? parseLocalDate(entry.entryDate)
        : entry.entryDate;

    const referenceNumber = await this.documentSequenceService.nextNumber(
      {
        organizationId,
        branchId: entry.branchId,
        fiscalYearId: fiscalYear.id,
        documentType: DOCUMENT_TYPES.JOURNAL_ENTRY,
        prefix: 'JE-',
      },
      manager,
    );

    entry.status = 'POSTED';
    entry.referenceNumber = referenceNumber;
    entry.fiscalYearId = fiscalYear.id;
    entry.fiscalPeriodId = period.id;
    entry.entryDateBs = this.toBs(entryDate);
    entry.updatedBy = actorId;
    await entryRepo.save(entry);

    await this.auditService.record(
      {
        organizationId,
        branchId: entry.branchId,
        userId: actorId,
        action: 'accounting.journal-entry.post',
        entityType: 'journal-entry',
        entityId: entry.id,
        newData: { referenceNumber, status: 'POSTED' },
      },
      manager,
    );

    return this.getIn(manager, organizationId, entry.id);
  }

  async cancel(
    organizationId: string,
    entryId: string,
    actorId: string,
  ): Promise<JournalEntryEntity> {
    return this.dataSource.transaction(async (manager) => {
      const entryRepo = manager.getRepository(JournalEntryEntity);
      const entry = await entryRepo.findOne({
        where: { id: entryId, organizationId },
      });
      if (!entry) throw new JournalEntryNotFoundException(entryId);
      if (entry.status !== 'DRAFT')
        throw new JournalNotDraftException(entryId, entry.status);

      entry.status = 'CANCELLED';
      entry.updatedBy = actorId;
      await entryRepo.save(entry);

      await this.auditService.record(
        {
          organizationId,
          branchId: entry.branchId,
          userId: actorId,
          action: 'accounting.journal-entry.delete',
          entityType: 'journal-entry',
          entityId: entry.id,
          newData: { status: 'CANCELLED' },
        },
        manager,
      );

      return this.get(organizationId, entry.id);
    });
  }

  async list(
    organizationId: string,
    query: ListJournalEntriesQuery,
  ): Promise<[JournalEntryEntity[], number]> {
    const qb = this.entryRepo
      .createQueryBuilder('entry')
      .where('entry.organizationId = :organizationId', { organizationId })
      .leftJoinAndSelect('entry.lines', 'lines')
      .leftJoinAndSelect('lines.account', 'account');

    if (query.status) {
      qb.andWhere('entry.status = :status', { status: query.status });
    }
    if (query.from) {
      qb.andWhere('entry.entryDate >= :from', {
        from: parseLocalDate(query.from),
      });
    }
    if (query.to) {
      qb.andWhere('entry.entryDate <= :to', { to: parseLocalDate(query.to) });
    }
    if (query.accountId) {
      qb.andWhere('lines.accountId = :accountId', {
        accountId: query.accountId,
      });
    }

    const [rows, total] = await qb
      .orderBy('entry.entryDate', 'DESC')
      .addOrderBy('entry.createdAt', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return [rows, total];
  }

  async get(
    organizationId: string,
    entryId: string,
  ): Promise<JournalEntryEntity> {
    const entry = await this.entryRepo.findOne({
      where: { id: entryId, organizationId },
      relations: {
        lines: { account: true, party: true },
        fiscalYear: true,
        fiscalPeriod: true,
      },
    });
    if (!entry) throw new JournalEntryNotFoundException(entryId);
    return entry;
  }

  /** Manager-scoped get for use inside a caller's open transaction. */
  async getIn(
    manager: EntityManager,
    organizationId: string,
    entryId: string,
  ): Promise<JournalEntryEntity> {
    const entryRepo = manager.getRepository(JournalEntryEntity);
    const entry = await entryRepo.findOne({
      where: { id: entryId, organizationId },
      relations: {
        lines: { account: true, party: true },
        fiscalYear: true,
        fiscalPeriod: true,
      },
    });
    if (!entry) throw new JournalEntryNotFoundException(entryId);
    return entry;
  }

  private async validateLines(
    manager: EntityManager,
    organizationId: string,
    lines: ValidatableLine[],
  ): Promise<{ totalDebit: number; totalCredit: number }> {
    if (!lines || lines.length === 0) {
      throw new InvalidJournalLineException(0, 'at least one line is required');
    }

    const accountRepo = manager.getRepository(AccountEntity);
    const accountIds = [...new Set(lines.map((line) => line.accountId))];
    const accounts = await accountRepo.find({
      where: { id: In(accountIds), organizationId },
    });
    const accountsById = new Map(
      accounts.map((account) => [account.id, account]),
    );

    let totalDebit = 0;
    let totalCredit = 0;
    lines.forEach((line, index) => {
      const account = accountsById.get(line.accountId);
      if (!account) {
        throw new InvalidAccountForPostingException(
          line.accountId,
          'account not found',
        );
      }
      if (account.isGroup) throw new GroupAccountPostingException(account.code);
      if (!account.isActive) {
        throw new InvalidAccountForPostingException(
          line.accountId,
          'account is inactive',
        );
      }

      const debit = Number(line.debit ?? line.debitAmount ?? 0);
      const credit = Number(line.credit ?? line.creditAmount ?? 0);
      if (!Number.isFinite(debit) || !Number.isFinite(credit)) {
        throw new InvalidJournalLineException(index, 'amounts must be numbers');
      }
      if (debit < 0 || credit < 0) {
        throw new InvalidJournalLineException(
          index,
          'amounts cannot be negative',
        );
      }
      if (!((debit > 0 && credit === 0) || (credit > 0 && debit === 0))) {
        throw new InvalidJournalLineException(
          index,
          'each line must have exactly one of debit or credit greater than zero',
        );
      }

      totalDebit += debit;
      totalCredit += credit;
    });

    return { totalDebit, totalCredit };
  }

  private async resolveFiscalContext(
    manager: EntityManager,
    organizationId: string,
    entryDate: Date,
  ): Promise<{ fiscalYear: FiscalYearEntity; period: FiscalPeriodEntity }> {
    const fyRepo = manager.getRepository(FiscalYearEntity);
    const fiscalYear = await fyRepo.findOne({
      where: {
        organizationId,
        isActive: true,
        isClosed: false,
        startDate: LessThanOrEqual(entryDate),
        endDate: MoreThanOrEqual(entryDate),
      },
    });
    if (!fiscalYear) throw new FiscalYearNotFoundException(organizationId);

    const periodRepo = manager.getRepository(FiscalPeriodEntity);
    const period = await periodRepo.findOne({
      where: {
        fiscalYearId: fiscalYear.id,
        startDate: LessThanOrEqual(entryDate),
        endDate: MoreThanOrEqual(entryDate),
      },
    });
    if (!period) {
      throw new FiscalPeriodNotFoundException(
        entryDate.toISOString().slice(0, 10),
      );
    }
    if (period.isLocked) throw new FiscalPeriodLockedException(period.name);

    return { fiscalYear, period };
  }

  private toBs(date: Date): string {
    const bs = this.nepaliDate.adToBs(
      date.getFullYear(),
      date.getMonth() + 1,
      date.getDate(),
    );
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${bs.bsYear}-${pad(bs.bsMonth)}-${pad(bs.bsDay)}`;
  }
}
