import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { AccountEntity } from '../accounting/entities/account.entity';
import { FiscalYearEntity } from '../accounting/entities/fiscal-year.entity';
import { JournalEntryEntity } from '../accounting/entities/journal-entry.entity';
import { PartyEntity } from '../accounting/entities/party.entity';
import { PaymentMethodEntity } from '../accounting/entities/payment-method.entity';
import { TaxCodeEntity } from '../accounting/entities/tax-code.entity';
import type { SystemPurpose } from '../accounting/accounting.constants';
import { DocumentSequenceService } from '../accounting/document-sequence.service';
import { JournalService } from '../accounting/journal.service';
import { AuditService } from '../audit/audit.service';
import { NepaliDateConverter } from '../nepali-date/nepali-date-converter';
import { BranchEntity } from '../tenancy/entities/branch.entity';
import {
  CreateExpenseDto,
  ExpenseLineDto,
  ExpenseQueryDto,
  UpdateExpenseDto,
} from './dto/expense.dto';
import { ExpenseLineEntity } from './entities/expense-line.entity';
import { ExpenseEntity } from './entities/expense.entity';
import {
  EXPENSE_AUDIT_ACTIONS,
  EXPENSE_DOCUMENT_TYPE,
  EXPENSE_NUMBER_PREFIX,
} from './purchase.constants';
import {
  ExpenseAccountMissingException,
  ExpenseAccountTypeException,
  ExpenseFiscalYearMissingException,
  ExpenseLineIncompleteException,
  ExpenseModePartyRequiredException,
  ExpenseNotDraftException,
  ExpenseNotFoundException,
  ExpensePartyNotFoundException,
  ExpensePaymentAccountMissingException,
  ExpensePaymentAccountNotFoundException,
  ExpensePaymentAccountTypeException,
  ExpensePaymentMethodNotFoundException,
  ExpenseTdsCodeInvalidException,
  ExpenseTdsWithholdingException,
  ExpenseZeroAmountException,
  ExpenseZeroQuantityException,
} from './purchase.errors';

const ROUND2 = (n: number): number => Math.round(n * 100) / 100;
const ROUND4 = (n: number): number => Math.round(n * 10000) / 10000;

interface PreparedExpenseLine {
  lineNo: number;
  expenseAccountId: string;
  description: string;
  quantity: number;
  unitAmount: number;
  grossAmount: number;
  discountPercent: number;
  discountAmount: number;
  taxCodeId: string | null;
  taxableAmount: number;
  taxRate: number;
  taxAmount: number;
  tdsTaxCodeId: string | null;
  tdsRate: number;
  tdsAmount: number;
  lineTotal: number;
}

interface PreparedExpense {
  lines: PreparedExpenseLine[];
  subtotal: number;
  discountTotal: number;
  taxableTotal: number;
  nonTaxableTotal: number;
  taxTotal: number;
  tdsTotal: number;
  total: number;
}

