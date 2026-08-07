import { DataSource } from 'typeorm';
import { JournalEntryEntity } from '../accounting/entities/journal-entry.entity';
import { PartyEntity } from '../accounting/entities/party.entity';
import { InventoryBalanceEntity } from '../inventory/entities/inventory-balance.entity';
import { InventoryTransactionEntity } from '../inventory/entities/inventory-transaction.entity';
import { SalesInvoiceLineEntity } from './entities/sales-invoice-line.entity';
import { SalesOrderLineEntity } from './entities/sales-order-line.entity';
import { SalesOrderService } from './sales-order.service';
import { SalesInvoiceService } from './sales-invoice.service';
import {
  AR_ACCOUNT_ID,
  BASE_UOM_ID,
  beginTestTransaction,
  COGS_ACCOUNT_ID,
  CUSTOMER_PARTY_ID,
  createSalesInvoiceTestingModule,
  DISCOUNT_ACCOUNT_ID,
  endTestTransaction,
  FISCAL_YEAR_ID,
  GOODS_ITEM_ID,
  INVENTORY_ACCOUNT_ID,
  MANAGER_USER_ID,
  SALES_ACCOUNT_ID,
  SALESMAN_USER_ID,
  seedSalesInvoiceBaseline,
  seedSalesOrderParties,
  seedStockAtLocation,
  TEAMMATE_USER_ID,
  TEST_LOCATION_ID,
  TEST_ORG_ID,
  VAT_PAYABLE_ACCOUNT_ID,
  VAT_TAX_CODE_ID,
  type TestTransaction,
} from '../testing/sales-invoice-test.harness';
import { createTestDataSource } from '../testing/test-db';
import {
  SalesInvoiceAccessDeniedException,
  SalesInvoiceDuplicateOrderLineException,
  SalesInvoiceLineOrderMismatchException,
  SalesInvoiceLocationRequiredException,
  SalesInvoiceNotDraftException,
  SalesInvoiceOrderNotConfirmableException,
  SalesInvoiceQuantityExceededException,
  SalesInvoiceZeroQuantityException,
} from './sales.errors';

