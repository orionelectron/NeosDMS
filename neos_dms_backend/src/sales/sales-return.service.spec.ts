import { DataSource } from 'typeorm';
import { JournalEntryEntity } from '../accounting/entities/journal-entry.entity';
import { InventoryBalanceEntity } from '../inventory/entities/inventory-balance.entity';
import { InventoryTransactionEntity } from '../inventory/entities/inventory-transaction.entity';
import { SalesInvoiceEntity } from './entities/sales-invoice.entity';
import { SalesInvoiceLineEntity } from './entities/sales-invoice-line.entity';
import { SalesReturnEntity } from './entities/sales-return.entity';
import { SalesOrderService } from './sales-order.service';
import { SalesInvoiceService } from './sales-invoice.service';
import { SalesReturnService } from './sales-return.service';
import {
  AR_ACCOUNT_ID,
  BASE_UOM_ID,
  beginTestTransaction,
  COGS_ACCOUNT_ID,
  CUSTOMER_PARTY_ID,
  createSalesReturnTestingModule,
  endTestTransaction,
  FISCAL_YEAR_ID,
  GOODS_ITEM_ID,
  INVENTORY_ACCOUNT_ID,
  MANAGER_USER_ID,
  SALES_ACCOUNT_ID,
  SALESMAN_USER_ID,
  SECOND_CUSTOMER_PARTY_ID,
  seedSalesReturnParties,
  seedSalesReturnBaseline,
  seedStockAtLocation,
  TEST_LOCATION_ID,
  TEST_ORG_ID,
  VAT_PAYABLE_ACCOUNT_ID,
  type TestTransaction,
} from '../testing/sales-return-test.harness';
import { createTestDataSource } from '../testing/test-db';
import {
  SalesReturnCustomerMismatchException,
  SalesReturnLocationNotFoundException,
  SalesReturnNoRemainingException,
  SalesReturnNotDraftException,
  SalesReturnQuantityExceededException,
  SalesReturnSourceNotPostedException,
} from './sales.errors';