@Injectable()
export class ExpenseService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(ExpenseEntity)
    private readonly expenseRepo: Repository<ExpenseEntity>,
    private readonly audit: AuditService,
    private readonly documentSequenceService: DocumentSequenceService,
    private readonly journalService: JournalService,
    private readonly nepaliDate: NepaliDateConverter,
  ) {}

  // ---- Mutations ----------------------------------------------------------

  async create(
    organizationId: string,
    actorId: string,
    dto: CreateExpenseDto,
  ): Promise<ExpenseEntity> {
    return this.dataSource.transaction(async (manager) => {
      this.assertModeRules(dto.expenseMode, dto.partyId, dto.paymentAccountId);

      const partyId = dto.partyId
        ? await this.requireParty(manager, organizationId, dto.partyId)
        : null;
      const paymentAccountId = dto.paymentAccountId
        ? (
            await this.requirePaymentAccount(
              manager,
              organizationId,
              dto.paymentAccountId,
            )
          ).id
        : null;
      if (dto.paymentMethodId) {
        await this.requirePaymentMethod(
          manager,
          organizationId,
          dto.paymentMethodId,
        );
      }

      const prepared = await this.prepareExpense(
        manager,
        organizationId,
        dto.lines,
      );
      if (prepared.subtotal <= 0) throw new ExpenseZeroAmountException();

      const expenseRepo = manager.getRepository(ExpenseEntity);
      const expense = await expenseRepo.save(
        expenseRepo.create({
          organizationId,
          branchId: dto.branchId ?? null,
          expenseNumber: null,
          partyId,
          paymentMethodId: dto.paymentMethodId ?? null,
          paymentAccountId,
          expenseMode: dto.expenseMode,
          status: 'DRAFT',
          taxableTotal: prepared.taxableTotal.toFixed(2),
          nonTaxableTotal: prepared.nonTaxableTotal.toFixed(2),
          subtotal: prepared.subtotal.toFixed(2),
          discountTotal: prepared.discountTotal.toFixed(2),
          taxTotal: prepared.taxTotal.toFixed(2),
          tdsTotal: prepared.tdsTotal.toFixed(2),
          total: prepared.total.toFixed(2),
          purpose: dto.purpose ?? null,
          notes: dto.notes ?? null,
        }),
      );

      await this.saveLines(manager, organizationId, expense.id, prepared.lines);

      await this.audit.record(
        {
          organizationId,
          branchId: expense.branchId,
          userId: actorId,
          action: EXPENSE_AUDIT_ACTIONS.CREATE,
          entityType: 'expense',
          entityId: expense.id,
          newData: {
            status: 'DRAFT',
            expenseMode: expense.expenseMode,
            partyId,
            total: prepared.total.toFixed(2),
            tdsTotal: prepared.tdsTotal.toFixed(2),
            lineCount: prepared.lines.length,
          },
        },
        manager,
      );

      return this.buildExpenseView(manager, organizationId, expense.id);
    });
  }

  async update(
    organizationId: string,
    actorId: string,
    id: string,
    dto: UpdateExpenseDto,
  ): Promise<ExpenseEntity> {
    return this.dataSource.transaction(async (manager) => {
      const expense = await this.requireExpense(manager, organizationId, id);
      if (expense.status !== 'DRAFT') {
        throw new ExpenseNotDraftException(id, expense.status, 'update');
      }

      const expenseMode = dto.expenseMode ?? expense.expenseMode;
      const partyId = dto.partyId ?? expense.partyId ?? undefined;
      const paymentAccountId =
        dto.paymentAccountId ?? expense.paymentAccountId ?? undefined;
      this.assertModeRules(expenseMode, partyId, paymentAccountId);

      if (dto.partyId !== undefined && dto.partyId !== expense.partyId) {
        expense.partyId = await this.requireParty(
          manager,
          organizationId,
          dto.partyId,
        );
      } else if (dto.partyId === null && expense.partyId) {
        expense.partyId = null;
      }
      if (
        dto.paymentAccountId !== undefined &&
        dto.paymentAccountId !== expense.paymentAccountId
      ) {
        expense.paymentAccountId = (
          await this.requirePaymentAccount(
            manager,
            organizationId,
            dto.paymentAccountId,
          )
        ).id;
      } else if (dto.paymentAccountId === null && expense.paymentAccountId) {
        expense.paymentAccountId = null;
      }
      if (
        dto.paymentMethodId !== undefined &&
        dto.paymentMethodId !== expense.paymentMethodId
      ) {
        await this.requirePaymentMethod(
          manager,
          organizationId,
          dto.paymentMethodId,
        );
        expense.paymentMethodId = dto.paymentMethodId;
      }
      if (dto.expenseMode !== undefined) expense.expenseMode = expenseMode;
      if (dto.branchId !== undefined) expense.branchId = dto.branchId;
      if (dto.purpose !== undefined) expense.purpose = dto.purpose;
      if (dto.notes !== undefined) expense.notes = dto.notes;

      const effectiveLines =
        dto.lines ?? (await this.toLineDtos(manager, expense));
      const prepared = await this.prepareExpense(
        manager,
        organizationId,
        effectiveLines,
      );
      if (prepared.subtotal <= 0) throw new ExpenseZeroAmountException();

      expense.taxableTotal = prepared.taxableTotal.toFixed(2);
      expense.nonTaxableTotal = prepared.nonTaxableTotal.toFixed(2);
      expense.subtotal = prepared.subtotal.toFixed(2);
      expense.discountTotal = prepared.discountTotal.toFixed(2);
      expense.taxTotal = prepared.taxTotal.toFixed(2);
      expense.tdsTotal = prepared.tdsTotal.toFixed(2);
      expense.total = prepared.total.toFixed(2);

      const lineRepo = manager.getRepository(ExpenseLineEntity);
      await lineRepo.delete({ expenseId: expense.id });
      await this.saveLines(manager, organizationId, expense.id, prepared.lines);
      await manager.getRepository(ExpenseEntity).save(expense);

      await this.audit.record(
        {
          organizationId,
          branchId: expense.branchId,
          userId: actorId,
          action: EXPENSE_AUDIT_ACTIONS.UPDATE,
          entityType: 'expense',
          entityId: expense.id,
          newData: {
            status: 'DRAFT',
            expenseMode: expense.expenseMode,
            partyId: expense.partyId,
            total: expense.total,
            discountTotal: expense.discountTotal,
            lineCount: prepared.lines.length,
          },
        },
        manager,
      );

      return this.buildExpenseView(manager, organizationId, expense.id);
    });
  }

  /**
   * Posts a draft: re-validates the mode rules and every line's account,
   * reserves the `EXP-` number, and posts the balanced expense journal —
   * DR each expense account (gross − discount) + DR VAT Receivable 1105,
   * CR the payment account (CASH) or AP 2101 with the party (CREDIT) +
   * CR TDS Payable 2103 — all in one transaction.
   */
  async post(
    organizationId: string,
    actorId: string,
    id: string,
  ): Promise<ExpenseEntity> {
    const postedId = await this.dataSource.transaction(async (manager) => {
      const expense = await this.requireExpense(manager, organizationId, id);
      if (expense.status !== 'DRAFT') {
        throw new ExpenseNotDraftException(id, expense.status, 'post');
      }

      const expenseMode = expense.expenseMode;
      this.assertModeRules(
        expenseMode,
        expense.partyId ?? undefined,
        expense.paymentAccountId ?? undefined,
      );
      if (expense.partyId) {
        await this.requireParty(manager, organizationId, expense.partyId);
      }
      if (expense.paymentAccountId) {
        await this.requirePaymentAccount(
          manager,
          organizationId,
          expense.paymentAccountId,
        );
      }

      const lines = await manager.getRepository(ExpenseLineEntity).find({
        where: { expenseId: expense.id },
        order: { lineNo: 'ASC' },
      });
      if (lines.length === 0) throw new ExpenseZeroAmountException();
      for (const line of lines) {
        if (Number(line.quantity) <= 0) {
          throw new ExpenseZeroQuantityException();
        }
        if (Number(line.lineTotal) > 0) {
          await this.requireExpenseAccount(
            manager,
            organizationId,
            line.expenseAccountId,
          );
        }
      }

      const today = new Date();
      const todayBs = this.toBs(today);
      const fiscalYear = await this.resolveFiscalYear(
        manager,
        organizationId,
        today,
      );

      const expenseNumber = await this.documentSequenceService.nextNumber(
        {
          organizationId,
          branchId: expense.branchId,
          fiscalYearId: fiscalYear.id,
          documentType: EXPENSE_DOCUMENT_TYPE,
          prefix: EXPENSE_NUMBER_PREFIX,
        },
        manager,
      );

      const journalBranchId =
        expense.branchId ??
        (await this.requireDefaultBranch(manager, organizationId));
      const journal = await this.journalFor(
        manager,
        organizationId,
        expense,
        lines,
      );
      const entry = await this.journalService.createDraftIn(
        manager,
        organizationId,
        {
          branchId: journalBranchId,
          entryDate: today.toISOString().slice(0, 10),
          description: `Expense ${expenseNumber}`,
          lines: journal,
        },
        actorId,
      );
      await this.journalService.postIn(
        manager,
        organizationId,
        entry.id,
        actorId,
      );
      // Retry idempotency: a re-run of this POST can never mint a second
      // journal for the same expense (uq_journal_entries_source).
      await manager.getRepository(JournalEntryEntity).update(entry.id, {
        sourceType: 'expense',
        sourceId: expense.id,
      });

      expense.status = 'POSTED';
      expense.expenseNumber = expenseNumber;
      expense.expenseDate = today.toISOString().slice(0, 10);
      expense.expenseDateBs = todayBs;
      expense.fiscalYearId = fiscalYear.id;
      expense.journalEntryId = entry.id;
      await manager.getRepository(ExpenseEntity).save(expense);

      await this.audit.record(
        {
          organizationId,
          branchId: expense.branchId,
          userId: actorId,
          action: EXPENSE_AUDIT_ACTIONS.POST,
          entityType: 'expense',
          entityId: expense.id,
          newData: {
            expenseNumber,
            status: 'POSTED',
            journalEntryId: entry.id,
            total: expense.total,
            tdsTotal: expense.tdsTotal,
            lineCount: lines.length,
          },
        },
        manager,
      );

      return expense.id;
    });

    return this.get(organizationId, postedId);
  }

  async voidExpense(
    organizationId: string,
    actorId: string,
    id: string,
  ): Promise<ExpenseEntity> {
    return this.dataSource.transaction(async (manager) => {
      const expense = await this.requireExpense(manager, organizationId, id);
      if (expense.status !== 'DRAFT') {
        throw new ExpenseNotDraftException(id, expense.status, 'void');
      }

      expense.status = 'CANCELLED';
      await manager.getRepository(ExpenseEntity).save(expense);
      await this.audit.record(
        {
          organizationId,
          branchId: expense.branchId,
          userId: actorId,
          action: EXPENSE_AUDIT_ACTIONS.VOID,
          entityType: 'expense',
          entityId: expense.id,
          newData: { status: 'CANCELLED' },
        },
        manager,
      );

      return this.buildExpenseView(manager, organizationId, expense.id);
    });
  }

  // ---- Reads --------------------------------------------------------------

  async get(organizationId: string, id: string): Promise<ExpenseEntity> {
    return this.buildExpenseView(this.dataSource.manager, organizationId, id);
  }

  async list(
    organizationId: string,
    query: ExpenseQueryDto,
  ): Promise<[ExpenseEntity[], number]> {
    const qb = this.expenseRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.party', 'party')
      .leftJoinAndSelect('e.paymentAccount', 'paymentAccount')
      .where('e.organization_id = :organizationId', { organizationId });

    if (query.status)
      qb.andWhere('e.status = :status', { status: query.status });
    if (query.expenseMode)
      qb.andWhere('e.expense_mode = :expenseMode', {
        expenseMode: query.expenseMode,
      });
    if (query.partyId)
      qb.andWhere('e.party_id = :partyId', { partyId: query.partyId });

    const total = await qb.getCount();
    const rows = await qb
      .orderBy('e.createdAt', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getMany();
    return [rows, total];
  }

  // ---- Preparation --------------------------------------------------------

  private async prepareExpense(
    manager: EntityManager,
    organizationId: string,
    lines: ExpenseLineDto[],
  ): Promise<PreparedExpense> {
    const prepared: PreparedExpenseLine[] = [];
    for (const [index, dtoLine] of lines.entries()) {
      if (!dtoLine.expenseAccountId || !dtoLine.description?.trim()) {
        throw new ExpenseLineIncompleteException(index);
      }
      const account = await this.requireExpenseAccount(
        manager,
        organizationId,
        dtoLine.expenseAccountId,
      );
      const tax = await this.resolveTaxCode(
        manager,
        organizationId,
        dtoLine.taxCodeId,
      );
      const tds = await this.resolveTdsCode(
        manager,
        organizationId,
        dtoLine.tdsTaxCodeId,
      );

      const quantity = dtoLine.quantity;
      const unitAmount = dtoLine.unitAmount;
      if (quantity <= 0) throw new ExpenseZeroQuantityException();
      const grossAmount = ROUND2(quantity * unitAmount);
      const discountPercent = ROUND4(dtoLine.discountPercent ?? 0);
      const discountAmount = ROUND2(
        grossAmount * Math.min(100, Math.max(0, discountPercent / 100)),
      );
      const taxableBase = ROUND2(grossAmount - discountAmount);
      const isTaxable = tax.rate > 0;
      const taxableAmount = isTaxable ? taxableBase : 0;
      const taxAmount = isTaxable ? ROUND2(taxableBase * (tax.rate / 100)) : 0;
      const tdsAmount = ROUND2(taxableAmount * (tds.rate / 100));
      const lineTotal = ROUND2(taxableBase + taxAmount);

      prepared.push({
        lineNo: index + 1,
        expenseAccountId: account.id,
        description: dtoLine.description.trim(),
        quantity,
        unitAmount,
        grossAmount,
        discountPercent,
        discountAmount,
        taxCodeId: tax.codeId,
        taxableAmount,
        taxRate: tax.rate,
        taxAmount,
        tdsTaxCodeId: tds.codeId,
        tdsRate: tds.rate,
        tdsAmount,
        lineTotal,
      });
    }

    const subtotal = ROUND2(
      prepared.reduce(
        (sum, line) => sum + (line.grossAmount - line.discountAmount),
        0,
      ),
    );
    const discountTotal = ROUND2(
      prepared.reduce((sum, line) => sum + line.discountAmount, 0),
    );
    const taxableTotal = ROUND2(
      prepared.reduce((sum, line) => sum + line.taxableAmount, 0),
    );
    const nonTaxableTotal = ROUND2(
      prepared.reduce(
        (sum, line) =>
          sum +
          (line.taxableAmount === 0
            ? line.grossAmount - line.discountAmount
            : 0),
        0,
      ),
    );
    const taxTotal = ROUND2(
      prepared.reduce((sum, line) => sum + line.taxAmount, 0),
    );
    const tdsTotal = ROUND2(
      prepared.reduce((sum, line) => sum + line.tdsAmount, 0),
    );
    const total = ROUND2(subtotal + taxTotal);

    return {
      lines: prepared,
      subtotal,
      discountTotal,
      taxableTotal,
      nonTaxableTotal,
      taxTotal,
      tdsTotal,
      total,
    };
  }

  /**
   * Input-VAT resolution: line override → first active `TAXABLE` org code.
   * TDS withholding codes are rejected here — they belong in `tdsTaxCodeId`
   * (decision 43).
   */
  private async resolveTaxCode(
    manager: EntityManager,
    organizationId: string,
    overrideCodeId: string | null | undefined,
  ): Promise<{ codeId: string | null; rate: number }> {
    const repo = manager.getRepository(TaxCodeEntity);
    let code: TaxCodeEntity | null = null;

    if (overrideCodeId) {
      code =
        (await repo.findOne({
          where: { id: overrideCodeId, organizationId, isActive: true },
        })) ?? null;
    }
    if (!code) {
      code =
        (await repo.findOne({
          where: { organizationId, irdCategory: 'TAXABLE', isActive: true },
          order: { name: 'ASC' },
        })) ?? null;
    }
    if (!code) {
      return { codeId: null, rate: 0 };
    }
    if (code.irdCategory === 'TDS_WITHHOLDING') {
      throw new ExpenseTdsWithholdingException(code.name);
    }
    return { codeId: code.id, rate: Number(code.rate) };
  }

  private async resolveTdsCode(
    manager: EntityManager,
    organizationId: string,
    tdsTaxCodeId: string | null | undefined,
  ): Promise<{ codeId: string | null; rate: number }> {
    if (!tdsTaxCodeId) return { codeId: null, rate: 0 };
    const code = await manager.getRepository(TaxCodeEntity).findOne({
      where: { id: tdsTaxCodeId, organizationId, isActive: true },
    });
    if (!code || code.irdCategory !== 'TDS_WITHHOLDING') {
      throw new ExpenseTdsCodeInvalidException(tdsTaxCodeId);
    }
    return { codeId: code.id, rate: Number(code.rate) };
  }

  // ---- Journal ------------------------------------------------------------

  /**
   * Balanced expense journal (decision 43):
   *   DR each expense account (gross − line discount, aggregated per account)
   *   DR VAT Receivable 1105 (Σ input VAT)
   *   CR TDS Payable 2103 (Σ withheld — the CR leg is net of TDS)
   *   CR payment account (CASH mode) or AP 2101 with the party (CREDIT mode)
   *   for `total − tds_total`.
   * DR Σ = subtotal + tax_total = total, so the entry always balances.
   */
  private async journalFor(
    manager: EntityManager,
    organizationId: string,
    expense: ExpenseEntity,
    lines: ExpenseLineEntity[],
  ): Promise<
    Array<{
      accountId: string;
      partyId?: string;
      debit?: number;
      credit?: number;
      description?: string;
    }>
  > {
    const total = Number(expense.total);
    const taxTotal = Number(expense.taxTotal);
    const tdsTotal = Number(expense.tdsTotal);

    const byAccount = new Map<string, number>();
    for (const line of lines) {
      const net = ROUND2(
        Number(line.grossAmount) - Number(line.discountAmount),
      );
      byAccount.set(
        line.expenseAccountId,
        ROUND2((byAccount.get(line.expenseAccountId) ?? 0) + net),
      );
    }

    const out: Array<{
      accountId: string;
      partyId?: string;
      debit?: number;
      credit?: number;
      description?: string;
    }> = [];
    for (const [accountId, amount] of byAccount) {
      out.push({ accountId, debit: amount, description: 'Expense' });
    }

    if (taxTotal > 0) {
      const vatReceivable = await this.requirePurposeAccount(
        manager,
        organizationId,
        'TAX_RECEIVABLE',
      );
      out.push({
        accountId: vatReceivable.id,
        debit: taxTotal,
        description: 'Input VAT',
      });
    }

    const creditAmount = ROUND2(total - tdsTotal);
    if (expense.expenseMode === 'CASH') {
      out.push({
        accountId: expense.paymentAccountId!,
        credit: creditAmount,
        description: 'Expense paid',
      });
    } else {
      const ap = await this.requirePurposeAccount(
        manager,
        organizationId,
        'ACCOUNTS_PAYABLE',
      );
      out.push({
        accountId: ap.id,
        partyId: expense.partyId!,
        credit: creditAmount,
        description: 'Expense on credit',
      });
    }

    if (tdsTotal > 0) {
      const tdsPayable = await this.requirePurposeAccount(
        manager,
        organizationId,
        'TDS_PAYABLE',
      );
      out.push({
        accountId: tdsPayable.id,
        credit: tdsTotal,
        description: 'TDS withheld',
      });
    }
    return out;
  }

  private async requirePurposeAccount(
    manager: EntityManager,
    organizationId: string,
    purpose: SystemPurpose,
  ): Promise<AccountEntity> {
    const account = await manager.getRepository(AccountEntity).findOne({
      where: { organizationId, systemPurpose: purpose, isActive: true },
    });
    if (!account) {
      throw new ExpenseAccountMissingException(purpose);
    }
    return account;
  }

  // ---- Shared -------------------------------------------------------------

  private assertModeRules(
    expenseMode: string,
    partyId: string | null | undefined,
    paymentAccountId: string | null | undefined,
  ): void {
    if (expenseMode === 'CREDIT' && !partyId) {
      throw new ExpenseModePartyRequiredException();
    }
    if (expenseMode === 'CASH' && !paymentAccountId) {
      throw new ExpensePaymentAccountMissingException();
    }
  }

  private async requireParty(
    manager: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<string> {
    const party = await manager.getRepository(PartyEntity).findOne({
      where: { id, organizationId, isActive: true },
    });
    if (!party) throw new ExpensePartyNotFoundException(id);
    return party.id;
  }

  private async requirePaymentAccount(
    manager: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<AccountEntity> {
    const account = await manager.getRepository(AccountEntity).findOne({
      where: { id, organizationId, isActive: true },
    });
    if (!account) throw new ExpensePaymentAccountNotFoundException(id);
    if (account.coaType !== 'ASSET' || account.isGroup) {
      throw new ExpensePaymentAccountTypeException(id);
    }
    return account;
  }

  private async requireExpenseAccount(
    manager: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<AccountEntity> {
    const account = await manager.getRepository(AccountEntity).findOne({
      where: { id, organizationId, isActive: true },
    });
    if (!account) throw new ExpenseAccountTypeException(id);
    if (account.coaType !== 'EXPENSE' || account.isGroup) {
      throw new ExpenseAccountTypeException(id);
    }
    return account;
  }

  private async requirePaymentMethod(
    manager: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<void> {
    const method = await manager.getRepository(PaymentMethodEntity).findOne({
      where: { id, organizationId, isActive: true },
    });
    if (!method) throw new ExpensePaymentMethodNotFoundException(id);
  }

  private async saveLines(
    manager: EntityManager,
    organizationId: string,
    expenseId: string,
    lines: PreparedExpenseLine[],
  ): Promise<void> {
    const lineRepo = manager.getRepository(ExpenseLineEntity);
    await lineRepo.save(
      lines.map((line) =>
        lineRepo.create({
          organizationId,
          expenseId,
          lineNo: line.lineNo,
          expenseAccountId: line.expenseAccountId,
          description: line.description,
          quantity: line.quantity.toFixed(3),
          unitAmount: line.unitAmount.toFixed(2),
          grossAmount: line.grossAmount.toFixed(2),
          discountPercent: line.discountPercent.toFixed(4),
          discountAmount: line.discountAmount.toFixed(2),
          taxCodeId: line.taxCodeId,
          taxableAmount: line.taxableAmount.toFixed(2),
          taxRate: line.taxRate.toFixed(4),
          taxAmount: line.taxAmount.toFixed(2),
          tdsTaxCodeId: line.tdsTaxCodeId,
          tdsRate: line.tdsRate.toFixed(4),
          tdsAmount: line.tdsAmount.toFixed(2),
          lineTotal: line.lineTotal.toFixed(2),
        }),
      ),
    );
  }

  private async toLineDtos(
    manager: EntityManager,
    expense: ExpenseEntity,
  ): Promise<ExpenseLineDto[]> {
    const lines = await manager.getRepository(ExpenseLineEntity).find({
      where: { expenseId: expense.id },
      order: { lineNo: 'ASC' },
    });
    return lines.map((line) => ({
      expenseAccountId: line.expenseAccountId,
      description: line.description,
      quantity: Number(line.quantity),
      unitAmount: Number(line.unitAmount),
      discountPercent: Number(line.discountPercent),
      taxCodeId: line.taxCodeId ?? undefined,
      tdsTaxCodeId: line.tdsTaxCodeId ?? undefined,
    }));
  }

  private async requireExpense(
    manager: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<ExpenseEntity> {
    const expense = await manager.getRepository(ExpenseEntity).findOne({
      where: { id, organizationId },
      relations: { party: true },
    });
    if (!expense) throw new ExpenseNotFoundException(id);
    return expense;
  }

  private async buildExpenseView(
    manager: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<ExpenseEntity> {
    const expense = await manager.getRepository(ExpenseEntity).findOne({
      where: { id, organizationId },
      relations: {
        party: true,
        branch: true,
        fiscalYear: true,
        paymentMethod: true,
        paymentAccount: true,
        journalEntry: true,
      },
    });
    if (!expense) throw new ExpenseNotFoundException(id);
    expense.lines = await manager.getRepository(ExpenseLineEntity).find({
      where: { expenseId: expense.id },
      relations: { expenseAccount: true, taxCode: true, tdsTaxCode: true },
      order: { lineNo: 'ASC' },
    });
    return expense;
  }

  private async resolveFiscalYear(
    manager: EntityManager,
    organizationId: string,
    date: Date,
  ): Promise<FiscalYearEntity> {
    const fiscalYear = await manager.getRepository(FiscalYearEntity).findOne({
      where: {
        organizationId,
        isActive: true,
        isClosed: false,
        startDate: LessThanOrEqual(date),
        endDate: MoreThanOrEqual(date),
      },
    });
    if (!fiscalYear) {
      throw new ExpenseFiscalYearMissingException();
    }
    return fiscalYear;
  }

  private async requireDefaultBranch(
    manager: EntityManager,
    organizationId: string,
  ): Promise<string> {
    const branch = await manager.getRepository(BranchEntity).findOne({
      where: { organizationId, isActive: true },
      order: { name: 'ASC' },
    });
    if (!branch) {
      throw new ExpenseAccountMissingException('BRANCH');
    }
    return branch.id;
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
