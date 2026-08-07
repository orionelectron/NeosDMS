import { DataSource } from 'typeorm';
import { FiscalYearEntity } from '../accounting/entities/fiscal-year.entity';
import { JournalEntryEntity } from '../accounting/entities/journal-entry.entity';
import { PartyEntity } from '../accounting/entities/party.entity';
import { InventoryBalanceEntity } from '../inventory/entities/inventory-balance.entity';
import { InventoryTransactionEntity } from '../inventory/entities/inventory-transaction.entity';
import { PurchaseReceiptLineEntity } from './entities/purchase-receipt-line.entity';
import { OrganizationUsageEntity } from '../subscription/entities/organization-usage.entity';
import { PlanEntity } from '../subscription/entities/plan.entity';
import { PlanLimitExceededException } from '../subscription/subscription.errors';
import { PurchaseBillService } from './purchase-bill.service';
import { PurchaseReceiptService } from './purchase-receipt.service';
import {
  AP_ACCOUNT_ID,
  BASE_UOM_ID,
  beginTestTransaction,
  BOX_UOM_ID,
  CASE_UOM_ID,
  createPurchaseBillTestingModule,
  CUSTOMER_PARTY_ID,
  DISCOUNT_RECEIVED_ACCOUNT_ID,
  endTestTransaction,
  FISCAL_YEAR_ID,
  GOODS_ITEM_ID,
  INVENTORY_ACCOUNT_ID,
  MANAGER_USER_ID,
  SALESMAN_USER_ID,
  SECOND_LOCATION_ID,
  SECOND_SUPPLIER_PARTY_ID,
  seedPurchaseBillBaseline,
  seedSalesOrderParties,
  seedSecondSupplier,
  seedStockAtLocation,
  SERVICE_ITEM_ID,
  SUPPLIER_PARTY_ID,
  TDS_PAYABLE_ACCOUNT_ID,
  TDS_TAX_CODE_ID,
  TEAMMATE_USER_ID,
  TEST_LOCATION_ID,
  TEST_ORG_ID,
  TEST_PLAN_ID,
  type TestTransaction,
  VAT_RECEIVABLE_ACCOUNT_ID,
  VAT_TAX_CODE_ID,
} from '../testing/purchase-bill-test.harness';
import { createTestDataSource } from '../testing/test-db';
import {
  PurchaseBillDirectLineIncompleteException,
  PurchaseBillFiscalYearMissingException,
  PurchaseBillItemNotFoundException,
  PurchaseBillItemNotTrackedException,
  PurchaseBillLocationNotFoundException,
  PurchaseBillNotDraftException,
  PurchaseBillNotFoundException,
  PurchaseBillReceiptLineAlreadyBilledException,
  PurchaseBillReceiptLinePartialException,
  PurchaseBillReceiptLocationMismatchException,
  PurchaseBillReceiptNotPostedException,
  PurchaseBillReceiptSupplierMismatchException,
  PurchaseBillSupplierNotFoundException,
  PurchaseBillTdsCodeInvalidException,
  PurchaseBillTdsWithholdingException,
  PurchaseBillUomConversionNotFoundException,
} from './purchase.errors';