describe('SalesReturnService', () => {
  let dataSource: DataSource;
  let orderService: SalesOrderService;
  let invoiceService: SalesInvoiceService;
  let service: SalesReturnService;
  let tx: TestTransaction;

  const salesman = () => ({ id: SALESMAN_USER_ID, roleCode: null });

  const orderLine = (overrides: Record<string, unknown> = {}) => ({
    itemId: GOODS_ITEM_ID,
    uomId: BASE_UOM_ID,
    quantity: 10,
    ...overrides,
  });

  const orderDto = (overrides: Record<string, unknown> = {}) => ({
    partyId: CUSTOMER_PARTY_ID,
    lines: [orderLine()],
    ...overrides,
  });

  const invoiceLine = (orderLineId: string, quantity: number) => ({
    orderLineId,
    quantity,
  });

  async function confirmedOrder(): Promise<string> {
    const created = await orderService.create(
      TEST_ORG_ID,
      salesman(),
      orderDto(),
    );
    await orderService.confirm(TEST_ORG_ID, salesman(), created.id);
    return created.id;
  }

  async function orderLineIdOf(orderId: string): Promise<string> {
    const order = await orderService.get(TEST_ORG_ID, salesman(), orderId);
    return order.lines[0].id;
  }

  /**
   * Builds a posted invoice: 10 units @ 100 + 13% VAT = 1130, COGS at 75/unit
   * (moving average), outstanding balance 1130. Returns the invoice id and the
   * id of its single line.
   */
  async function postedInvoice(
    quantity = 10,
  ): Promise<{ invoiceId: string; invoiceLineId: string }> {
    const orderId = await confirmedOrder();
    const orderLineId = await orderLineIdOf(orderId);
    const draft = await invoiceService.create(TEST_ORG_ID, salesman(), {
      salesOrderId: orderId,
      lines: [invoiceLine(orderLineId, quantity)],
    });
    await seedStockAtLocation(
      dataSource,
      GOODS_ITEM_ID,
      100,
      TEST_LOCATION_ID,
      75,
    );
    await invoiceService.post(TEST_ORG_ID, salesman(), draft.id, {
      inventoryLocationId: TEST_LOCATION_ID,
    });
    const line = await tx.manager
      .getRepository(SalesInvoiceLineEntity)
      .findOne({ where: { invoiceId: draft.id } });
    return { invoiceId: draft.id, invoiceLineId: line.id };
  }

  const returnLine = (sourceId: string, quantity?: number) => ({
    sourceSalesInvoiceLineId: sourceId,
    ...(quantity !== undefined ? { quantity } : {}),
  });

  const returnDto = (
    lines: unknown[],
    overrides: Record<string, unknown> = {},
  ) => ({ partyId: CUSTOMER_PARTY_ID, lines, ...overrides });

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    await seedSalesReturnBaseline(dataSource);
    const module = await createSalesReturnTestingModule(dataSource);
    orderService = module.get(SalesOrderService);
    invoiceService = module.get(SalesInvoiceService);
    service = module.get(SalesReturnService);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    tx = await beginTestTransaction(dataSource);
    await seedSalesReturnParties(dataSource);
  });

  afterEach(async () => {
    await endTestTransaction(dataSource, tx);
  });

  describe('create', () => {
    it('creates a draft credit note with full-price reversal totals', async () => {
      const { invoiceLineId } = await postedInvoice();

      const salesReturn = await service.create(
        TEST_ORG_ID,
        SALESMAN_USER_ID,
        returnDto([returnLine(invoiceLineId)]),
      );

      expect(salesReturn.status).toBe('DRAFT');
      expect(salesReturn.returnNumber).toBeNull();
      expect(salesReturn.partyId).toBe(CUSTOMER_PARTY_ID);
      expect(salesReturn.subtotal).toBe('1000.00');
      expect(salesReturn.taxableTotal).toBe('1000.00');
      expect(salesReturn.nonTaxableTotal).toBe('0.00');
      expect(salesReturn.taxTotal).toBe('130.00');
      expect(salesReturn.cogsTotal).toBe('750.00');
      expect(salesReturn.total).toBe('1130.00');
      expect(salesReturn.lines).toHaveLength(1);
      expect(salesReturn.lines[0].quantity).toBe('10.000');
      expect(salesReturn.lines[0].baseQuantity).toBe('10.000');
      expect(salesReturn.lines[0].unitPrice).toBe('100.00');
      expect(salesReturn.lines[0].taxRate).toBe('13.0000');
      expect(salesReturn.lines[0].cogsUnitCost).toBe('75.00');
      expect(salesReturn.lines[0].lineTotal).toBe('1130.00');
    });

    it('supports a partial return quantity', async () => {
      const { invoiceLineId } = await postedInvoice();

      const salesReturn = await service.create(
        TEST_ORG_ID,
        SALESMAN_USER_ID,
        returnDto([returnLine(invoiceLineId, 4)]),
      );

      expect(salesReturn.subtotal).toBe('400.00');
      expect(salesReturn.taxTotal).toBe('52.00');
      expect(salesReturn.cogsTotal).toBe('300.00');
      expect(salesReturn.total).toBe('452.00');
    });

    it('rejects a quantity beyond the invoice line remaining', async () => {
      const { invoiceLineId } = await postedInvoice();

      await expect(
        service.create(
          TEST_ORG_ID,
          SALESMAN_USER_ID,
          returnDto([returnLine(invoiceLineId, 11)]),
        ),
      ).rejects.toThrow(SalesReturnQuantityExceededException);
    });

    it('rejects a source invoice line that is not posted', async () => {
      const orderId = await confirmedOrder();
      const orderLineId = await orderLineIdOf(orderId);
      const draft = await invoiceService.create(TEST_ORG_ID, salesman(), {
        salesOrderId: orderId,
        lines: [invoiceLine(orderLineId, 10)],
      });
      const line = await tx.manager
        .getRepository(SalesInvoiceLineEntity)
        .findOne({ where: { invoiceId: draft.id } });

      await expect(
        service.create(
          TEST_ORG_ID,
          SALESMAN_USER_ID,
          returnDto([returnLine(line.id)]),
        ),
      ).rejects.toThrow(SalesReturnSourceNotPostedException);
    });
  });

  describe('update', () => {
    it('replaces lines and recomputes totals on a draft', async () => {
      const { invoiceLineId } = await postedInvoice();
      const created = await service.create(
        TEST_ORG_ID,
        SALESMAN_USER_ID,
        returnDto([returnLine(invoiceLineId, 10)]),
      );

      const updated = await service.update(
        TEST_ORG_ID,
        SALESMAN_USER_ID,
        created.id,
        {
          lines: [returnLine(invoiceLineId, 2)],
          returnReason: 'wrong color',
          notes: 'revised',
        },
      );

      expect(updated.subtotal).toBe('200.00');
      expect(updated.taxTotal).toBe('26.00');
      expect(updated.cogsTotal).toBe('150.00');
      expect(updated.total).toBe('226.00');
      expect(updated.returnReason).toBe('wrong color');
      expect(updated.notes).toBe('revised');
    });

    it('rejects updating a posted return', async () => {
      const { invoiceLineId } = await postedInvoice();
      const created = await service.create(
        TEST_ORG_ID,
        SALESMAN_USER_ID,
        returnDto([returnLine(invoiceLineId, 10)]),
      );
      await service.post(TEST_ORG_ID, SALESMAN_USER_ID, created.id, {
        inventoryLocationId: TEST_LOCATION_ID,
      });

      await expect(
        service.update(TEST_ORG_ID, SALESMAN_USER_ID, created.id, {
          notes: 'nope',
        }),
      ).rejects.toThrow(SalesReturnNotDraftException);
    });
  });

  describe('post', () => {
    it('posts the reverse journal, stock-in, and stamps the source line', async () => {
      const { invoiceId, invoiceLineId } = await postedInvoice();
      const created = await service.create(
        TEST_ORG_ID,
        SALESMAN_USER_ID,
        returnDto([returnLine(invoiceLineId, 10)]),
      );

      const posted = await service.post(
        TEST_ORG_ID,
        SALESMAN_USER_ID,
        created.id,
        {
          inventoryLocationId: TEST_LOCATION_ID,
        },
      );

      expect(posted.status).toBe('POSTED');
      expect(posted.returnNumber).toMatch(/^CN-/);
      expect(posted.returnDate).toBeTruthy();
      expect(posted.returnDateBs).toBeTruthy();
      expect(posted.fiscalYearId).toBe(FISCAL_YEAR_ID);
      expect(posted.journalEntryId).toBeTruthy();
      expect(posted.inventoryTransactionId).toBeTruthy();

      const journal = await tx.manager
        .getRepository(JournalEntryEntity)
        .findOne({
          where: { id: posted.journalEntryId },
          relations: { lines: { account: true } },
        });
      expect(journal.status).toBe('POSTED');
      const byAccount = new Map(
        journal.lines.map((line) => [line.account.id, line]),
      );
      expect(Number(byAccount.get(AR_ACCOUNT_ID).creditAmount)).toBe(1130);
      expect(byAccount.get(AR_ACCOUNT_ID).partyId).toBe(CUSTOMER_PARTY_ID);
      expect(Number(byAccount.get(SALES_ACCOUNT_ID).debitAmount)).toBe(1000);
      expect(Number(byAccount.get(VAT_PAYABLE_ACCOUNT_ID).debitAmount)).toBe(
        130,
      );
      expect(Number(byAccount.get(INVENTORY_ACCOUNT_ID).debitAmount)).toBe(750);
      expect(Number(byAccount.get(COGS_ACCOUNT_ID).creditAmount)).toBe(750);

      const txn = await tx.manager
        .getRepository(InventoryTransactionEntity)
        .findOne({
          where: { id: posted.inventoryTransactionId },
          relations: { lines: true },
        });
      expect(txn.transactionType).toBe('sales_return');
      expect(txn.referenceType).toBe('sales_return');
      expect(txn.referenceId).toBe(created.id);
      expect(txn.lines[0].direction).toBe('IN');
      expect(txn.lines[0].quantity).toBe('10.000');
      expect(txn.lines[0].unitCost).toBe('75.00');

      const sourceLine = await tx.manager
        .getRepository(SalesInvoiceLineEntity)
        .findOne({ where: { id: invoiceLineId } });
      expect(sourceLine.returnedQuantity).toBe('10.000');

      const invoice = await tx.manager
        .getRepository(SalesInvoiceEntity)
        .findOne({ where: { id: invoiceId } });
      expect(invoice.balanceAmount).toBe('0.00');

      const balance = await tx.manager
        .getRepository(InventoryBalanceEntity)
        .findOne({
          where: {
            organizationId: TEST_ORG_ID,
            locationId: TEST_LOCATION_ID,
            itemId: GOODS_ITEM_ID,
          },
        });
      expect(balance.quantity).toBe('100.000');
      expect(balance.avgCost).toBe('75.00');
    });

    it('reduces the invoice balance by the returned amount on partial return', async () => {
      const { invoiceId, invoiceLineId } = await postedInvoice();
      const created = await service.create(
        TEST_ORG_ID,
        SALESMAN_USER_ID,
        returnDto([returnLine(invoiceLineId, 4)]),
      );

      await service.post(TEST_ORG_ID, SALESMAN_USER_ID, created.id, {
        inventoryLocationId: TEST_LOCATION_ID,
      });

      const invoice = await tx.manager
        .getRepository(SalesInvoiceEntity)
        .findOne({ where: { id: invoiceId } });
      expect(invoice.balanceAmount).toBe('678.00');

      const sourceLine = await tx.manager
        .getRepository(SalesInvoiceLineEntity)
        .findOne({ where: { id: invoiceLineId } });
      expect(sourceLine.returnedQuantity).toBe('4.000');
    });

    it('blocks a second return once the invoice line is exhausted', async () => {
      const { invoiceLineId } = await postedInvoice();
      const first = await service.create(
        TEST_ORG_ID,
        SALESMAN_USER_ID,
        returnDto([returnLine(invoiceLineId, 10)]),
      );
      await service.post(TEST_ORG_ID, SALESMAN_USER_ID, first.id, {
        inventoryLocationId: TEST_LOCATION_ID,
      });

      await expect(
        service.create(
          TEST_ORG_ID,
          SALESMAN_USER_ID,
          returnDto([returnLine(invoiceLineId, 1)]),
        ),
      ).rejects.toThrow(SalesReturnNoRemainingException);
    });

    it('rejects posting a return for the wrong customer party', async () => {
      const { invoiceLineId } = await postedInvoice();
      const created = await service.create(
        TEST_ORG_ID,
        SALESMAN_USER_ID,
        returnDto([returnLine(invoiceLineId, 1)]),
      );
      // Re-route the return to a different active customer than the invoice
      // owner (the draft was created for CUSTOMER_PARTY).
      await tx.manager
        .getRepository(SalesReturnEntity)
        .update({ id: created.id }, { partyId: SECOND_CUSTOMER_PARTY_ID });

      await expect(
        service.post(TEST_ORG_ID, SALESMAN_USER_ID, created.id, {
          inventoryLocationId: TEST_LOCATION_ID,
        }),
      ).rejects.toThrow(SalesReturnCustomerMismatchException);
    });

    it('requires an inventory location', async () => {
      const { invoiceLineId } = await postedInvoice();
      const created = await service.create(
        TEST_ORG_ID,
        SALESMAN_USER_ID,
        returnDto([returnLine(invoiceLineId, 1)]),
      );

      await expect(
        service.post(TEST_ORG_ID, SALESMAN_USER_ID, created.id, {
          inventoryLocationId: '00000000-0000-4000-8000-000000000001',
        }),
      ).rejects.toThrow(SalesReturnLocationNotFoundException);
    });

    it('rejects posting a cancelled return', async () => {
      const { invoiceLineId } = await postedInvoice();
      const created = await service.create(
        TEST_ORG_ID,
        SALESMAN_USER_ID,
        returnDto([returnLine(invoiceLineId, 1)]),
      );
      await service.voidReturn(TEST_ORG_ID, SALESMAN_USER_ID, created.id);

      await expect(
        service.post(TEST_ORG_ID, SALESMAN_USER_ID, created.id, {
          inventoryLocationId: TEST_LOCATION_ID,
        }),
      ).rejects.toThrow(SalesReturnNotDraftException);
    });
  });

  describe('voidReturn', () => {
    it('cancels a draft and rejects voiding a posted return', async () => {
      const { invoiceLineId } = await postedInvoice();
      const draft = await service.create(
        TEST_ORG_ID,
        SALESMAN_USER_ID,
        returnDto([returnLine(invoiceLineId, 1)]),
      );
      expect(
        (await service.voidReturn(TEST_ORG_ID, SALESMAN_USER_ID, draft.id))
          .status,
      ).toBe('CANCELLED');

      const posted = await service.create(
        TEST_ORG_ID,
        SALESMAN_USER_ID,
        returnDto([returnLine(invoiceLineId, 1)]),
      );
      await service.post(TEST_ORG_ID, SALESMAN_USER_ID, posted.id, {
        inventoryLocationId: TEST_LOCATION_ID,
      });
      await expect(
        service.voidReturn(TEST_ORG_ID, MANAGER_USER_ID, posted.id),
      ).rejects.toThrow(SalesReturnNotDraftException);
    });
  });

  describe('list', () => {
    it('filters drafts from posted returns', async () => {
      const { invoiceLineId } = await postedInvoice();
      await service.create(
        TEST_ORG_ID,
        SALESMAN_USER_ID,
        returnDto([returnLine(invoiceLineId, 1)], { notes: 'draft one' }),
      );
      const posted = await service.create(
        TEST_ORG_ID,
        SALESMAN_USER_ID,
        returnDto([returnLine(invoiceLineId, 2)]),
      );
      await service.post(TEST_ORG_ID, SALESMAN_USER_ID, posted.id, {
        inventoryLocationId: TEST_LOCATION_ID,
      });

      const [drafts, draftTotal] = await service.list(TEST_ORG_ID, {
        page: 1,
        limit: 20,
        status: 'DRAFT',
      });
      expect(draftTotal).toBe(1);
      expect(drafts[0].notes).toBe('draft one');

      const [postedRows, postedTotal] = await service.list(TEST_ORG_ID, {
        page: 1,
        limit: 20,
        status: 'POSTED',
      });
      expect(postedTotal).toBe(1);
      expect(postedRows[0].returnNumber).toMatch(/^CN-/);
    });
  });
});
