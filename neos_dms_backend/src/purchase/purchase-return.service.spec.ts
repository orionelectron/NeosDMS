import { DataSource } from 'typeorm';
import { FiscalYearEntity } from '../accounting/entities/fiscal-year.entity';
import { JournalEntryEntity } from '../accounting/entities/journal-entry.entity';
import { PartyEntity } from '../accounting/entities/party.entity';
import { InventoryBalanceEntity } from '../inventory/entities/inventory-balance.entity';
import { InventoryTransactionEntity } from '../inventory/entities/inventory-transaction.entity';
import { PurchaseBillLineEntity } from './entities/purchase-bill-line.entity';
import { PurchaseReceiptLineEntity } from './entities/purchase-receipt-line.entity';
import { PurchaseBillService } from './purchase-bill.service';
import { PurchaseReceiptService } from './purchase-receipt.service';
import { PurchaseReturnService } from './purchase-return.service';
import {
  AP_ACCOUNT_ID,
  BASE_UOM_ID,
  beginTestTransaction,
  createPurchaseReturnTestingModule,
  CUSTOMER_PARTY_ID,
  endTestTransaction,
  FISCAL_YEAR_ID,
  GOODS_ITEM_ID,
  INVENTORY_ACCOUNT_ID,
  MANAGER_USER_ID,
  SALESMAN_USER_ID,
  SECOND_LOCATION_ID,
  seedPurchaseReturnBaseline,
  seedSalesOrderParties,
  seedSecondSupplier,
  seedStockAtLocation,
  SUPPLIER_PARTY_ID,
  TDS_PAYABLE_ACCOUNT_ID,
  TDS_TAX_CODE_ID,
  TEAMMATE_USER_ID,
  TEST_LOCATION_ID,
  TEST_ORG_ID,
  type TestTransaction,
  VAT_RECEIVABLE_ACCOUNT_ID,
} from '../testing/purchase-return-test.harness';
import { createTestDataSource } from '../testing/test-db';
import {
  PurchaseReturnFiscalYearMissingException,
  PurchaseReturnLineIncompleteException,
  PurchaseReturnLocationMismatchException,
  PurchaseReturnLocationNotFoundException,
  PurchaseReturnNoRemainingException,
  PurchaseReturnNotDraftException,
  PurchaseReturnNotFoundException,
  PurchaseReturnQuantityExceededException,
  PurchaseReturnReceiptLineBilledException,
  PurchaseReturnSourceBillLineNotFoundException,
  PurchaseReturnSourceNotPostedException,
  PurchaseReturnSourceReceiptLineNotFoundException,
  PurchaseReturnSupplierMismatchException,
  PurchaseReturnSupplierNotFoundException,
} from './purchase.errors';

