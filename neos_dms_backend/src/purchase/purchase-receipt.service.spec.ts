import { DataSource } from 'typeorm';
import { FiscalYearEntity } from '../accounting/entities/fiscal-year.entity';
import { PartyEntity } from '../accounting/entities/party.entity';
import { InventoryBalanceEntity } from '../inventory/entities/inventory-balance.entity';
import { InventoryTransactionEntity } from '../inventory/entities/inventory-transaction.entity';
import { OrganizationUsageEntity } from '../subscription/entities/organization-usage.entity';
import { PlanLimitExceededException } from '../subscription/subscription.errors';
import { PurchaseReceiptService } from './purchase-receipt.service';
import {
  BASE_UOM_ID,
  beginTestTransaction,
  BOX_UOM_ID,
  CASE_UOM_ID,
  createPurchaseReceiptTestingModule,
  endTestTransaction,
  FISCAL_YEAR_ID,
  GOODS_ITEM_ID,
  MANAGER_USER_ID,
  NON_SUPPLIER_PARTY_ID,
  SALESMAN_USER_ID,
  seedPurchaseReceiptBaseline,
  seedSalesOrderParties,
  SERVICE_ITEM_ID,
  SUPPLIER_PARTY_ID,
  TEAMMATE_USER_ID,
  TEST_LOCATION_ID,
  TEST_ORG_ID,
  type TestTransaction,
} from '../testing/purchase-receipt-test.harness';
import { createTestDataSource } from '../testing/test-db';
import {
  PurchaseReceiptFiscalYearMissingException,
  PurchaseReceiptItemNotFoundException,
  PurchaseReceiptItemNotTrackedException,
  PurchaseReceiptLocationNotFoundException,
  PurchaseReceiptNotDraftException,
  PurchaseReceiptNotFoundException,
  PurchaseReceiptSupplierNotFoundException,
  PurchaseReceiptUomConversionNotFoundException,
  PurchaseReceiptUomNotFoundException,
  PurchaseReceiptZeroQuantityException,
} from './purchase.errors';

