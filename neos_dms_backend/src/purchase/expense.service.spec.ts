import { DataSource } from 'typeorm';
import { JournalEntryEntity } from '../accounting/entities/journal-entry.entity';
import { CreateExpenseDto } from './dto/expense.dto';
import { ExpenseEntity } from './entities/expense.entity';
import { ExpenseService } from './expense.service';
import {
  AP_ACCOUNT_ID,
  beginTestTransaction,
  CASH_ACCOUNT_ID,
  createExpenseTestingModule,
  endTestTransaction,
  EXEMPT_TAX_CODE_ID,
  FISCAL_YEAR_ID,
  MANAGER_USER_ID,
  seedExpenseBaseline,
  seedSalesOrderParties,
  SUPPLIER_PARTY_ID,
  TDS_PAYABLE_ACCOUNT_ID,
  TDS_TAX_CODE_ID,
  TEST_ORG_ID,
  TRAVEL_ACCOUNT_ID,
  type TestTransaction,
  VAT_RECEIVABLE_ACCOUNT_ID,
} from '../testing/expense-test.harness';
import { createTestDataSource } from '../testing/test-db';
import {
  ExpenseAccountTypeException,
  ExpenseModePartyRequiredException,
  ExpenseNotDraftException,
  ExpensePartyNotFoundException,
  ExpensePaymentAccountMissingException,
  ExpensePaymentMethodNotFoundException,
  ExpenseTdsWithholdingException,
  ExpenseZeroAmountException,
} from './purchase.errors';