describe('PurchaseReturnService', () => {
  let dataSource: DataSource;
  let service: PurchaseReturnService;
  let billService: PurchaseBillService;
  let receiptService: PurchaseReceiptService;
  let tx: TestTransaction;

  const actor = () => ({ id: SALESMAN_USER_ID, roleCode: null });
  const manager = () => ({ id: MANAGER_USER_ID, roleCode: 'manager' });

  const createDto = (overrides: Record<string, unknown> = {}) => ({
    partyId: SUPPLIER_PARTY_ID,
    lines: [{ sourcePurchaseBillLineId: 'replace-me' }],
    ...overrides,
  });

  const postReturn = async (id: string, locationId = TEST_LOCATION_ID) =>
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

  async function postedBill(locationId = TEST_LOCATION_ID) {
    const bill = await billService.create(TEST_ORG_ID, manager().id, {
      partyId: SUPPLIER_PARTY_ID,
      lines: [
        {
          itemId: GOODS_ITEM_ID,
          uomId: BASE_UOM_ID,
          quantity: 10,
          unitPrice: 60,
        },
      ],
    });
    return billService.post(TEST_ORG_ID, manager().id, bill.id, {
      inventoryLocationId: locationId,
    });
  }

  async function postedTdsBill(locationId = TEST_LOCATION_ID) {
    const bill = await billService.create(TEST_ORG_ID, manager().id, {
      partyId: SUPPLIER_PARTY_ID,
      lines: [
        {
          itemId: GOODS_ITEM_ID,
          uomId: BASE_UOM_ID,
          quantity: 10,
          unitPrice: 60,
          tdsTaxCodeId: TDS_TAX_CODE_ID,
        },
      ],
    });
    return billService.post(TEST_ORG_ID, manager().id, bill.id, {
      inventoryLocationId: locationId,
    });
  }

  async function journalFor(returnId: string) {
    const purchaseReturn = await service.get(TEST_ORG_ID, returnId);
    return dataSource.manager.getRepository(JournalEntryEntity).findOneOrFail({
      where: { id: purchaseReturn.journalEntryId! },
      relations: { lines: true },
    });
  }

  async function balanceFor(
    itemId: string = GOODS_ITEM_ID,
    locationId: string = TEST_LOCATION_ID,
  ) {
    return dataSource.manager
      .getRepository(InventoryBalanceEntity)
      .findOneByOrFail({
        organizationId: TEST_ORG_ID,
        locationId,
        itemId,
      });
  }

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    await seedPurchaseReturnBaseline(dataSource);
    const module = await createPurchaseReturnTestingModule(dataSource);
    service = module.get(PurchaseReturnService);
    billService = module.get(PurchaseBillService);
    receiptService = module.get(PurchaseReceiptService);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    tx = await beginTestTransaction(dataSource);
    await seedSalesOrderParties(dataSource);
    await seedSecondSupplier(dataSource);
  });

  afterEach(async () => {
    await endTestTransaction(dataSource, tx);
  });

  describe('create', () => {
    it('creates a DRAFT bill-sourced return with computed totals and no number', async () => {
      const bill = await postedBill();

      const purchaseReturn = await service.create(
        TEST_ORG_ID,
        actor().id,
        createDto({
          lines: [{ sourcePurchaseBillLineId: bill.lines[0].id, quantity: 4 }],
        }),
      );

      expect(purchaseReturn.status).toBe('DRAFT');
      expect(purchaseReturn.returnNumber).toBeNull();
      expect(purchaseReturn.partyId).toBe(SUPPLIER_PARTY_ID);
      expect(purchaseReturn.inventoryLocationId).toBeNull();
      expect(purchaseReturn.taxableTotal).toBe('240.00');
      expect(purchaseReturn.nonTaxableTotal).toBe('0.00');
      expect(purchaseReturn.subtotal).toBe('240.00');
      expect(purchaseReturn.taxTotal).toBe('31.20');
      expect(purchaseReturn.tdsTotal).toBe('0.00');
      expect(purchaseReturn.total).toBe('271.20');
      expect(purchaseReturn.lines).toHaveLength(1);
      expect(purchaseReturn.lines[0].sourcePurchaseBillLineId).toBe(
        bill.lines[0].id,
      );
      expect(purchaseReturn.lines[0].quantity).toBe('4.000');
      expect(purchaseReturn.lines[0].baseQuantity).toBe('4.000');
      expect(purchaseReturn.lines[0].unitPrice).toBe('60.00');
      expect(purchaseReturn.lines[0].grossAmount).toBe('240.00');
      expect(purchaseReturn.lines[0].taxRate).toBe('13.0000');
      expect(purchaseReturn.lines[0].taxAmount).toBe('31.20');
      expect(purchaseReturn.lines[0].lineTotal).toBe('271.20');
    });

    it('creates a DRAFT never-billed GRN return with zero totals', async () => {
      const grn = await postedGrn();

      const purchaseReturn = await service.create(TEST_ORG_ID, actor().id, {
        partyId: SUPPLIER_PARTY_ID,
        lines: [{ sourcePurchaseReceiptLineId: grn.lines[0].id, quantity: 4 }],
      });

      expect(purchaseReturn.status).toBe('DRAFT');
      expect(purchaseReturn.taxableTotal).toBe('0.00');
      expect(purchaseReturn.subtotal).toBe('0.00');
      expect(purchaseReturn.taxTotal).toBe('0.00');
      expect(purchaseReturn.total).toBe('0.00');
      expect(purchaseReturn.lines[0].sourcePurchaseReceiptLineId).toBe(
        grn.lines[0].id,
      );
      expect(purchaseReturn.lines[0].grossAmount).toBe('0.00');
    });

    it('defaults to the remaining quantity after a prior return', async () => {
      const bill = await postedBill();
      const first = await service.create(TEST_ORG_ID, actor().id, {
        partyId: SUPPLIER_PARTY_ID,
        lines: [{ sourcePurchaseBillLineId: bill.lines[0].id, quantity: 4 }],
      });
      await postReturn(first.id);

      const second = await service.create(TEST_ORG_ID, actor().id, {
        partyId: SUPPLIER_PARTY_ID,
        lines: [{ sourcePurchaseBillLineId: bill.lines[0].id }],
      });

      expect(second.lines[0].quantity).toBe('6.000');
      expect(second.lines[0].baseQuantity).toBe('6.000');
    });

    it('rejects a party that is not an active supplier', async () => {
      await expect(
        service.create(
          TEST_ORG_ID,
          actor().id,
          createDto({ partyId: CUSTOMER_PARTY_ID }),
        ),
      ).rejects.toThrow(PurchaseReturnSupplierNotFoundException);
    });

    it('rejects a line with both or neither source', async () => {
      const bill = await postedBill();

      await expect(
        service.create(TEST_ORG_ID, actor().id, {
          partyId: SUPPLIER_PARTY_ID,
          lines: [
            {
              sourcePurchaseBillLineId: bill.lines[0].id,
              sourcePurchaseReceiptLineId: bill.lines[0].id,
            },
          ],
        }),
      ).rejects.toThrow(PurchaseReturnLineIncompleteException);

      await expect(
        service.create(TEST_ORG_ID, actor().id, {
          partyId: SUPPLIER_PARTY_ID,
          lines: [{}],
        }),
      ).rejects.toThrow(PurchaseReturnLineIncompleteException);
    });

    it('rejects a source bill line from a non-posted bill', async () => {
      const bill = await billService.create(TEST_ORG_ID, manager().id, {
        partyId: SUPPLIER_PARTY_ID,
        lines: [
          {
            itemId: GOODS_ITEM_ID,
            uomId: BASE_UOM_ID,
            quantity: 10,
            unitPrice: 60,
          },
        ],
      });

      await expect(
        service.create(TEST_ORG_ID, actor().id, {
          partyId: SUPPLIER_PARTY_ID,
          lines: [{ sourcePurchaseBillLineId: bill.lines[0].id }],
        }),
      ).rejects.toThrow(PurchaseReturnSourceNotPostedException);
    });

    it('rejects an unknown source bill line', async () => {
      await expect(
        service.create(TEST_ORG_ID, actor().id, {
          partyId: SUPPLIER_PARTY_ID,
          lines: [
            {
              sourcePurchaseBillLineId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
            },
          ],
        }),
      ).rejects.toThrow(PurchaseReturnSourceBillLineNotFoundException);
    });

    it('rejects an unknown source receipt line', async () => {
      await expect(
        service.create(TEST_ORG_ID, actor().id, {
          partyId: SUPPLIER_PARTY_ID,
          lines: [
            {
              sourcePurchaseReceiptLineId:
                'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
            },
          ],
        }),
      ).rejects.toThrow(PurchaseReturnSourceReceiptLineNotFoundException);
    });

    it('rejects a source from a different supplier', async () => {
      const bill = await postedBill();

      await expect(
        service.create(TEST_ORG_ID, actor().id, {
          partyId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee1e',
          lines: [{ sourcePurchaseBillLineId: bill.lines[0].id }],
        }),
      ).rejects.toThrow(PurchaseReturnSupplierMismatchException);
    });

    it('rejects returning more than the remaining quantity', async () => {
      const bill = await postedBill();

      await expect(
        service.create(TEST_ORG_ID, actor().id, {
          partyId: SUPPLIER_PARTY_ID,
          lines: [{ sourcePurchaseBillLineId: bill.lines[0].id, quantity: 11 }],
        }),
      ).rejects.toThrow(PurchaseReturnQuantityExceededException);
    });

    it('rejects a GRN-sourced line that was already billed', async () => {
      const grn = await postedGrn();
      const bill = await billService.create(TEST_ORG_ID, manager().id, {
        partyId: SUPPLIER_PARTY_ID,
        lines: [{ sourcePurchaseReceiptLineId: grn.lines[0].id }],
      });
      await billService.post(TEST_ORG_ID, manager().id, bill.id, {
        inventoryLocationId: TEST_LOCATION_ID,
      });

      await expect(
        service.create(TEST_ORG_ID, actor().id, {
          partyId: SUPPLIER_PARTY_ID,
          lines: [{ sourcePurchaseReceiptLineId: grn.lines[0].id }],
        }),
      ).rejects.toThrow(PurchaseReturnReceiptLineBilledException);
    });
  });

  describe('update', () => {
    it('updates a draft and replaces its lines', async () => {
      const bill = await postedBill();
      const purchaseReturn = await service.create(TEST_ORG_ID, actor().id, {
        partyId: SUPPLIER_PARTY_ID,
        lines: [{ sourcePurchaseBillLineId: bill.lines[0].id, quantity: 4 }],
      });

      const updated = await service.update(
        TEST_ORG_ID,
        actor().id,
        purchaseReturn.id,
        {
          notes: 'Defective goods',
          lines: [{ sourcePurchaseBillLineId: bill.lines[0].id, quantity: 2 }],
        },
      );

      expect(updated.notes).toBe('Defective goods');
      expect(updated.lines).toHaveLength(1);
      expect(updated.lines[0].quantity).toBe('2.000');
      expect(updated.taxableTotal).toBe('120.00');
      expect(updated.total).toBe('135.60');
    });

    it('rejects updating a posted return', async () => {
      const bill = await postedBill();
      const purchaseReturn = await service.create(TEST_ORG_ID, actor().id, {
        partyId: SUPPLIER_PARTY_ID,
        lines: [{ sourcePurchaseBillLineId: bill.lines[0].id }],
      });
      await postReturn(purchaseReturn.id);

      await expect(
        service.update(TEST_ORG_ID, actor().id, purchaseReturn.id, {
          notes: 'too late',
        }),
      ).rejects.toThrow(PurchaseReturnNotDraftException);
    });
  });

  describe('post (bill-sourced)', () => {
    it('posts a draft: reserves DN- number, reverse journal, stock-out and metadata', async () => {
      const bill = await postedBill();
      const purchaseReturn = await service.create(TEST_ORG_ID, actor().id, {
        partyId: SUPPLIER_PARTY_ID,
        lines: [{ sourcePurchaseBillLineId: bill.lines[0].id, quantity: 4 }],
      });

      const posted = await postReturn(purchaseReturn.id);

      expect(posted.status).toBe('POSTED');
      expect(posted.returnNumber).toMatch(/^DN-\d{6}$/);
      expect(posted.returnDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(posted.returnDateBs).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(posted.fiscalYearId).toBe(FISCAL_YEAR_ID);
      expect(posted.inventoryLocationId).toBe(TEST_LOCATION_ID);
      expect(posted.journalEntryId).not.toBeNull();
      expect(posted.inventoryTransactionId).not.toBeNull();
    });

    it('posts a balanced reverse Inventory/VAT/AP journal', async () => {
      const bill = await postedBill();
      const purchaseReturn = await service.create(TEST_ORG_ID, actor().id, {
        partyId: SUPPLIER_PARTY_ID,
        lines: [{ sourcePurchaseBillLineId: bill.lines[0].id, quantity: 4 }],
      });
      await postReturn(purchaseReturn.id);

      const entry = await journalFor(purchaseReturn.id);

      expect(entry.status).toBe('POSTED');
      expect(entry.referenceNumber).toMatch(/^JE-\d{6}$/);
      expect(entry.sourceType).toBe('purchase_return');
      expect(entry.sourceId).toBe(purchaseReturn.id);
      const byAccount = new Map(entry.lines.map((l) => [l.accountId, l]));
      expect(byAccount.get(AP_ACCOUNT_ID)?.partyId).toBe(SUPPLIER_PARTY_ID);
      expect(Number(byAccount.get(AP_ACCOUNT_ID)?.debitAmount)).toBe(271.2);
      expect(Number(byAccount.get(INVENTORY_ACCOUNT_ID)?.creditAmount)).toBe(
        240,
      );
      expect(
        Number(byAccount.get(VAT_RECEIVABLE_ACCOUNT_ID)?.creditAmount),
      ).toBe(31.2);
    });

    it('reverses TDS: debits TDS Payable and nets AP', async () => {
      const bill = await postedTdsBill();
      expect(bill.tdsTotal).toBe('9.00');
      const purchaseReturn = await service.create(TEST_ORG_ID, actor().id, {
        partyId: SUPPLIER_PARTY_ID,
        lines: [{ sourcePurchaseBillLineId: bill.lines[0].id, quantity: 4 }],
      });
      expect(purchaseReturn.tdsTotal).toBe('3.60');
      expect(purchaseReturn.total).toBe('271.20');

      await postReturn(purchaseReturn.id);
      const entry = await journalFor(purchaseReturn.id);
      const byAccount = new Map(entry.lines.map((l) => [l.accountId, l]));
      expect(Number(byAccount.get(TDS_PAYABLE_ACCOUNT_ID)?.debitAmount)).toBe(
        3.6,
      );
      expect(Number(byAccount.get(AP_ACCOUNT_ID)?.debitAmount)).toBe(267.6);
      expect(Number(byAccount.get(INVENTORY_ACCOUNT_ID)?.creditAmount)).toBe(
        240,
      );
      expect(
        Number(byAccount.get(VAT_RECEIVABLE_ACCOUNT_ID)?.creditAmount),
      ).toBe(31.2);
    });

    it('moves stock out and reweights avg_cost down at the bill value', async () => {
      await seedStockAtLocation(
        dataSource,
        GOODS_ITEM_ID,
        10,
        TEST_LOCATION_ID,
        50,
      );
      const bill = await postedBill();
      const purchaseReturn = await service.create(TEST_ORG_ID, actor().id, {
        partyId: SUPPLIER_PARTY_ID,
        lines: [{ sourcePurchaseBillLineId: bill.lines[0].id, quantity: 4 }],
      });
      const posted = await postReturn(purchaseReturn.id);

      const txn = await dataSource.manager
        .getRepository(InventoryTransactionEntity)
        .findOneOrFail({
          where: { id: posted.inventoryTransactionId! },
          relations: { lines: true },
        });

      expect(txn.transactionType).toBe('purchase_return');
      expect(txn.referenceType).toBe('purchase_return');
      expect(txn.referenceId).toBe(purchaseReturn.id);
      expect(txn.lines).toHaveLength(1);
      expect(txn.lines[0].direction).toBe('OUT');
      expect(txn.lines[0].quantity).toBe('4.000');
      expect(txn.lines[0].unitCost).toBe('60.00');

      const balance = await balanceFor();
      expect(balance.quantity).toBe('16.000');
      expect(balance.avgCost).toBe('53.75');
    });

    it('stamps returned_quantity on the source bill line', async () => {
      const bill = await postedBill();
      const purchaseReturn = await service.create(TEST_ORG_ID, actor().id, {
        partyId: SUPPLIER_PARTY_ID,
        lines: [{ sourcePurchaseBillLineId: bill.lines[0].id, quantity: 4 }],
      });
      await postReturn(purchaseReturn.id);

      const billLine = await dataSource.manager
        .getRepository(PurchaseBillLineEntity)
        .findOneByOrFail({ id: bill.lines[0].id });
      expect(billLine.returnedQuantity).toBe('4.000');
    });

    it('rejects posting twice', async () => {
      const bill = await postedBill();
      const purchaseReturn = await service.create(TEST_ORG_ID, actor().id, {
        partyId: SUPPLIER_PARTY_ID,
        lines: [{ sourcePurchaseBillLineId: bill.lines[0].id }],
      });
      await postReturn(purchaseReturn.id);

      await expect(postReturn(purchaseReturn.id)).rejects.toThrow(
        PurchaseReturnNotDraftException,
      );
    });

    it('rejects posting when the supplier was deactivated after capture', async () => {
      const bill = await postedBill();
      const purchaseReturn = await service.create(TEST_ORG_ID, actor().id, {
        partyId: SUPPLIER_PARTY_ID,
        lines: [{ sourcePurchaseBillLineId: bill.lines[0].id }],
      });
      await dataSource.manager.update(
        PartyEntity,
        { id: SUPPLIER_PARTY_ID },
        { isActive: false },
      );

      await expect(postReturn(purchaseReturn.id)).rejects.toThrow(
        PurchaseReturnSupplierNotFoundException,
      );
    });

    it('rejects posting when no open fiscal year covers today', async () => {
      const bill = await postedBill();
      const purchaseReturn = await service.create(TEST_ORG_ID, actor().id, {
        partyId: SUPPLIER_PARTY_ID,
        lines: [{ sourcePurchaseBillLineId: bill.lines[0].id }],
      });
      await dataSource.manager.update(
        FiscalYearEntity,
        { id: FISCAL_YEAR_ID },
        { isActive: false },
      );

      await expect(postReturn(purchaseReturn.id)).rejects.toThrow(
        PurchaseReturnFiscalYearMissingException,
      );
    });

    it('rejects posting to an unknown location', async () => {
      const bill = await postedBill();
      const purchaseReturn = await service.create(TEST_ORG_ID, actor().id, {
        partyId: SUPPLIER_PARTY_ID,
        lines: [{ sourcePurchaseBillLineId: bill.lines[0].id }],
      });

      await expect(
        service.post(TEST_ORG_ID, manager().id, purchaseReturn.id, {
          inventoryLocationId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        }),
      ).rejects.toThrow(PurchaseReturnLocationNotFoundException);
    });

    it('rejects a bill-sourced line from a bill at a different location', async () => {
      const bill = await postedBill(SECOND_LOCATION_ID);
      const purchaseReturn = await service.create(TEST_ORG_ID, actor().id, {
        partyId: SUPPLIER_PARTY_ID,
        lines: [{ sourcePurchaseBillLineId: bill.lines[0].id }],
      });

      await expect(postReturn(purchaseReturn.id)).rejects.toThrow(
        PurchaseReturnLocationMismatchException,
      );
    });

    it('rejects over-return at POST after a concurrent return consumed the line', async () => {
      const bill = await postedBill();
      const first = await service.create(TEST_ORG_ID, actor().id, {
        partyId: SUPPLIER_PARTY_ID,
        lines: [{ sourcePurchaseBillLineId: bill.lines[0].id, quantity: 5 }],
      });
      const second = await service.create(TEST_ORG_ID, actor().id, {
        partyId: SUPPLIER_PARTY_ID,
        lines: [{ sourcePurchaseBillLineId: bill.lines[0].id, quantity: 6 }],
      });
      await postReturn(second.id);

      await expect(postReturn(first.id)).rejects.toThrow(
        PurchaseReturnQuantityExceededException,
      );
    });

    it('rejects a return with nothing left to return', async () => {
      const bill = await postedBill();
      const purchaseReturn = await service.create(TEST_ORG_ID, actor().id, {
        partyId: SUPPLIER_PARTY_ID,
        lines: [{ sourcePurchaseBillLineId: bill.lines[0].id, quantity: 10 }],
      });
      await postReturn(purchaseReturn.id);

      await expect(
        service.create(TEST_ORG_ID, actor().id, {
          partyId: SUPPLIER_PARTY_ID,
          lines: [{ sourcePurchaseBillLineId: bill.lines[0].id }],
        }),
      ).rejects.toThrow(PurchaseReturnNoRemainingException);
    });
  });

  describe('post (GRN-sourced)', () => {
    it('posts stock-out only: no journal, quantity drops, pool value stays', async () => {
      await seedStockAtLocation(
        dataSource,
        GOODS_ITEM_ID,
        10,
        TEST_LOCATION_ID,
        50,
      );
      const grn = await postedGrn();
      const purchaseReturn = await service.create(TEST_ORG_ID, actor().id, {
        partyId: SUPPLIER_PARTY_ID,
        lines: [{ sourcePurchaseReceiptLineId: grn.lines[0].id, quantity: 4 }],
      });

      const posted = await postReturn(purchaseReturn.id);

      expect(posted.journalEntryId).toBeNull();
      expect(posted.inventoryTransactionId).not.toBeNull();

      const txn = await dataSource.manager
        .getRepository(InventoryTransactionEntity)
        .findOneOrFail({
          where: { id: posted.inventoryTransactionId! },
          relations: { lines: true },
        });
      expect(txn.transactionType).toBe('purchase_return');
      expect(txn.lines[0].direction).toBe('OUT');
      expect(txn.lines[0].unitCost).toBe('0.00');

      const balance = await balanceFor();
      expect(balance.quantity).toBe('16.000');
      expect(balance.avgCost).toBe('62.50');

      const receiptLine = await dataSource.manager
        .getRepository(PurchaseReceiptLineEntity)
        .findOneByOrFail({ id: grn.lines[0].id });
      expect(receiptLine.returnedQuantity).toBe('4.000');
    });

    it('rejects when the receipt line got billed between draft and post', async () => {
      const grn = await postedGrn();
      const purchaseReturn = await service.create(TEST_ORG_ID, actor().id, {
        partyId: SUPPLIER_PARTY_ID,
        lines: [{ sourcePurchaseReceiptLineId: grn.lines[0].id, quantity: 4 }],
      });

      const bill = await billService.create(TEST_ORG_ID, manager().id, {
        partyId: SUPPLIER_PARTY_ID,
        lines: [{ sourcePurchaseReceiptLineId: grn.lines[0].id }],
      });
      await billService.post(TEST_ORG_ID, manager().id, bill.id, {
        inventoryLocationId: TEST_LOCATION_ID,
      });

      await expect(postReturn(purchaseReturn.id)).rejects.toThrow(
        PurchaseReturnReceiptLineBilledException,
      );
    });
  });

  describe('bill after return (integration)', () => {
    it('bills the remaining quantity after a partial never-billed return', async () => {
      const grn = await postedGrn();
      const purchaseReturn = await service.create(TEST_ORG_ID, actor().id, {
        partyId: SUPPLIER_PARTY_ID,
        lines: [{ sourcePurchaseReceiptLineId: grn.lines[0].id, quantity: 4 }],
      });
      await postReturn(purchaseReturn.id);

      const bill = await billService.create(TEST_ORG_ID, manager().id, {
        partyId: SUPPLIER_PARTY_ID,
        lines: [{ sourcePurchaseReceiptLineId: grn.lines[0].id, quantity: 6 }],
      });
      const posted = await billService.post(
        TEST_ORG_ID,
        manager().id,
        bill.id,
        {
          inventoryLocationId: TEST_LOCATION_ID,
        },
      );

      expect(posted.total).toBe('406.80');

      const receiptLine = await dataSource.manager
        .getRepository(PurchaseReceiptLineEntity)
        .findOneByOrFail({ id: grn.lines[0].id });
      expect(receiptLine.billedQuantity).toBe('6.000');
      expect(receiptLine.returnedQuantity).toBe('4.000');
    });
  });

  describe('void', () => {
    it('cancels a draft return', async () => {
      const bill = await postedBill();
      const purchaseReturn = await service.create(TEST_ORG_ID, actor().id, {
        partyId: SUPPLIER_PARTY_ID,
        lines: [{ sourcePurchaseBillLineId: bill.lines[0].id }],
      });

      const cancelled = await service.voidReturn(
        TEST_ORG_ID,
        TEAMMATE_USER_ID,
        purchaseReturn.id,
      );

      expect(cancelled.status).toBe('CANCELLED');
    });

    it('rejects voiding a posted return', async () => {
      const bill = await postedBill();
      const purchaseReturn = await service.create(TEST_ORG_ID, actor().id, {
        partyId: SUPPLIER_PARTY_ID,
        lines: [{ sourcePurchaseBillLineId: bill.lines[0].id }],
      });
      await postReturn(purchaseReturn.id);

      await expect(
        service.voidReturn(TEST_ORG_ID, TEAMMATE_USER_ID, purchaseReturn.id),
      ).rejects.toThrow(PurchaseReturnNotDraftException);
    });
  });

  describe('get and list', () => {
    it('returns the full view with source relations', async () => {
      const bill = await postedBill();
      const purchaseReturn = await service.create(TEST_ORG_ID, actor().id, {
        partyId: SUPPLIER_PARTY_ID,
        lines: [{ sourcePurchaseBillLineId: bill.lines[0].id }],
      });

      const found = await service.get(TEST_ORG_ID, purchaseReturn.id);

      expect(found.id).toBe(purchaseReturn.id);
      expect(found.status).toBe('DRAFT');
      expect(found.lines).toHaveLength(1);
      expect(found.lines[0].sourceBillLine).not.toBeNull();
    });

    it('throws for an unknown return', async () => {
      await expect(
        service.get(TEST_ORG_ID, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),
      ).rejects.toThrow(PurchaseReturnNotFoundException);
    });

    it('lists only returns matching the status filter', async () => {
      const bill = await postedBill();
      const purchaseReturn = await service.create(TEST_ORG_ID, actor().id, {
        partyId: SUPPLIER_PARTY_ID,
        lines: [{ sourcePurchaseBillLineId: bill.lines[0].id }],
      });
      await service.create(TEST_ORG_ID, actor().id, {
        partyId: SUPPLIER_PARTY_ID,
        lines: [{ sourcePurchaseBillLineId: bill.lines[0].id }],
      });
      await postReturn(purchaseReturn.id);

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
      expect(drafts.every((r) => r.status === 'DRAFT')).toBe(true);
      expect(postedTotal).toBe(1);
      expect(posted[0].status).toBe('POSTED');
    });
  });
});