describe('PurchaseReceiptService', () => {
  let dataSource: DataSource;
  let service: PurchaseReceiptService;
  let tx: TestTransaction;

  const actor = () => ({ id: SALESMAN_USER_ID, roleCode: null });
  const manager = () => ({ id: MANAGER_USER_ID, roleCode: 'manager' });

  const line = (overrides: Record<string, unknown> = {}) => ({
    itemId: GOODS_ITEM_ID,
    uomId: BASE_UOM_ID,
    quantity: 10,
    ...overrides,
  });

  const dto = (overrides: Record<string, unknown> = {}) => ({
    partyId: SUPPLIER_PARTY_ID,
    inventoryLocationId: TEST_LOCATION_ID,
    lines: [line()],
    ...overrides,
  });

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    await seedPurchaseReceiptBaseline(dataSource);
    const module = await createPurchaseReceiptTestingModule(dataSource);
    service = module.get(PurchaseReceiptService);
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
    it('creates a DRAFT receipt with no number and base-qty converted lines', async () => {
      const receipt = await service.create(TEST_ORG_ID, actor().id, dto());

      expect(receipt.status).toBe('DRAFT');
      expect(receipt.receiptNumber).toBeNull();
      expect(receipt.partyId).toBe(SUPPLIER_PARTY_ID);
      expect(receipt.inventoryLocationId).toBe(TEST_LOCATION_ID);
      expect(receipt.lines).toHaveLength(1);
      expect(receipt.lines[0].itemId).toBe(GOODS_ITEM_ID);
      expect(receipt.lines[0].quantity).toBe('10.000');
      expect(receipt.lines[0].baseQuantity).toBe('10.000');
      expect(receipt.lines[0].unitCost).toBe('60.00');
    });

    it('converts a box uom to base quantity and honors explicit unit cost', async () => {
      const receipt = await service.create(
        TEST_ORG_ID,
        actor().id,
        dto({
          lines: [line({ uomId: BOX_UOM_ID, quantity: 2, unitCost: 50 })],
        }),
      );

      expect(receipt.lines).toHaveLength(1);
      expect(receipt.lines[0].quantity).toBe('2.000');
      expect(receipt.lines[0].baseQuantity).toBe('24.000');
      expect(receipt.lines[0].unitCost).toBe('50.00');
    });

    it('rejects a party that is not an active supplier', async () => {
      await expect(
        service.create(
          TEST_ORG_ID,
          actor().id,
          dto({ partyId: NON_SUPPLIER_PARTY_ID }),
        ),
      ).rejects.toThrow(PurchaseReceiptSupplierNotFoundException);
    });

    it('rejects a service (non-tracked) item', async () => {
      await expect(
        service.create(
          TEST_ORG_ID,
          actor().id,
          dto({ lines: [line({ itemId: SERVICE_ITEM_ID })] }),
        ),
      ).rejects.toThrow(PurchaseReceiptItemNotTrackedException);
    });

    it('rejects an unknown item', async () => {
      await expect(
        service.create(
          TEST_ORG_ID,
          actor().id,
          dto({
            lines: [line({ itemId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' })],
          }),
        ),
      ).rejects.toThrow(PurchaseReceiptItemNotFoundException);
    });

    it('rejects an unknown uom', async () => {
      await expect(
        service.create(
          TEST_ORG_ID,
          actor().id,
          dto({
            lines: [line({ uomId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' })],
          }),
        ),
      ).rejects.toThrow(PurchaseReceiptUomNotFoundException);
    });

    it('rejects a uom with no conversion to the item base uom', async () => {
      await expect(
        service.create(
          TEST_ORG_ID,
          actor().id,
          dto({ lines: [line({ uomId: CASE_UOM_ID })] }),
        ),
      ).rejects.toThrow(PurchaseReceiptUomConversionNotFoundException);
    });

    it('rejects a zero quantity line', async () => {
      await expect(
        service.create(
          TEST_ORG_ID,
          actor().id,
          dto({ lines: [line({ quantity: 0 })] }),
        ),
      ).rejects.toThrow(PurchaseReceiptZeroQuantityException);
    });

    it('rejects an unknown or inactive location', async () => {
      await expect(
        service.create(
          TEST_ORG_ID,
          actor().id,
          dto({ inventoryLocationId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' }),
        ),
      ).rejects.toThrow(PurchaseReceiptLocationNotFoundException);
    });
  });

  describe('update', () => {
    it('updates a draft and replaces its lines', async () => {
      const created = await service.create(TEST_ORG_ID, actor().id, dto());

      const updated = await service.update(
        TEST_ORG_ID,
        actor().id,
        created.id,
        {
          notes: 'Revised count',
          lines: [line({ quantity: 5 })],
        },
      );

      expect(updated.notes).toBe('Revised count');
      expect(updated.lines).toHaveLength(1);
      expect(updated.lines[0].quantity).toBe('5.000');
      expect(updated.lines[0].baseQuantity).toBe('5.000');
    });

    it('rejects updating a non-draft receipt', async () => {
      const created = await service.create(TEST_ORG_ID, actor().id, dto());
      await service.post(TEST_ORG_ID, manager().id, created.id);

      await expect(
        service.update(TEST_ORG_ID, actor().id, created.id, {
          notes: 'too late',
        }),
      ).rejects.toThrow(PurchaseReceiptNotDraftException);
    });

    it('rejects switching to a non-supplier party', async () => {
      const created = await service.create(TEST_ORG_ID, actor().id, dto());

      await expect(
        service.update(TEST_ORG_ID, actor().id, created.id, {
          partyId: NON_SUPPLIER_PARTY_ID,
        }),
      ).rejects.toThrow(PurchaseReceiptSupplierNotFoundException);
    });
  });

  describe('post', () => {
    it('posts a draft: reserves the GRN number, stocks IN, and sets metadata', async () => {
      const created = await service.create(TEST_ORG_ID, actor().id, dto());

      const posted = await service.post(TEST_ORG_ID, manager().id, created.id);

      expect(posted.status).toBe('POSTED');
      expect(posted.receiptNumber).toMatch(/^GRN-\d{6}$/);
      expect(posted.receiptDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(posted.receiptDateBs).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(posted.fiscalYearId).toBe(FISCAL_YEAR_ID);
      expect(posted.inventoryTransactionId).not.toBeNull();
    });

    it('creates one quantity-only purchase_receipt IN transaction', async () => {
      const created = await service.create(TEST_ORG_ID, actor().id, dto());
      const posted = await service.post(TEST_ORG_ID, manager().id, created.id);

      const txn = await dataSource.manager
        .getRepository(InventoryTransactionEntity)
        .findOneOrFail({
          where: { id: posted.inventoryTransactionId! },
          relations: { lines: true },
        });

      expect(txn.transactionType).toBe('purchase_receipt');
      expect(txn.referenceType).toBe('purchase_receipt');
      expect(txn.referenceId).toBe(created.id);
      expect(txn.locationId).toBe(TEST_LOCATION_ID);
      expect(txn.toLocationId).toBeNull();
      expect(txn.status).toBe('POSTED');
      expect(txn.lines).toHaveLength(1);
      expect(txn.lines[0].itemId).toBe(GOODS_ITEM_ID);
      expect(txn.lines[0].direction).toBe('IN');
      expect(txn.lines[0].quantity).toBe('10.000');
      expect(txn.lines[0].unitCost).toBe('60.00');
    });

    it('increases the stock balance at the receipt location', async () => {
      const created = await service.create(TEST_ORG_ID, actor().id, dto());
      await service.post(TEST_ORG_ID, manager().id, created.id);

      const balance = await dataSource.manager
        .getRepository(InventoryBalanceEntity)
        .findOneByOrFail({
          organizationId: TEST_ORG_ID,
          locationId: TEST_LOCATION_ID,
          itemId: GOODS_ITEM_ID,
        });

      expect(balance.quantity).toBe('10.000');
    });

    it('rejects posting twice', async () => {
      const created = await service.create(TEST_ORG_ID, actor().id, dto());
      await service.post(TEST_ORG_ID, manager().id, created.id);

      await expect(
        service.post(TEST_ORG_ID, manager().id, created.id),
      ).rejects.toThrow(PurchaseReceiptNotDraftException);
    });

    it('rejects posting when the supplier was deactivated after capture', async () => {
      const created = await service.create(TEST_ORG_ID, actor().id, dto());
      await dataSource.manager.update(
        PartyEntity,
        { id: SUPPLIER_PARTY_ID },
        { isActive: false },
      );

      await expect(
        service.post(TEST_ORG_ID, manager().id, created.id),
      ).rejects.toThrow(PurchaseReceiptSupplierNotFoundException);
    });

    it('rejects posting when no open fiscal year covers today', async () => {
      const created = await service.create(TEST_ORG_ID, actor().id, dto());
      await dataSource.manager.update(
        FiscalYearEntity,
        { id: FISCAL_YEAR_ID },
        { isActive: false },
      );

      await expect(
        service.post(TEST_ORG_ID, manager().id, created.id),
      ).rejects.toThrow(PurchaseReceiptFiscalYearMissingException);
    });

    it('rejects posting when the monthly quota is exhausted', async () => {
      await dataSource.manager.getRepository(OrganizationUsageEntity).save({
        organizationId: TEST_ORG_ID,
        resourceCode: 'purchase_receipts_per_month',
        currentUsage: 1000,
        lastResetAt: new Date('2026-01-01'),
      });
      const created = await service.create(TEST_ORG_ID, actor().id, dto());

      await expect(
        service.post(TEST_ORG_ID, manager().id, created.id),
      ).rejects.toThrow(PlanLimitExceededException);
    });
  });

  describe('void', () => {
    it('cancels a draft receipt', async () => {
      const created = await service.create(TEST_ORG_ID, actor().id, dto());

      const cancelled = await service.voidReceipt(
        TEST_ORG_ID,
        TEAMMATE_USER_ID,
        created.id,
      );

      expect(cancelled.status).toBe('CANCELLED');
    });

    it('rejects voiding a posted receipt', async () => {
      const created = await service.create(TEST_ORG_ID, actor().id, dto());
      await service.post(TEST_ORG_ID, manager().id, created.id);

      await expect(
        service.voidReceipt(TEST_ORG_ID, TEAMMATE_USER_ID, created.id),
      ).rejects.toThrow(PurchaseReceiptNotDraftException);
    });
  });

  describe('get and list', () => {
    it('returns the full view for an existing receipt', async () => {
      const created = await service.create(TEST_ORG_ID, actor().id, dto());

      const found = await service.get(TEST_ORG_ID, created.id);

      expect(found.id).toBe(created.id);
      expect(found.status).toBe('DRAFT');
      expect(found.lines).toHaveLength(1);
    });

    it('throws for an unknown receipt', async () => {
      await expect(
        service.get(TEST_ORG_ID, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),
      ).rejects.toThrow(PurchaseReceiptNotFoundException);
    });

    it('lists only receipts matching the status filter', async () => {
      const created = await service.create(TEST_ORG_ID, actor().id, dto());
      await service.create(TEST_ORG_ID, actor().id, dto());
      await service.post(TEST_ORG_ID, manager().id, created.id);

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