describe('PurchaseBillService', () => {
  let dataSource: DataSource;
  let service: PurchaseBillService;
  let receiptService: PurchaseReceiptService;
  let tx: TestTransaction;

  const actor = () => ({ id: SALESMAN_USER_ID, roleCode: null });
  const manager = () => ({ id: MANAGER_USER_ID, roleCode: 'manager' });

  const directLine = (overrides: Record<string, unknown> = {}) => ({
    itemId: GOODS_ITEM_ID,
    uomId: BASE_UOM_ID,
    quantity: 10,
    ...overrides,
  });

  const createDto = (overrides: Record<string, unknown> = {}) => ({
    partyId: SUPPLIER_PARTY_ID,
    lines: [directLine()],
    ...overrides,
  });

  const postBill = async (id: string, locationId = TEST_LOCATION_ID) =>
    service.post(TEST_ORG_ID, manager().id, id, {
      inventoryLocationId: locationId,
    });

  async function postedGrn(locationId = TEST_LOCATION_ID) {
    const receipt = await receiptService.create(TEST_ORG_ID, manager().id, {
      partyId: SUPPLIER_PARTY_ID,
      inventoryLocationId: locationId,
      lines: [
        {
          itemId: GOODS_ITEM_ID,
          uomId: BASE_UOM_ID,
          quantity: 10,
          unitCost: 60,
        },
      ],
    });
    return receiptService.post(TEST_ORG_ID, manager().id, receipt.id);
  }

  async function journalFor(billId: string) {
    const bill = await service.get(TEST_ORG_ID, billId);
    return dataSource.manager.getRepository(JournalEntryEntity).findOneOrFail({
      where: { id: bill.journalEntryId! },
      relations: { lines: true },
    });
  }

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    await seedPurchaseBillBaseline(dataSource);
    const module = await createPurchaseBillTestingModule(dataSource);
    service = module.get(PurchaseBillService);
    receiptService = module.get(PurchaseReceiptService);
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
    it('creates a DRAFT bill with computed totals and no number', async () => {
      const bill = await service.create(TEST_ORG_ID, actor().id, createDto());

      expect(bill.status).toBe('DRAFT');
      expect(bill.billNumber).toBeNull();
      expect(bill.partyId).toBe(SUPPLIER_PARTY_ID);
      expect(bill.inventoryLocationId).toBeNull();
      expect(bill.subtotal).toBe('600.00');
      expect(bill.discountTotal).toBe('0.00');
      expect(bill.taxableTotal).toBe('600.00');
      expect(bill.nonTaxableTotal).toBe('0.00');
      expect(bill.taxTotal).toBe('78.00');
      expect(bill.tdsTotal).toBe('0.00');
      expect(bill.total).toBe('678.00');
      expect(bill.lines).toHaveLength(1);
      expect(bill.lines[0].sourcePurchaseReceiptLineId).toBeNull();
      expect(bill.lines[0].itemId).toBe(GOODS_ITEM_ID);
      expect(bill.lines[0].quantity).toBe('10.000');
      expect(bill.lines[0].baseQuantity).toBe('10.000');
      expect(bill.lines[0].unitPrice).toBe('60.00');
      expect(bill.lines[0].grossAmount).toBe('600.00');
      expect(bill.lines[0].taxRate).toBe('13.0000');
      expect(bill.lines[0].taxableAmount).toBe('600.00');
      expect(bill.lines[0].taxAmount).toBe('78.00');
      expect(bill.lines[0].lineTotal).toBe('678.00');
    });

    it('defaults the unit price to the item standard cost and converts uoms', async () => {
      const bill = await service.create(
        TEST_ORG_ID,
        actor().id,
        createDto({
          lines: [
            directLine({ uomId: BOX_UOM_ID, quantity: 2, unitPrice: 50 }),
          ],
        }),
      );

      expect(bill.lines[0].quantity).toBe('2.000');
      expect(bill.lines[0].baseQuantity).toBe('24.000');
      expect(bill.lines[0].unitPrice).toBe('50.00');
      expect(bill.lines[0].grossAmount).toBe('100.00');
      expect(bill.total).toBe('113.00');
    });

    it('rejects a party that is not an active supplier', async () => {
      await expect(
        service.create(
          TEST_ORG_ID,
          actor().id,
          createDto({ partyId: CUSTOMER_PARTY_ID }),
        ),
      ).rejects.toThrow(PurchaseBillSupplierNotFoundException);
    });

    it('rejects a service (non-tracked) item', async () => {
      await expect(
        service.create(
          TEST_ORG_ID,
          actor().id,
          createDto({ lines: [directLine({ itemId: SERVICE_ITEM_ID })] }),
        ),
      ).rejects.toThrow(PurchaseBillItemNotTrackedException);
    });

    it('rejects an unknown item', async () => {
      await expect(
        service.create(
          TEST_ORG_ID,
          actor().id,
          createDto({
            lines: [
              directLine({ itemId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' }),
            ],
          }),
        ),
      ).rejects.toThrow(PurchaseBillItemNotFoundException);
    });

    it('rejects a uom with no conversion to the item base uom', async () => {
      await expect(
        service.create(
          TEST_ORG_ID,
          actor().id,
          createDto({ lines: [directLine({ uomId: CASE_UOM_ID })] }),
        ),
      ).rejects.toThrow(PurchaseBillUomConversionNotFoundException);
    });

    it('rejects an incomplete direct line', async () => {
      await expect(
        service.create(TEST_ORG_ID, actor().id, {
          partyId: SUPPLIER_PARTY_ID,
          lines: [{ itemId: GOODS_ITEM_ID, uomId: BASE_UOM_ID }],
        }),
      ).rejects.toThrow(PurchaseBillDirectLineIncompleteException);
    });

    it('applies a header discount pro-rata to the taxable base', async () => {
      const bill = await service.create(
        TEST_ORG_ID,
        actor().id,
        createDto({ discountAmount: 60 }),
      );

      expect(bill.discountTotal).toBe('60.00');
      expect(bill.subtotal).toBe('540.00');
      expect(bill.taxableTotal).toBe('540.00');
      expect(bill.taxTotal).toBe('70.20');
      expect(bill.total).toBe('610.20');
    });

    it('rejects a VAT code that is a TDS withholding code', async () => {
      await expect(
        service.create(
          TEST_ORG_ID,
          actor().id,
          createDto({ lines: [directLine({ taxCodeId: TDS_TAX_CODE_ID })] }),
        ),
      ).rejects.toThrow(PurchaseBillTdsWithholdingException);
    });

    it('rejects a tdsTaxCodeId that is not a TDS withholding code', async () => {
      await expect(
        service.create(
          TEST_ORG_ID,
          actor().id,
          createDto({ lines: [directLine({ tdsTaxCodeId: VAT_TAX_CODE_ID })] }),
        ),
      ).rejects.toThrow(PurchaseBillTdsCodeInvalidException);
    });

    it('rejects a source line from a non-posted GRN', async () => {
      const receipt = await receiptService.create(TEST_ORG_ID, manager().id, {
        partyId: SUPPLIER_PARTY_ID,
        inventoryLocationId: TEST_LOCATION_ID,
        lines: [
          {
            itemId: GOODS_ITEM_ID,
            uomId: BASE_UOM_ID,
            quantity: 10,
            unitCost: 60,
          },
        ],
      });

      await expect(
        service.create(TEST_ORG_ID, actor().id, {
          partyId: SUPPLIER_PARTY_ID,
          lines: [{ sourcePurchaseReceiptLineId: receipt.lines[0].id }],
        }),
      ).rejects.toThrow(PurchaseBillReceiptNotPostedException);
    });

    it('creates a bill against a posted GRN with receipt-line defaults', async () => {
      const grn = await postedGrn();

      const bill = await service.create(TEST_ORG_ID, actor().id, {
        partyId: SUPPLIER_PARTY_ID,
        lines: [{ sourcePurchaseReceiptLineId: grn.lines[0].id }],
      });

      expect(bill.lines).toHaveLength(1);
      expect(bill.lines[0].sourcePurchaseReceiptLineId).toBe(grn.lines[0].id);
      expect(bill.lines[0].itemId).toBe(GOODS_ITEM_ID);
      expect(bill.lines[0].quantity).toBe('10.000');
      expect(bill.lines[0].baseQuantity).toBe('10.000');
      expect(bill.lines[0].unitPrice).toBe('60.00');
      expect(bill.lines[0].grossAmount).toBe('600.00');
      expect(bill.lines[0].taxAmount).toBe('78.00');
      expect(bill.total).toBe('678.00');
    });

    it('rejects a source line from a different supplier', async () => {
      await seedSecondSupplier(dataSource);
      const grn = await postedGrn();

      await expect(
        service.create(TEST_ORG_ID, actor().id, {
          partyId: SECOND_SUPPLIER_PARTY_ID,
          lines: [{ sourcePurchaseReceiptLineId: grn.lines[0].id }],
        }),
      ).rejects.toThrow(PurchaseBillReceiptSupplierMismatchException);
    });

    it('rejects partial billing of a source line', async () => {
      const grn = await postedGrn();

      await expect(
        service.create(TEST_ORG_ID, actor().id, {
          partyId: SUPPLIER_PARTY_ID,
          lines: [
            { sourcePurchaseReceiptLineId: grn.lines[0].id, quantity: 5 },
          ],
        }),
      ).rejects.toThrow(PurchaseBillReceiptLinePartialException);
    });

    it('rejects a source line that was already billed', async () => {
      const grn = await postedGrn();
      const bill = await service.create(TEST_ORG_ID, actor().id, {
        partyId: SUPPLIER_PARTY_ID,
        lines: [{ sourcePurchaseReceiptLineId: grn.lines[0].id }],
      });
      await postBill(bill.id);

      await expect(
        service.create(TEST_ORG_ID, actor().id, {
          partyId: SUPPLIER_PARTY_ID,
          lines: [{ sourcePurchaseReceiptLineId: grn.lines[0].id }],
        }),
      ).rejects.toThrow(PurchaseBillReceiptLineAlreadyBilledException);
    });
  });

  describe('update', () => {
    it('updates a draft and replaces its lines', async () => {
      const bill = await service.create(TEST_ORG_ID, actor().id, createDto());

      const updated = await service.update(TEST_ORG_ID, actor().id, bill.id, {
        notes: 'Revised quantity',
        lines: [directLine({ quantity: 5 })],
      });

      expect(updated.notes).toBe('Revised quantity');
      expect(updated.lines).toHaveLength(1);
      expect(updated.lines[0].quantity).toBe('5.000');
      expect(updated.taxableTotal).toBe('300.00');
      expect(updated.total).toBe('339.00');
    });

    it('rejects updating a posted bill', async () => {
      const bill = await service.create(TEST_ORG_ID, actor().id, createDto());
      await postBill(bill.id);

      await expect(
        service.update(TEST_ORG_ID, actor().id, bill.id, { notes: 'too late' }),
      ).rejects.toThrow(PurchaseBillNotDraftException);
    });
  });

  describe('post (direct)', () => {
    it('posts a draft: reserves BILL- number, journal, stock and metadata', async () => {
      const bill = await service.create(TEST_ORG_ID, actor().id, createDto());

      const posted = await postBill(bill.id);

      expect(posted.status).toBe('POSTED');
      expect(posted.billNumber).toMatch(/^BILL-\d{6}$/);
      expect(posted.billDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(posted.billDateBs).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(posted.fiscalYearId).toBe(FISCAL_YEAR_ID);
      expect(posted.inventoryLocationId).toBe(TEST_LOCATION_ID);
      expect(posted.journalEntryId).not.toBeNull();
      expect(posted.inventoryTransactionId).not.toBeNull();
    });

    it('posts a balanced Inventory/VAT/AP journal', async () => {
      const bill = await service.create(TEST_ORG_ID, actor().id, createDto());
      await postBill(bill.id);

      const entry = await journalFor(bill.id);

      expect(entry.status).toBe('POSTED');
      expect(entry.referenceNumber).toMatch(/^JE-\d{6}$/);
      expect(entry.sourceType).toBe('purchase_bill');
      expect(entry.sourceId).toBe(bill.id);
      const byAccount = new Map(entry.lines.map((l) => [l.accountId, l]));
      expect(Number(byAccount.get(INVENTORY_ACCOUNT_ID)?.debitAmount)).toBe(
        600,
      );
      expect(
        Number(byAccount.get(VAT_RECEIVABLE_ACCOUNT_ID)?.debitAmount),
      ).toBe(78);
      expect(byAccount.get(AP_ACCOUNT_ID)?.partyId).toBe(SUPPLIER_PARTY_ID);
      expect(Number(byAccount.get(AP_ACCOUNT_ID)?.creditAmount)).toBe(678);
    });

    it('stocks direct lines in via one purchase_bill IN transaction', async () => {
      const bill = await service.create(TEST_ORG_ID, actor().id, createDto());
      const posted = await postBill(bill.id);

      const txn = await dataSource.manager
        .getRepository(InventoryTransactionEntity)
        .findOneOrFail({
          where: { id: posted.inventoryTransactionId! },
          relations: { lines: true },
        });

      expect(txn.transactionType).toBe('purchase_bill');
      expect(txn.referenceType).toBe('purchase_bill');
      expect(txn.referenceId).toBe(bill.id);
      expect(txn.locationId).toBe(TEST_LOCATION_ID);
      expect(txn.lines).toHaveLength(1);
      expect(txn.lines[0].itemId).toBe(GOODS_ITEM_ID);
      expect(txn.lines[0].direction).toBe('IN');
      expect(txn.lines[0].quantity).toBe('10.000');
      expect(txn.lines[0].unitCost).toBe('60.00');

      const balance = await dataSource.manager
        .getRepository(InventoryBalanceEntity)
        .findOneByOrFail({
          organizationId: TEST_ORG_ID,
          locationId: TEST_LOCATION_ID,
          itemId: GOODS_ITEM_ID,
        });
      expect(balance.quantity).toBe('10.000');
      expect(balance.avgCost).toBe('60.00');
    });

    it('rewrites the moving-average over existing stock', async () => {
      await seedStockAtLocation(
        dataSource,
        GOODS_ITEM_ID,
        10,
        TEST_LOCATION_ID,
        50,
      );
      const bill = await service.create(TEST_ORG_ID, actor().id, createDto());
      await postBill(bill.id);

      const balance = await dataSource.manager
        .getRepository(InventoryBalanceEntity)
        .findOneByOrFail({
          organizationId: TEST_ORG_ID,
          locationId: TEST_LOCATION_ID,
          itemId: GOODS_ITEM_ID,
        });
      expect(balance.quantity).toBe('20.000');
      expect(balance.avgCost).toBe('55.00');
    });

    it('credits a header discount to Discounts Received 5104', async () => {
      const bill = await service.create(
        TEST_ORG_ID,
        actor().id,
        createDto({ discountAmount: 60 }),
      );
      await postBill(bill.id);

      const entry = await journalFor(bill.id);
      const byAccount = new Map(entry.lines.map((l) => [l.accountId, l]));
      expect(Number(byAccount.get(INVENTORY_ACCOUNT_ID)?.debitAmount)).toBe(
        600,
      );
      expect(
        Number(byAccount.get(VAT_RECEIVABLE_ACCOUNT_ID)?.debitAmount),
      ).toBe(70.2);
      expect(
        Number(byAccount.get(DISCOUNT_RECEIVED_ACCOUNT_ID)?.creditAmount),
      ).toBe(60);
      expect(Number(byAccount.get(AP_ACCOUNT_ID)?.creditAmount)).toBe(610.2);
    });

    it('splits TDS: credits TDS Payable and nets AP', async () => {
      const bill = await service.create(TEST_ORG_ID, actor().id, {
        partyId: SUPPLIER_PARTY_ID,
        lines: [directLine({ tdsTaxCodeId: TDS_TAX_CODE_ID })],
      });
      expect(bill.tdsTotal).toBe('9.00');
      expect(bill.total).toBe('678.00');

      await postBill(bill.id);
      const entry = await journalFor(bill.id);
      const byAccount = new Map(entry.lines.map((l) => [l.accountId, l]));
      expect(Number(byAccount.get(INVENTORY_ACCOUNT_ID)?.debitAmount)).toBe(
        600,
      );
      expect(
        Number(byAccount.get(VAT_RECEIVABLE_ACCOUNT_ID)?.debitAmount),
      ).toBe(78);
      expect(Number(byAccount.get(TDS_PAYABLE_ACCOUNT_ID)?.creditAmount)).toBe(
        9,
      );
      expect(Number(byAccount.get(AP_ACCOUNT_ID)?.creditAmount)).toBe(669);
    });

    it('rejects posting twice', async () => {
      const bill = await service.create(TEST_ORG_ID, actor().id, createDto());
      await postBill(bill.id);

      await expect(postBill(bill.id)).rejects.toThrow(
        PurchaseBillNotDraftException,
      );
    });

    it('rejects posting when the supplier was deactivated after capture', async () => {
      const bill = await service.create(TEST_ORG_ID, actor().id, createDto());
      await dataSource.manager.update(
        PartyEntity,
        { id: SUPPLIER_PARTY_ID },
        { isActive: false },
      );

      await expect(postBill(bill.id)).rejects.toThrow(
        PurchaseBillSupplierNotFoundException,
      );
    });

    it('rejects posting when no open fiscal year covers today', async () => {
      const bill = await service.create(TEST_ORG_ID, actor().id, createDto());
      await dataSource.manager.update(
        FiscalYearEntity,
        { id: FISCAL_YEAR_ID },
        { isActive: false },
      );

      await expect(postBill(bill.id)).rejects.toThrow(
        PurchaseBillFiscalYearMissingException,
      );
    });

    it('rejects posting when the monthly quota is exhausted', async () => {
      await dataSource.manager.getRepository(PlanEntity).upsert(
        {
          id: TEST_PLAN_ID,
          code: 'test-pro',
          name: 'Test Pro',
          description: null,
          gracePeriodDays: 3,
          isActive: true,
          limits: {
            invoices_per_month: 1000,
            purchase_receipts_per_month: 1000,
            purchase_bills_per_month: 1000,
          },
        },
        ['id'],
      );
      await dataSource.manager.getRepository(OrganizationUsageEntity).save({
        organizationId: TEST_ORG_ID,
        resourceCode: 'purchase_bills_per_month',
        currentUsage: 1000,
        lastResetAt: new Date('2026-01-01'),
      });
      const bill = await service.create(TEST_ORG_ID, actor().id, createDto());

      await expect(postBill(bill.id)).rejects.toThrow(
        PlanLimitExceededException,
      );
    });

    it('rejects posting to an unknown location', async () => {
      const bill = await service.create(TEST_ORG_ID, actor().id, createDto());

      await expect(
        service.post(TEST_ORG_ID, manager().id, bill.id, {
          inventoryLocationId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        }),
      ).rejects.toThrow(PurchaseBillLocationNotFoundException);
    });
  });

  describe('post (sourced)', () => {
    it('posts journal-only and stamps the receipt line as billed', async () => {
      const grn = await postedGrn();
      const bill = await service.create(TEST_ORG_ID, actor().id, {
        partyId: SUPPLIER_PARTY_ID,
        lines: [{ sourcePurchaseReceiptLineId: grn.lines[0].id }],
      });

      const posted = await postBill(bill.id);

      expect(posted.inventoryTransactionId).toBeNull();
      expect(posted.journalEntryId).not.toBeNull();
      const entry = await journalFor(bill.id);
      const byAccount = new Map(entry.lines.map((l) => [l.accountId, l]));
      expect(Number(byAccount.get(INVENTORY_ACCOUNT_ID)?.debitAmount)).toBe(
        600,
      );
      expect(Number(byAccount.get(AP_ACCOUNT_ID)?.creditAmount)).toBe(678);

      const balance = await dataSource.manager
        .getRepository(InventoryBalanceEntity)
        .findOneByOrFail({
          organizationId: TEST_ORG_ID,
          locationId: TEST_LOCATION_ID,
          itemId: GOODS_ITEM_ID,
        });
      expect(balance.quantity).toBe('10.000');
      expect(balance.avgCost).toBe('60.00');

      const receiptLine = await dataSource.manager
        .getRepository(PurchaseReceiptLineEntity)
        .findOneByOrFail({ id: grn.lines[0].id });
      expect(receiptLine.billedQuantity).toBe('10.000');
    });

    it('rejects posting a second draft over the same receipt line', async () => {
      const grn = await postedGrn();
      const bill1 = await service.create(TEST_ORG_ID, actor().id, {
        partyId: SUPPLIER_PARTY_ID,
        lines: [{ sourcePurchaseReceiptLineId: grn.lines[0].id }],
      });
      const bill2 = await service.create(TEST_ORG_ID, actor().id, {
        partyId: SUPPLIER_PARTY_ID,
        lines: [{ sourcePurchaseReceiptLineId: grn.lines[0].id }],
      });

      await postBill(bill1.id);

      await expect(postBill(bill2.id)).rejects.toThrow(
        PurchaseBillReceiptLineAlreadyBilledException,
      );
    });

    it('rejects a sourced line from a receipt at a different location', async () => {
      const grn = await postedGrn(SECOND_LOCATION_ID);
      const bill = await service.create(TEST_ORG_ID, actor().id, {
        partyId: SUPPLIER_PARTY_ID,
        lines: [{ sourcePurchaseReceiptLineId: grn.lines[0].id }],
      });

      await expect(
        service.post(TEST_ORG_ID, manager().id, bill.id, {
          inventoryLocationId: TEST_LOCATION_ID,
        }),
      ).rejects.toThrow(PurchaseBillReceiptLocationMismatchException);
    });
  });

  describe('void', () => {
    it('cancels a draft bill', async () => {
      const bill = await service.create(TEST_ORG_ID, actor().id, createDto());

      const cancelled = await service.voidBill(
        TEST_ORG_ID,
        TEAMMATE_USER_ID,
        bill.id,
      );

      expect(cancelled.status).toBe('CANCELLED');
    });

    it('rejects voiding a posted bill', async () => {
      const bill = await service.create(TEST_ORG_ID, actor().id, createDto());
      await postBill(bill.id);

      await expect(
        service.voidBill(TEST_ORG_ID, TEAMMATE_USER_ID, bill.id),
      ).rejects.toThrow(PurchaseBillNotDraftException);
    });
  });

  describe('get and list', () => {
    it('returns the full view with tax relations', async () => {
      const bill = await service.create(TEST_ORG_ID, actor().id, createDto());

      const found = await service.get(TEST_ORG_ID, bill.id);

      expect(found.id).toBe(bill.id);
      expect(found.status).toBe('DRAFT');
      expect(found.lines).toHaveLength(1);
      expect(found.lines[0].taxCode).not.toBeNull();
    });

    it('throws for an unknown bill', async () => {
      await expect(
        service.get(TEST_ORG_ID, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),
      ).rejects.toThrow(PurchaseBillNotFoundException);
    });

    it('lists only bills matching the status filter', async () => {
      const bill = await service.create(TEST_ORG_ID, actor().id, createDto());
      await service.create(TEST_ORG_ID, actor().id, createDto());
      await postBill(bill.id);

      const [drafts, draftTotal] = await service.list(TEST_ORG_ID, {
        page: 1,
        limit: 10,
        status: 'DRAFT',
      });
      const [posted, postedTotal] = await service.list(TEST_ORG_ID, {
        page: 1,
        limit: 10,
        status: 'POSTED',
      });

      expect(draftTotal).toBe(1);
      expect(drafts.every((b) => b.status === 'DRAFT')).toBe(true);
      expect(postedTotal).toBe(1);
      expect(posted[0].status).toBe('POSTED');
    });
  });
});