describe('SalesInvoiceService', () => {
  let dataSource: DataSource;
  let orderService: SalesOrderService;
  let service: SalesInvoiceService;
  let tx: TestTransaction;

  const salesman = () => ({ id: SALESMAN_USER_ID, roleCode: null });
  const teammate = () => ({ id: TEAMMATE_USER_ID, roleCode: null });
  const manager = () => ({ id: MANAGER_USER_ID, roleCode: 'manager' });

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

  async function confirmedOrder(
    overrides: Record<string, unknown> = {},
  ): Promise<string> {
    const created = await orderService.create(
      TEST_ORG_ID,
      salesman(),
      orderDto(overrides),
    );
    await orderService.confirm(TEST_ORG_ID, salesman(), created.id);
    return created.id;
  }

  async function orderLineIdOf(orderId: string): Promise<string> {
    const order = await orderService.get(TEST_ORG_ID, salesman(), orderId);
    return order.lines[0].id;
  }

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    await seedSalesInvoiceBaseline(dataSource);
    const module = await createSalesInvoiceTestingModule(dataSource);
    orderService = module.get(SalesOrderService);
    service = module.get(SalesInvoiceService);
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
    it('creates a draft invoice from an order with full tax snapshot', async () => {
      const orderId = await confirmedOrder();
      const orderLineId = await orderLineIdOf(orderId);

      const invoice = await service.create(TEST_ORG_ID, salesman(), {
        salesOrderId: orderId,
        lines: [invoiceLine(orderLineId, 10)],
      });

      expect(invoice.status).toBe('DRAFT');
      expect(invoice.invoiceNumber).toBeNull();
      expect(invoice.orderId).toBe(orderId);
      expect(invoice.partyId).toBe(CUSTOMER_PARTY_ID);
      expect(invoice.salespersonId).toBe(SALESMAN_USER_ID);
      expect(invoice.subtotal).toBe('1000.00');
      expect(invoice.discountTotal).toBe('0.00');
      expect(invoice.taxableTotal).toBe('1000.00');
      expect(invoice.nonTaxableTotal).toBe('0.00');
      expect(invoice.taxTotal).toBe('130.00');
      expect(invoice.total).toBe('1130.00');
      expect(invoice.cbmsStatus).toBe('NOT_REQUIRED');

      expect(invoice.lines).toHaveLength(1);
      const line = invoice.lines[0];
      expect(line.quantity).toBe('10.000');
      expect(line.freeQuantity).toBe('0.000');
      expect(line.baseQuantity).toBe('10.000');
      expect(line.unitPrice).toBe('100.00');
      expect(line.grossAmount).toBe('1000.00');
      expect(line.discountAmount).toBe('0.00');
      expect(line.taxCodeId).toBe(VAT_TAX_CODE_ID);
      expect(line.irdCategory).toBe('TAXABLE');
      expect(line.taxRate).toBe('13.0000');
      expect(line.taxableAmount).toBe('1000.00');
      expect(line.taxAmount).toBe('130.00');
      expect(line.lineTotal).toBe('1130.00');
    });

    it('snapshots the buyer name and PAN at create time', async () => {
      await tx.manager
        .getRepository(PartyEntity)
        .update(CUSTOMER_PARTY_ID, { panNumber: '123456789' });
      const orderId = await confirmedOrder();
      const orderLineId = await orderLineIdOf(orderId);

      const invoice = await service.create(TEST_ORG_ID, salesman(), {
        salesOrderId: orderId,
        lines: [invoiceLine(orderLineId, 10)],
      });
      expect(invoice.buyerName).toBe('Corner Store');
      expect(invoice.buyerPan).toBe('123456789');
    });

    it('apportions the order header discount pro-rata across invoices', async () => {
      const orderId = await confirmedOrder({ discountAmount: 100 });
      const orderLineId = await orderLineIdOf(orderId);

      const full = await service.create(TEST_ORG_ID, salesman(), {
        salesOrderId: orderId,
        lines: [invoiceLine(orderLineId, 10)],
      });
      expect(full.discountTotal).toBe('100.00');
      expect(full.subtotal).toBe('900.00');
      expect(full.taxTotal).toBe('117.00');
      expect(full.total).toBe('1017.00');
    });

    it('defaults the full free quantity only when billing the entire remaining', async () => {
      const orderId = await confirmedOrder({
        lines: [orderLine({ quantity: 10, freeQuantity: 5 })],
      });
      const orderLineId = await orderLineIdOf(orderId);

      const invoice = await service.create(TEST_ORG_ID, salesman(), {
        salesOrderId: orderId,
        lines: [invoiceLine(orderLineId, 10)],
      });
      const line = invoice.lines[0];
      expect(line.quantity).toBe('10.000');
      expect(line.freeQuantity).toBe('5.000');
      expect(line.baseQuantity).toBe('15.000');
      expect(line.lineTotal).toBe('1130.00');
      expect(invoice.total).toBe('1130.00');
    });

    it('rejects invoicing an order that is not confirmed or completed', async () => {
      const created = await orderService.create(
        TEST_ORG_ID,
        salesman(),
        orderDto(),
      );
      const orderLineId = await orderLineIdOf(created.id);
      await expect(
        service.create(TEST_ORG_ID, salesman(), {
          salesOrderId: created.id,
          lines: [invoiceLine(orderLineId, 1)],
        }),
      ).rejects.toThrow(SalesInvoiceOrderNotConfirmableException);
    });

    it('rejects duplicate, foreign, zero, and over-billed lines', async () => {
      const orderId = await confirmedOrder();
      const orderLineId = await orderLineIdOf(orderId);

      await expect(
        service.create(TEST_ORG_ID, salesman(), {
          salesOrderId: orderId,
          lines: [invoiceLine(orderLineId, 5), invoiceLine(orderLineId, 5)],
        }),
      ).rejects.toThrow(SalesInvoiceDuplicateOrderLineException);

      await expect(
        service.create(TEST_ORG_ID, salesman(), {
          salesOrderId: orderId,
          lines: [
            {
              orderLineId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              quantity: 1,
            },
          ],
        }),
      ).rejects.toThrow(SalesInvoiceLineOrderMismatchException);

      await expect(
        service.create(TEST_ORG_ID, salesman(), {
          salesOrderId: orderId,
          lines: [invoiceLine(orderLineId, 0)],
        }),
      ).rejects.toThrow(SalesInvoiceZeroQuantityException);

      await expect(
        service.create(TEST_ORG_ID, salesman(), {
          salesOrderId: orderId,
          lines: [invoiceLine(orderLineId, 11)],
        }),
      ).rejects.toThrow(SalesInvoiceQuantityExceededException);
    });

    it('blocks a non-manager from invoicing another salesperson order', async () => {
      const orderId = await confirmedOrder();
      const orderLineId = await orderLineIdOf(orderId);
      await expect(
        service.create(TEST_ORG_ID, teammate(), {
          salesOrderId: orderId,
          lines: [invoiceLine(orderLineId, 1)],
        }),
      ).rejects.toThrow(SalesInvoiceAccessDeniedException);

      await expect(
        service.create(TEST_ORG_ID, manager(), {
          salesOrderId: orderId,
          lines: [invoiceLine(orderLineId, 1)],
        }),
      ).resolves.toBeDefined();
    });
  });

  describe('update', () => {
    it('replaces draft lines and recomputes totals', async () => {
      const orderId = await confirmedOrder();
      const orderLineId = await orderLineIdOf(orderId);
      const invoice = await service.create(TEST_ORG_ID, salesman(), {
        salesOrderId: orderId,
        lines: [invoiceLine(orderLineId, 10)],
      });

      const updated = await service.update(
        TEST_ORG_ID,
        salesman(),
        invoice.id,
        {
          lines: [invoiceLine(orderLineId, 5)],
          notes: 'partial delivery first',
        },
      );
      expect(updated.lines).toHaveLength(1);
      expect(updated.lines[0].quantity).toBe('5.000');
      expect(updated.subtotal).toBe('500.00');
      expect(updated.taxTotal).toBe('65.00');
      expect(updated.total).toBe('565.00');
      expect(updated.notes).toBe('partial delivery first');
    });

    it('rejects updating a posted invoice', async () => {
      const orderId = await confirmedOrder();
      const orderLineId = await orderLineIdOf(orderId);
      const invoice = await service.create(TEST_ORG_ID, salesman(), {
        salesOrderId: orderId,
        lines: [invoiceLine(orderLineId, 10)],
      });
      await seedStockAtLocation(dataSource, GOODS_ITEM_ID, 100);
      await service.post(TEST_ORG_ID, salesman(), invoice.id, {
        inventoryLocationId: TEST_LOCATION_ID,
      });
      await expect(
        service.update(TEST_ORG_ID, salesman(), invoice.id, {
          lines: [invoiceLine(orderLineId, 5)],
        }),
      ).rejects.toThrow(SalesInvoiceNotDraftException);
    });
  });

  describe('post', () => {
    it('posts the invoice, journal, stock, and invoiced quantities', async () => {
      const orderId = await confirmedOrder();
      const orderLineId = await orderLineIdOf(orderId);
      const invoice = await service.create(TEST_ORG_ID, salesman(), {
        salesOrderId: orderId,
        lines: [invoiceLine(orderLineId, 10)],
      });
      await seedStockAtLocation(dataSource, GOODS_ITEM_ID, 100);

      const posted = await service.post(TEST_ORG_ID, salesman(), invoice.id, {
        inventoryLocationId: TEST_LOCATION_ID,
      });

      expect(posted.status).toBe('POSTED');
      expect(posted.invoiceNumber).toMatch(/^INV-/);
      expect(posted.invoiceDate).toBeTruthy();
      expect(posted.invoiceDateBs).toBeTruthy();
      expect(posted.dueDate).toBeTruthy();
      expect(posted.fiscalYearId).toBe(FISCAL_YEAR_ID);
      expect(posted.journalEntryId).toBeTruthy();
      expect(posted.inventoryTransactionId).toBeTruthy();
      expect(posted.cbmsStatus).toBe('NOT_REQUIRED');

      const orderLineRow = await tx.manager
        .getRepository(SalesOrderLineEntity)
        .findOne({ where: { id: orderLineId } });
      expect(orderLineRow.invoicedQuantity).toBe('10.000');

      const journal = await tx.manager
        .getRepository(JournalEntryEntity)
        .findOne({
          where: { id: posted.journalEntryId },
          relations: { lines: { account: true } },
        });
      expect(journal.status).toBe('POSTED');
      expect(journal.referenceNumber).toMatch(/^JE-/);
      const byAccount = new Map(
        journal.lines.map((line) => [line.account.id, line]),
      );
      expect(Number(byAccount.get(AR_ACCOUNT_ID).debitAmount)).toBe(1130);
      expect(byAccount.get(AR_ACCOUNT_ID).partyId).toBe(CUSTOMER_PARTY_ID);
      expect(Number(byAccount.get(SALES_ACCOUNT_ID).creditAmount)).toBe(1000);
      expect(Number(byAccount.get(VAT_PAYABLE_ACCOUNT_ID).creditAmount)).toBe(
        130,
      );
      expect(byAccount.has(DISCOUNT_ACCOUNT_ID)).toBe(false);

      const txn = await tx.manager
        .getRepository(InventoryTransactionEntity)
        .findOne({
          where: { id: posted.inventoryTransactionId },
          relations: { lines: true },
        });
      expect(txn.transactionType).toBe('sales_invoice');
      expect(txn.referenceType).toBe('sales_invoice');
      expect(txn.referenceId).toBe(invoice.id);
      expect(txn.lines[0].direction).toBe('OUT');
      expect(txn.lines[0].quantity).toBe('10.000');

      const balance = await tx.manager
        .getRepository(InventoryBalanceEntity)
        .findOne({
          where: {
            organizationId: TEST_ORG_ID,
            locationId: TEST_LOCATION_ID,
            itemId: GOODS_ITEM_ID,
          },
        });
      expect(balance.quantity).toBe('90.000');
    });

    it('bills partial deliveries and lets later invoices take the rest', async () => {
      const orderId = await confirmedOrder();
      const orderLineId = await orderLineIdOf(orderId);
      await seedStockAtLocation(dataSource, GOODS_ITEM_ID, 100);

      const first = await service.create(TEST_ORG_ID, salesman(), {
        salesOrderId: orderId,
        lines: [invoiceLine(orderLineId, 6)],
      });
      await service.post(TEST_ORG_ID, salesman(), first.id, {
        inventoryLocationId: TEST_LOCATION_ID,
      });

      const orderLineRow = await tx.manager
        .getRepository(SalesOrderLineEntity)
        .findOne({ where: { id: orderLineId } });
      expect(orderLineRow.invoicedQuantity).toBe('6.000');

      const second = await service.create(TEST_ORG_ID, salesman(), {
        salesOrderId: orderId,
        lines: [invoiceLine(orderLineId, 4)],
      });
      const posted = await service.post(TEST_ORG_ID, salesman(), second.id, {
        inventoryLocationId: TEST_LOCATION_ID,
      });
      expect(posted.status).toBe('POSTED');
      expect(posted.subtotal).toBe('400.00');

      const balance = await tx.manager
        .getRepository(InventoryBalanceEntity)
        .findOne({
          where: {
            organizationId: TEST_ORG_ID,
            locationId: TEST_LOCATION_ID,
            itemId: GOODS_ITEM_ID,
          },
        });
      expect(balance.quantity).toBe('90.000');
    });

    it('requires an inventory location', async () => {
      const orderId = await confirmedOrder();
      const orderLineId = await orderLineIdOf(orderId);
      const invoice = await service.create(TEST_ORG_ID, salesman(), {
        salesOrderId: orderId,
        lines: [invoiceLine(orderLineId, 1)],
      });
      await expect(
        service.post(TEST_ORG_ID, salesman(), invoice.id, {} as never),
      ).rejects.toThrow(SalesInvoiceLocationRequiredException);
    });

    it('rejects a draft whose quantity is no longer available', async () => {
      const orderId = await confirmedOrder();
      const orderLineId = await orderLineIdOf(orderId);
      const first = await service.create(TEST_ORG_ID, salesman(), {
        salesOrderId: orderId,
        lines: [invoiceLine(orderLineId, 10)],
      });
      const second = await service.create(TEST_ORG_ID, salesman(), {
        salesOrderId: orderId,
        lines: [invoiceLine(orderLineId, 10)],
      });
      await seedStockAtLocation(dataSource, GOODS_ITEM_ID, 100);

      await service.post(TEST_ORG_ID, salesman(), first.id, {
        inventoryLocationId: TEST_LOCATION_ID,
      });
      await expect(
        service.post(TEST_ORG_ID, salesman(), second.id, {
          inventoryLocationId: TEST_LOCATION_ID,
        }),
      ).rejects.toThrow(SalesInvoiceQuantityExceededException);
    });
  });

  describe('voidInvoice', () => {
    it('cancels a draft only', async () => {
      const orderId = await confirmedOrder();
      const orderLineId = await orderLineIdOf(orderId);
      const invoice = await service.create(TEST_ORG_ID, salesman(), {
        salesOrderId: orderId,
        lines: [invoiceLine(orderLineId, 1)],
      });
      const cancelled = await service.voidInvoice(
        TEST_ORG_ID,
        salesman(),
        invoice.id,
      );
      expect(cancelled.status).toBe('CANCELLED');
      await expect(
        service.voidInvoice(TEST_ORG_ID, salesman(), invoice.id),
      ).rejects.toThrow(SalesInvoiceNotDraftException);
    });

    it('rejects voiding a posted invoice', async () => {
      const orderId = await confirmedOrder();
      const orderLineId = await orderLineIdOf(orderId);
      const invoice = await service.create(TEST_ORG_ID, salesman(), {
        salesOrderId: orderId,
        lines: [invoiceLine(orderLineId, 1)],
      });
      await seedStockAtLocation(dataSource, GOODS_ITEM_ID, 100);
      await service.post(TEST_ORG_ID, salesman(), invoice.id, {
        inventoryLocationId: TEST_LOCATION_ID,
      });
      await expect(
        service.voidInvoice(TEST_ORG_ID, salesman(), invoice.id),
      ).rejects.toThrow(SalesInvoiceNotDraftException);
    });
  });

  describe('reads', () => {
    it('blocks a non-manager from reading another invoice', async () => {
      const orderId = await confirmedOrder();
      const orderLineId = await orderLineIdOf(orderId);
      const invoice = await service.create(TEST_ORG_ID, salesman(), {
        salesOrderId: orderId,
        lines: [invoiceLine(orderLineId, 1)],
      });
      await expect(
        service.get(TEST_ORG_ID, teammate(), invoice.id),
      ).rejects.toThrow(SalesInvoiceAccessDeniedException);
    });

    it('lists mine / team / all', async () => {
      const orderId = await confirmedOrder();
      const orderLineId = await orderLineIdOf(orderId);
      const invoice = await service.create(TEST_ORG_ID, salesman(), {
        salesOrderId: orderId,
        lines: [invoiceLine(orderLineId, 1)],
      });

      const [mine] = await service.list(TEST_ORG_ID, salesman(), 'mine', {
        page: 1,
        limit: 20,
      });
      expect(mine.map((i) => i.id)).toEqual([invoice.id]);

      const [team] = await service.list(TEST_ORG_ID, manager(), 'team', {
        page: 1,
        limit: 20,
      });
      expect(team.map((i) => i.id)).toEqual([invoice.id]);

      const [all] = await service.list(TEST_ORG_ID, manager(), 'all', {
        page: 1,
        limit: 20,
      });
      expect(all).toHaveLength(1);
    });
  });

  describe('COGS (moving-average, decision 42)', () => {
    it('posts COGS at the balance avg_cost and snapshots it on the line', async () => {
      const orderId = await confirmedOrder();
      const orderLineId = await orderLineIdOf(orderId);
      const invoice = await service.create(TEST_ORG_ID, salesman(), {
        salesOrderId: orderId,
        lines: [invoiceLine(orderLineId, 10)],
      });
      await seedStockAtLocation(
        dataSource,
        GOODS_ITEM_ID,
        100,
        TEST_LOCATION_ID,
        75,
      );

      const posted = await service.post(TEST_ORG_ID, salesman(), invoice.id, {
        inventoryLocationId: TEST_LOCATION_ID,
      });

      const journal = await tx.manager
        .getRepository(JournalEntryEntity)
        .findOne({
          where: { id: posted.journalEntryId },
          relations: { lines: { account: true } },
        });
      const byAccount = new Map(
        journal.lines.map((line) => [line.account.id, line]),
      );
      expect(Number(byAccount.get(COGS_ACCOUNT_ID).debitAmount)).toBe(750);
      expect(Number(byAccount.get(INVENTORY_ACCOUNT_ID).creditAmount)).toBe(
        750,
      );

      const txn = await tx.manager
        .getRepository(InventoryTransactionEntity)
        .findOne({
          where: { id: posted.inventoryTransactionId },
          relations: { lines: true },
        });
      expect(txn.lines[0].unitCost).toBe('75.00');

      const line = await tx.manager
        .getRepository(SalesInvoiceLineEntity)
        .findOne({ where: { invoiceId: posted.id } });
      expect(line.cogsUnitCost).toBe('75.00');
    });

    it('counts free goods into COGS via base_quantity', async () => {
      const orderId = await confirmedOrder({
        lines: [orderLine({ quantity: 10, freeQuantity: 2 })],
      });
      const orderLineId = await orderLineIdOf(orderId);
      const invoice = await service.create(TEST_ORG_ID, salesman(), {
        salesOrderId: orderId,
        lines: [invoiceLine(orderLineId, 10)],
      });
      await seedStockAtLocation(
        dataSource,
        GOODS_ITEM_ID,
        100,
        TEST_LOCATION_ID,
        75,
      );

      const posted = await service.post(TEST_ORG_ID, salesman(), invoice.id, {
        inventoryLocationId: TEST_LOCATION_ID,
      });

      const journal = await tx.manager
        .getRepository(JournalEntryEntity)
        .findOne({
          where: { id: posted.journalEntryId },
          relations: { lines: { account: true } },
        });
      const byAccount = new Map(
        journal.lines.map((line) => [line.account.id, line]),
      );
      expect(Number(byAccount.get(COGS_ACCOUNT_ID).debitAmount)).toBe(900);
    });

    it('skips the COGS lines when stock is unvalued (avg_cost 0)', async () => {
      const orderId = await confirmedOrder();
      const orderLineId = await orderLineIdOf(orderId);
      const invoice = await service.create(TEST_ORG_ID, salesman(), {
        salesOrderId: orderId,
        lines: [invoiceLine(orderLineId, 10)],
      });
      await seedStockAtLocation(dataSource, GOODS_ITEM_ID, 100);

      const posted = await service.post(TEST_ORG_ID, salesman(), invoice.id, {
        inventoryLocationId: TEST_LOCATION_ID,
      });

      const journal = await tx.manager
        .getRepository(JournalEntryEntity)
        .findOne({
          where: { id: posted.journalEntryId },
          relations: { lines: { account: true } },
        });
      const byAccount = new Map(
        journal.lines.map((line) => [line.account.id, line]),
      );
      expect(byAccount.has(COGS_ACCOUNT_ID)).toBe(false);
      expect(byAccount.has(INVENTORY_ACCOUNT_ID)).toBe(false);
    });
  });
});
