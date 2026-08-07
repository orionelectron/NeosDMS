import { DataSource } from 'typeorm';
import { JournalEntryEntity } from '../accounting/entities/journal-entry.entity';
import { SalesInvoiceEntity } from './entities/sales-invoice.entity';
import { SalesInvoiceLineEntity } from './entities/sales-invoice-line.entity';
import { CustomerReceiptEntity } from './entities/customer-receipt.entity';
import { SalesOrderService } from './sales-order.service';
import { SalesInvoiceService } from './sales-invoice.service';
import { SalesReturnService } from './sales-return.service';
import { CustomerReceiptService } from './customer-receipt.service';
import {
  AR_ACCOUNT_ID,
  BASE_UOM_ID,
  beginTestTransaction,
  CASH_ACCOUNT_ID,
  CUSTOMER_PARTY_ID,
  createSalesReturnTestingModule,
  endTestTransaction,
  GOODS_ITEM_ID,
  PAYMENT_METHOD_ID,
  SALES_ACCOUNT_ID,
  SALESMAN_USER_ID,
  SECOND_CUSTOMER_PARTY_ID,
  seedSalesReturnParties,
  seedSalesReturnBaseline,
  seedStockAtLocation,
  TEST_LOCATION_ID,
  TEST_ORG_ID,
  type TestTransaction,
} from '../testing/sales-return-test.harness';
import { createTestDataSource } from '../testing/test-db';
import {
  CustomerReceiptAccountTypeException,
  CustomerReceiptAllocationExceedsBalanceException,
  CustomerReceiptAllocationZeroException,
  CustomerReceiptInvoiceCustomerMismatchException,
  CustomerReceiptInvoiceNotPostedException,
  CustomerReceiptNotDraftException,
} from './sales.errors';