describe('ExpenseService', () => {
  let dataSource: DataSource;
  let service: ExpenseService;
  let tx: TestTransaction;

  const actor = MANAGER_USER_ID;

  const line = (overrides: Record<string, unknown> = {}) => ({
    expenseAccountId: TRAVEL_ACCOUNT_ID,
    description: 'Site visit cab',
    quantity: 1,
    unitAmount: 100,
    ...overrides,
  });

  const cashDto = (
    overrides: Partial<CreateExpenseDto> = {},
  ): CreateExpenseDto => ({
    expenseMode: 'CASH',
    paymentAccountId: CASH_ACCOUNT_ID,
    lines: [line()],
    ...overrides,
  });

  const creditDto = (
    overrides: Partial<CreateExpenseDto> = {},
  ): CreateExpenseDto => ({
    expenseMode: 'CREDIT',
    partyId: SUPPLIER_PARTY_ID,
    lines: [line()],
    ...overrides,
  });

  async function journalFor(expenseId: string) {
    const expense = await service.get(TEST_ORG_ID, expenseId);
    return tx.manager.getRepository(JournalEntryEntity).findOneOrFail({
      where: { id: expense.journalEntryId! },
      relations: { lines: { account: true } },
    });
  }

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    await seedExpenseBaseline(dataSource);
    const module = await createExpenseTestingModule(dataSource);
    service = module.get(ExpenseService);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    tx = await beginTestTransaction(dataSource);
    await seedSalesOrderParties(dataSource);
  });

  afterEach(async () => {
    await endTestTransaction(dataSource, tx);
  });

  describe('create', () => {
    it('creates a cash expense draft with VAT totals', async () => {
      const expense = await service.create(TEST_ORG_ID, actor, cashDto());

      expect(expense.status).toBe('DRAFT');
      expect(expense.expenseNumber).toBeNull();
      expect(expense.expenseMode).toBe('CASH');
      expect(expense.paymentAccountId).toBe(CASH_ACCOUNT_ID);
      expect(expense.subtotal).toBe('100.00');
      expect(expense.taxableTotal).toBe('100.00');
      expect(expense.nonTaxableTotal).toBe('0.00');
      expect(expense.discountTotal).toBe('0.00');
      expect(expense.taxTotal).toBe('13.00');
      expect(expense.tdsTotal).toBe('0.00');
      expect(expense.total).toBe('113.00');
      expect(expense.lines).toHaveLength(1);
      expect(expense.lines[0].expenseAccountId).toBe(TRAVEL_ACCOUNT_ID);
      expect(expense.lines[0].quantity).toBe('1.000');
      expect(expense.lines[0].taxRate).toBe('13.0000');
      expect(expense.lines[0].taxAmount).toBe('13.00');
      expect(expense.lines[0].lineTotal).toBe('113.00');
    });

    it('creates a credit expense draft', async () => {
      const expense = await service.create(TEST_ORG_ID, actor, creditDto());

      expect(expense.expenseMode).toBe('CREDIT');
      expect(expense.partyId).toBe(SUPPLIER_PARTY_ID);
      expect(expense.total).toBe('113.00');
    });

    it('nettes a per-line discount into the expense amount', async () => {
      const expense = await service.create(
        TEST_ORG_ID,
        actor,
        cashDto({
          lines: [line({ quantity: 10, unitAmount: 100, discountPercent: 10 })],
        }),
      );

      expect(expense.subtotal).toBe('900.00');
      expect(expense.discountTotal).toBe('100.00');
      expect(expense.taxableTotal).toBe('900.00');
      expect(expense.taxTotal).toBe('117.00');
      expect(expense.total).toBe('1017.00');
      expect(expense.lines[0].discountAmount).toBe('100.00');
      expect(expense.lines[0].lineTotal).toBe('1017.00');
    });

    it('withholds per-line TDS on the taxable amount', async () => {
      const expense = await service.create(
        TEST_ORG_ID,
        actor,
        cashDto({
          lines: [line({ tdsTaxCodeId: TDS_TAX_CODE_ID })],
        }),
      );

      expect(expense.lines[0].tdsRate).toBe('1.5000');
      expect(expense.lines[0].tdsAmount).toBe('1.50');
      expect(expense.tdsTotal).toBe('1.50');
      expect(expense.total).toBe('113.00');
    });

    it('treats an exempt line as non-taxable', async () => {
      const expense = await service.create(
        TEST_ORG_ID,
        actor,
        cashDto({
          lines: [line({ taxCodeId: EXEMPT_TAX_CODE_ID })],
        }),
      );

      expect(expense.taxableTotal).toBe('0.00');
      expect(expense.nonTaxableTotal).toBe('100.00');
      expect(expense.taxTotal).toBe('0.00');
      expect(expense.total).toBe('100.00');
    });

    it('requires a party in credit mode', async () => {
      await expect(
        service.create(
          TEST_ORG_ID,
          actor,
          cashDto({ expenseMode: 'CREDIT', partyId: undefined }),
        ),
      ).rejects.toThrow(ExpenseModePartyRequiredException);
    });

    it('requires a payment account in cash mode', async () => {
      await expect(
        service.create(
          TEST_ORG_ID,
          actor,
          creditDto({ expenseMode: 'CASH', paymentAccountId: undefined }),
        ),
      ).rejects.toThrow(ExpensePaymentAccountMissingException);
    });

    it('rejects an account that is not an expense type', async () => {
      await expect(
        service.create(
          TEST_ORG_ID,
          actor,
          cashDto({ lines: [line({ expenseAccountId: CASH_ACCOUNT_ID })] }),
        ),
      ).rejects.toThrow(ExpenseAccountTypeException);
    });

    it('rejects a TDS withholding code in the VAT taxCodeId', async () => {
      await expect(
        service.create(
          TEST_ORG_ID,
          actor,
          cashDto({ lines: [line({ taxCodeId: TDS_TAX_CODE_ID })] }),
        ),
      ).rejects.toThrow(ExpenseTdsWithholdingException);
    });

    it('rejects an unknown party', async () => {
      await expect(
        service.create(
          TEST_ORG_ID,
          actor,
          creditDto({
            partyId: '00000000-0000-4000-8000-000000000099',
          }),
        ),
      ).rejects.toThrow(ExpensePartyNotFoundException);
    });

    it('rejects an unknown payment method', async () => {
      await expect(
        service.create(
          TEST_ORG_ID,
          actor,
          cashDto({ paymentMethodId: '00000000-0000-4000-8000-000000000099' }),
        ),
      ).rejects.toThrow(ExpensePaymentMethodNotFoundException);
    });

    it('rejects a zero-amount expense', async () => {
      await expect(
        service.create(
          TEST_ORG_ID,
          actor,
          cashDto({ lines: [line({ unitAmount: 0 })] }),
        ),
      ).rejects.toThrow(ExpenseZeroAmountException);
    });
  });

  describe('update', () => {
    it('replaces lines and recomputes totals on a draft', async () => {
      const created = await service.create(TEST_ORG_ID, actor, cashDto());

      const updated = await service.update(TEST_ORG_ID, actor, created.id, {
        purpose: 'client meeting',
        notes: 'revised',
        lines: [line({ quantity: 2, unitAmount: 100 })],
      });

      expect(updated.purpose).toBe('client meeting');
      expect(updated.notes).toBe('revised');
      expect(updated.subtotal).toBe('200.00');
      expect(updated.taxTotal).toBe('26.00');
      expect(updated.total).toBe('226.00');
      expect(updated.lines).toHaveLength(1);
    });

    it('rejects updating a posted expense', async () => {
      const created = await service.create(TEST_ORG_ID, actor, cashDto());
      await service.post(TEST_ORG_ID, actor, created.id);

      await expect(
        service.update(TEST_ORG_ID, actor, created.id, { notes: 'nope' }),
      ).rejects.toThrow(ExpenseNotDraftException);
    });
  });

  describe('post', () => {
    it('posts the balanced cash journal and links the entry', async () => {
      const created = await service.create(TEST_ORG_ID, actor, cashDto());

      const posted = await service.post(TEST_ORG_ID, actor, created.id);

      expect(posted.status).toBe('POSTED');
      expect(posted.expenseNumber).toMatch(/^EXP-/);
      expect(posted.expenseDate).toBeTruthy();
      expect(posted.expenseDateBs).toBeTruthy();
      expect(posted.fiscalYearId).toBe(FISCAL_YEAR_ID);
      expect(posted.journalEntryId).toBeTruthy();

      const journal = await journalFor(posted.id);
      expect(journal.status).toBe('POSTED');
      expect(journal.sourceType).toBe('expense');
      expect(journal.sourceId).toBe(created.id);
      const byAccount = new Map(
        journal.lines.map((entryLine) => [entryLine.account.id, entryLine]),
      );
      expect(Number(byAccount.get(TRAVEL_ACCOUNT_ID)?.debitAmount)).toBe(100);
      expect(
        Number(byAccount.get(VAT_RECEIVABLE_ACCOUNT_ID)?.debitAmount),
      ).toBe(13);
      expect(Number(byAccount.get(CASH_ACCOUNT_ID)?.creditAmount)).toBe(113);

      const totalDebit = journal.lines.reduce(
        (sum, entryLine) => sum + Number(entryLine.debitAmount),
        0,
      );
      const totalCredit = journal.lines.reduce(
        (sum, entryLine) => sum + Number(entryLine.creditAmount),
        0,
      );
      expect(totalDebit).toBe(totalCredit);
    });

    it('posts a credit-mode journal against AP with the vendor party', async () => {
      const created = await service.create(TEST_ORG_ID, actor, creditDto());

      const posted = await service.post(TEST_ORG_ID, actor, created.id);

      const journal = await journalFor(posted.id);
      const byAccount = new Map(
        journal.lines.map((entryLine) => [entryLine.account.id, entryLine]),
      );
      expect(byAccount.get(AP_ACCOUNT_ID)?.partyId).toBe(SUPPLIER_PARTY_ID);
      expect(Number(byAccount.get(AP_ACCOUNT_ID)?.creditAmount)).toBe(113);
      expect(Number(byAccount.get(CASH_ACCOUNT_ID)?.creditAmount ?? 0)).toBe(0);
    });

    it('splits TDS off the credit leg into TDS Payable', async () => {
      const created = await service.create(
        TEST_ORG_ID,
        actor,
        cashDto({
          lines: [
            line({
              quantity: 10,
              unitAmount: 100,
              tdsTaxCodeId: TDS_TAX_CODE_ID,
            }),
          ],
        }),
      );

      const posted = await service.post(TEST_ORG_ID, actor, created.id);

      const journal = await journalFor(posted.id);
      const byAccount = new Map(
        journal.lines.map((entryLine) => [entryLine.account.id, entryLine]),
      );
      expect(Number(byAccount.get(TDS_PAYABLE_ACCOUNT_ID)?.creditAmount)).toBe(
        15,
      );
      expect(Number(byAccount.get(CASH_ACCOUNT_ID)?.creditAmount)).toBe(1115);
      expect(Number(byAccount.get(TRAVEL_ACCOUNT_ID)?.debitAmount)).toBe(1000);
      expect(
        Number(byAccount.get(VAT_RECEIVABLE_ACCOUNT_ID)?.debitAmount),
      ).toBe(130);
    });

    it('rejects posting a cancelled expense', async () => {
      const created = await service.create(TEST_ORG_ID, actor, cashDto());
      await service.voidExpense(TEST_ORG_ID, actor, created.id);

      await expect(
        service.post(TEST_ORG_ID, actor, created.id),
      ).rejects.toThrow(ExpenseNotDraftException);
    });

    it('rejects a second post of the same expense', async () => {
      const created = await service.create(TEST_ORG_ID, actor, cashDto());
      await service.post(TEST_ORG_ID, actor, created.id);

      await expect(
        service.post(TEST_ORG_ID, actor, created.id),
      ).rejects.toThrow(ExpenseNotDraftException);
    });

    it('re-validates the payment account at post', async () => {
      const created = await service.create(TEST_ORG_ID, actor, cashDto());
      await tx.manager
        .getRepository(ExpenseEntity)
        .update({ id: created.id }, { paymentAccountId: null });

      await expect(
        service.post(TEST_ORG_ID, actor, created.id),
      ).rejects.toThrow(ExpensePaymentAccountMissingException);
    });
  });

  describe('voidExpense', () => {
    it('cancels a draft and rejects voiding a posted expense', async () => {
      const draft = await service.create(TEST_ORG_ID, actor, cashDto());
      expect(
        (await service.voidExpense(TEST_ORG_ID, actor, draft.id)).status,
      ).toBe('CANCELLED');

      const posted = await service.create(TEST_ORG_ID, actor, cashDto());
      await service.post(TEST_ORG_ID, actor, posted.id);
      await expect(
        service.voidExpense(TEST_ORG_ID, actor, posted.id),
      ).rejects.toThrow(ExpenseNotDraftException);
    });
  });

  describe('list', () => {
    it('filters drafts from posted expenses and by mode', async () => {
      await service.create(TEST_ORG_ID, actor, cashDto());
      const posted = await service.create(TEST_ORG_ID, actor, cashDto());
      await service.post(TEST_ORG_ID, actor, posted.id);

      const [, draftTotal] = await service.list(TEST_ORG_ID, {
        page: 1,
        limit: 20,
        status: 'DRAFT',
      });
      expect(draftTotal).toBe(1);

      const [postedRows, postedTotal] = await service.list(TEST_ORG_ID, {
        page: 1,
        limit: 20,
        status: 'POSTED',
      });
      expect(postedTotal).toBe(1);
      expect(postedRows[0].expenseNumber).toMatch(/^EXP-/);

      const [cashRows] = await service.list(TEST_ORG_ID, {
        page: 1,
        limit: 20,
        expenseMode: 'CASH',
      });
      expect(cashRows.length).toBeGreaterThanOrEqual(2);
    });
  });
});