describe('CustomerReceiptService', () => {
  let dataSource: DataSource;
  let orderService: SalesOrderService;
  let invoiceService: SalesInvoiceService;
  let returnService: SalesReturnService;
  let service: CustomerReceiptService;
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

  /** Posted invoice: 10 @ 100 + 13% VAT = 1130, outstanding balance 1130. */
  async function postedInvoice(quantity = 10): Promise<string> {
    const orderId = await confirmedOrder();
    const orderLineId = await orderLineIdOf(orderId);
    const draft = await invoiceService.create(TEST_ORG_ID, salesman(), {
      salesOrderId: orderId,
      lines: [invoiceLine(orderLineId, quantity)],
    });
    await seedStockAtLocation(dataSource, GOODS_ITEM_ID, 100);
    await invoiceService.post(TEST_ORG_ID, salesman(), draft.id, {
      inventoryLocationId: TEST_LOCATION_ID,
    });
    return draft.id;
  }

  const allocation = (invoiceId: string, allocatedAmount: number) => ({
    salesInvoiceId: invoiceId,
    allocatedAmount,
  });

  const receiptDto = (
    allocations: unknown[],
    overrides: Record<string, unknown> = {},
  ) => ({
    partyId: CUSTOMER_PARTY_ID,
    paymentMethodId: PAYMENT_METHOD_ID,
    receiptAccountId: CASH_ACCOUNT_ID,
    allocations,
    ...overrides,
  });

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    await seedSalesReturnBaseline(dataSource);
    const module = await createSalesReturnTestingModule(dataSource);
    orderService = module.get(SalesOrderService);
    invoiceService = module.get(SalesInvoiceService);
    returnService = module.get(SalesReturnService);
    service = module.get(CustomerReceiptService);
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
    it('creates a draft receipt whose received amount is Σ allocations', async () => {
      const firstInvoice = await postedInvoice();
      const secondInvoice = await postedInvoice();

      const receipt = await service.create(
        TEST_ORG_ID,
        SALESMAN_USER_ID,
        receiptDto([
          allocation(firstInvoice, 700),
          allocation(secondInvoice, 430),
        ]),
      );

      expect(receipt.status).toBe('DRAFT');
      expect(receipt.receiptNumber).toBeNull();
      expect(receipt.partyId).toBe(CUSTOMER_PARTY_ID);
      expect(receipt.paymentMethodId).toBe(PAYMENT_METHOD_ID);
      expect(receipt.receiptAccountId).toBe(CASH_ACCOUNT_ID);
      expect(receipt.receivedAmount).toBe('1130.00');
      expect(receipt.allocations).toHaveLength(2);
    });

    it('rejects an empty allocation list and a zero allocation', async () => {
      await expect(
        service.create(TEST_ORG_ID, SALESMAN_USER_ID, receiptDto([])),
      ).rejects.toThrow();
      const invoiceId = await postedInvoice();
      await expect(
        service.create(
          TEST_ORG_ID,
          SALESMAN_USER_ID,
          receiptDto([allocation(invoiceId, 0)]),
        ),
      ).rejects.toThrow(CustomerReceiptAllocationZeroException);
    });

    it('rejects an allocation against a non-posted invoice', async () => {
      const orderId = await confirmedOrder();
      const orderLineId = await orderLineIdOf(orderId);
      const draft = await invoiceService.create(TEST_ORG_ID, salesman(), {
        salesOrderId: orderId,
        lines: [invoiceLine(orderLineId, 10)],
      });

      await expect(
        service.create(
          TEST_ORG_ID,
          SALESMAN_USER_ID,
          receiptDto([allocation(draft.id, 100)]),
        ),
      ).rejects.toThrow(CustomerReceiptInvoiceNotPostedException);
    });
  });

  describe('update', () => {
    it('replaces allocations and recomputes the received amount', async () => {
      const invoiceId = await postedInvoice();
      const created = await service.create(
        TEST_ORG_ID,
        SALESMAN_USER_ID,
        receiptDto([allocation(invoiceId, 1130)]),
      );

      const updated = await service.update(
        TEST_ORG_ID,
        SALESMAN_USER_ID,
        created.id,
        {
          allocations: [allocation(invoiceId, 500)],
          referenceNo: 'chq-1042',
          notes: 'revised',
        },
      );

      expect(updated.receivedAmount).toBe('500.00');
      expect(updated.referenceNo).toBe('chq-1042');
      expect(updated.notes).toBe('revised');
    });

    it('rejects updating a posted receipt', async () => {
      const invoiceId = await postedInvoice();
      const created = await service.create(
        TEST_ORG_ID,
        SALESMAN_USER_ID,
        receiptDto([allocation(invoiceId, 1130)]),
      );
      await service.post(TEST_ORG_ID, SALESMAN_USER_ID, created.id);

      await expect(
        service.update(TEST_ORG_ID, SALESMAN_USER_ID, created.id, {
          notes: 'nope',
        }),
      ).rejects.toThrow(CustomerReceiptNotDraftException);
    });
  });

  describe('post', () => {
    it('posts DR cash / CR AR and clears the invoice balance', async () => {
      const invoiceId = await postedInvoice();
      const created = await service.create(
        TEST_ORG_ID,
        SALESMAN_USER_ID,
        receiptDto([allocation(invoiceId, 1130)]),
      );

      const posted = await service.post(
        TEST_ORG_ID,
        SALESMAN_USER_ID,
        created.id,
      );

      expect(posted.status).toBe('POSTED');
      expect(posted.receiptNumber).toMatch(/^RCV-/);
      expect(posted.receiptDate).toBeTruthy();
      expect(posted.receiptDateBs).toBeTruthy();
      expect(posted.journalEntryId).toBeTruthy();

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
      expect(Number(byAccount.get(CASH_ACCOUNT_ID).debitAmount)).toBe(1130);
      expect(Number(byAccount.get(AR_ACCOUNT_ID).creditAmount)).toBe(1130);
      expect(byAccount.get(AR_ACCOUNT_ID).partyId).toBe(CUSTOMER_PARTY_ID);

      const invoice = await tx.manager
        .getRepository(SalesInvoiceEntity)
        .findOne({ where: { id: invoiceId } });
      expect(invoice.paidAmount).toBe('1130.00');
      expect(invoice.balanceAmount).toBe('0.00');
    });

    it('partially collects against an invoice', async () => {
      const invoiceId = await postedInvoice();
      const created = await service.create(
        TEST_ORG_ID,
        SALESMAN_USER_ID,
        receiptDto([allocation(invoiceId, 400)]),
      );

      await service.post(TEST_ORG_ID, SALESMAN_USER_ID, created.id);

      const invoice = await tx.manager
        .getRepository(SalesInvoiceEntity)
        .findOne({ where: { id: invoiceId } });
      expect(invoice.paidAmount).toBe('400.00');
      expect(invoice.balanceAmount).toBe('730.00');
    });

    it('collects only the remaining balance after a sales return', async () => {
      const invoiceId = await postedInvoice();
      const invoiceLine = await tx.manager
        .getRepository(SalesInvoiceLineEntity)
        .findOne({ where: { invoiceId } });
      const salesReturn = await returnService.create(
        TEST_ORG_ID,
        SALESMAN_USER_ID,
        {
          partyId: CUSTOMER_PARTY_ID,
          lines: [{ sourceSalesInvoiceLineId: invoiceLine.id, quantity: 4 }],
        },
      );
      await returnService.post(TEST_ORG_ID, SALESMAN_USER_ID, salesReturn.id, {
        inventoryLocationId: TEST_LOCATION_ID,
      });

      const receipt = await service.create(
        TEST_ORG_ID,
        SALESMAN_USER_ID,
        receiptDto([allocation(invoiceId, 678)]),
      );
      const posted = await service.post(
        TEST_ORG_ID,
        SALESMAN_USER_ID,
        receipt.id,
      );
      expect(posted.status).toBe('POSTED');

      const invoice = await tx.manager
        .getRepository(SalesInvoiceEntity)
        .findOne({ where: { id: invoiceId } });
      expect(invoice.balanceAmount).toBe('0.00');
    });

    it('rejects an allocation above the invoice balance at post', async () => {
      const invoiceId = await postedInvoice();
      const created = await service.create(
        TEST_ORG_ID,
        SALESMAN_USER_ID,
        receiptDto([allocation(invoiceId, 1200)]),
      );

      await expect(
        service.post(TEST_ORG_ID, SALESMAN_USER_ID, created.id),
      ).rejects.toThrow(CustomerReceiptAllocationExceedsBalanceException);
    });

    it('rejects an invoice owned by another customer', async () => {
      const invoiceId = await postedInvoice();
      const created = await service.create(
        TEST_ORG_ID,
        SALESMAN_USER_ID,
        receiptDto([allocation(invoiceId, 100)]),
      );
      await tx.manager
        .getRepository(CustomerReceiptEntity)
        .update({ id: created.id }, { partyId: SECOND_CUSTOMER_PARTY_ID });

      await expect(
        service.post(TEST_ORG_ID, SALESMAN_USER_ID, created.id),
      ).rejects.toThrow(CustomerReceiptInvoiceCustomerMismatchException);
    });

    it('rejects a non-asset receipt account', async () => {
      const invoiceId = await postedInvoice();
      const created = await service.create(
        TEST_ORG_ID,
        SALESMAN_USER_ID,
        receiptDto([allocation(invoiceId, 100)], {
          receiptAccountId: SALES_ACCOUNT_ID,
        }),
      );

      await expect(
        service.post(TEST_ORG_ID, SALESMAN_USER_ID, created.id),
      ).rejects.toThrow(CustomerReceiptAccountTypeException);
    });

    it('rejects posting a cancelled receipt', async () => {
      const invoiceId = await postedInvoice();
      const created = await service.create(
        TEST_ORG_ID,
        SALESMAN_USER_ID,
        receiptDto([allocation(invoiceId, 100)]),
      );
      await service.voidReceipt(TEST_ORG_ID, SALESMAN_USER_ID, created.id);

      await expect(
        service.post(TEST_ORG_ID, SALESMAN_USER_ID, created.id),
      ).rejects.toThrow(CustomerReceiptNotDraftException);
    });
  });

  describe('voidReceipt', () => {
    it('cancels a draft and rejects voiding a posted receipt', async () => {
      const invoiceId = await postedInvoice();
      const draft = await service.create(
        TEST_ORG_ID,
        SALESMAN_USER_ID,
        receiptDto([allocation(invoiceId, 100)]),
      );
      expect(
        (await service.voidReceipt(TEST_ORG_ID, SALESMAN_USER_ID, draft.id))
          .status,
      ).toBe('CANCELLED');

      const posted = await service.create(
        TEST_ORG_ID,
        SALESMAN_USER_ID,
        receiptDto([allocation(invoiceId, 100)]),
      );
      await service.post(TEST_ORG_ID, SALESMAN_USER_ID, posted.id);
      await expect(
        service.voidReceipt(TEST_ORG_ID, SALESMAN_USER_ID, posted.id),
      ).rejects.toThrow(CustomerReceiptNotDraftException);
    });
  });
});
