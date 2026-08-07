import { DataSource } from 'typeorm';
import { JournalEntryEntity } from '../accounting/entities/journal-entry.entity';
import { PurchaseBillEntity } from './entities/purchase-bill.entity';
import { PurchaseBillService } from './purchase-bill.service';
import { SupplierPaymentService } from './supplier-payment.service';
import {
  AP_ACCOUNT_ID,
  beginTestTransaction,
  CASH_ACCOUNT_ID,
  CUSTOMER_PARTY_ID,
  createSupplierPaymentTestingModule,
  endTestTransaction,
  GOODS_ITEM_ID,
  BASE_UOM_ID,
  MANAGER_USER_ID,
  PAYMENT_METHOD_ID,
  SECOND_SUPPLIER_PARTY_ID,
  seedSalesOrderParties,
  seedSecondSupplier,
  seedSupplierPaymentBaseline,
  SUPPLIER_PARTY_ID,
  TEAMMATE_USER_ID,
  TEST_LOCATION_ID,
  TEST_ORG_ID,
  type TestTransaction,
} from '../testing/supplier-payment-test.harness';
import { createTestDataSource } from '../testing/test-db';
import {
  SupplierPaymentAccountTypeException,
  SupplierPaymentAllocationExceedsBalanceException,
  SupplierPaymentAllocationZeroException,
  SupplierPaymentBillNotPostedException,
  SupplierPaymentBillSupplierMismatchException,
  SupplierPaymentNotDraftException,
  SupplierPaymentNotFoundException,
  SupplierPaymentSupplierNotFoundException,
} from './purchase.errors';

describe('SupplierPaymentService', () => {
  let dataSource: DataSource;
  let service: SupplierPaymentService;
  let billService: PurchaseBillService;
  let tx: TestTransaction;

  const actor = () => ({ id: TEAMMATE_USER_ID, roleCode: null });
  const manager = () => ({ id: MANAGER_USER_ID, roleCode: 'manager' });

  const createDto = (overrides: Record<string, unknown> = {}) => ({
    partyId: SUPPLIER_PARTY_ID,
    paymentMethodId: PAYMENT_METHOD_ID,
    paymentAccountId: CASH_ACCOUNT_ID,
    allocations: [{ purchaseBillId: 'replace-me', allocatedAmount: 250 }],
    ...overrides,
  });

  async function postedBill() {
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
      inventoryLocationId: TEST_LOCATION_ID,
    });
  }

  async function journalFor(paymentId: string) {
    const entry = await dataSource.manager
      .getRepository(JournalEntryEntity)
      .findOneOrFail({
        where: { sourceType: 'supplier_payment', sourceId: paymentId },
        relations: { lines: true },
      });
    const byAccount = new Map(
      entry.lines.map((line) => [line.accountId, line]),
    );
    return { entry, byAccount };
  }

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    await seedSupplierPaymentBaseline(dataSource);
    const module = await createSupplierPaymentTestingModule(dataSource);
    service = module.get(SupplierPaymentService);
    billService = module.get(PurchaseBillService);
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
    it('creates a DRAFT payment with derived paid_amount and saved allocations', async () => {
      const billA = await postedBill();
      const billB = await postedBill();

      const payment = await service.create(
        TEST_ORG_ID,
        actor().id,
        createDto({
          allocations: [
            { purchaseBillId: billA.id, allocatedAmount: 150 },
            { purchaseBillId: billB.id, allocatedAmount: 100 },
          ],
          referenceNo: 'CHK-001',
          notes: 'partial settlement',
        }),
      );

      expect(payment.status).toBe('DRAFT');
      expect(payment.paymentNumber).toBeNull();
      expect(payment.partyId).toBe(SUPPLIER_PARTY_ID);
      expect(payment.paymentMethodId).toBe(PAYMENT_METHOD_ID);
      expect(payment.paymentAccountId).toBe(CASH_ACCOUNT_ID);
      expect(payment.paidAmount).toBe('250.00');
      expect(payment.referenceNo).toBe('CHK-001');
      expect(payment.allocations).toHaveLength(2);
      expect(
        payment.allocations.reduce(
          (sum, allocation) => sum + Number(allocation.allocatedAmount),
          0,
        ),
      ).toBe(250);
    });

    it('rejects a non-supplier party', async () => {
      await expect(
        service.create(
          TEST_ORG_ID,
          actor().id,
          createDto({ partyId: CUSTOMER_PARTY_ID }),
        ),
      ).rejects.toBeInstanceOf(SupplierPaymentSupplierNotFoundException);
    });

    it('rejects a draft bill', async () => {
      const draft = await billService.create(TEST_ORG_ID, manager().id, {
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
        service.create(
          TEST_ORG_ID,
          actor().id,
          createDto({
            allocations: [{ purchaseBillId: draft.id, allocatedAmount: 100 }],
          }),
        ),
      ).rejects.toBeInstanceOf(SupplierPaymentBillNotPostedException);
    });

    it('rejects a bill belonging to another supplier', async () => {
      const otherBill = await billService.create(TEST_ORG_ID, manager().id, {
        partyId: SECOND_SUPPLIER_PARTY_ID,
        lines: [
          {
            itemId: GOODS_ITEM_ID,
            uomId: BASE_UOM_ID,
            quantity: 1,
            unitPrice: 10,
          },
        ],
      });
      await billService.post(TEST_ORG_ID, manager().id, otherBill.id, {
        inventoryLocationId: TEST_LOCATION_ID,
      });

      await expect(
        service.create(
          TEST_ORG_ID,
          actor().id,
          createDto({
            allocations: [
              { purchaseBillId: otherBill.id, allocatedAmount: 10 },
            ],
          }),
        ),
      ).rejects.toBeInstanceOf(SupplierPaymentBillSupplierMismatchException);
    });

    it('rejects a non-positive allocation amount', async () => {
      const bill = await postedBill();

      await expect(
        service.create(
          TEST_ORG_ID,
          actor().id,
          createDto({
            allocations: [{ purchaseBillId: bill.id, allocatedAmount: 0 }],
          }),
        ),
      ).rejects.toBeInstanceOf(SupplierPaymentAllocationZeroException);
    });
  });

  describe('update', () => {
    it('recomputes paid_amount from the replacement allocations', async () => {
      const bill = await postedBill();
      const payment = await service.create(
        TEST_ORG_ID,
        actor().id,
        createDto({
          allocations: [{ purchaseBillId: bill.id, allocatedAmount: 250 }],
        }),
      );

      const updated = await service.update(
        TEST_ORG_ID,
        actor().id,
        payment.id,
        {
          allocations: [{ purchaseBillId: bill.id, allocatedAmount: 400 }],
          notes: 'increased',
        },
      );

      expect(updated.paidAmount).toBe('400.00');
      expect(updated.allocations).toHaveLength(1);
      expect(updated.allocations[0].allocatedAmount).toBe('400.00');
    });

    it('rejects updates to a posted payment', async () => {
      const bill = await postedBill();
      const payment = await service.create(
        TEST_ORG_ID,
        actor().id,
        createDto({
          allocations: [{ purchaseBillId: bill.id, allocatedAmount: 250 }],
        }),
      );
      await service.post(TEST_ORG_ID, manager().id, payment.id);

      await expect(
        service.update(TEST_ORG_ID, actor().id, payment.id, {
          notes: 'nope',
        }),
      ).rejects.toBeInstanceOf(SupplierPaymentNotDraftException);
    });
  });

  describe('post', () => {
    it('posts the payment, stamps the bill, and posts the AP journal', async () => {
      const bill = await postedBill();
      const payment = await service.create(
        TEST_ORG_ID,
        actor().id,
        createDto({
          allocations: [{ purchaseBillId: bill.id, allocatedAmount: 250 }],
        }),
      );

      const posted = await service.post(TEST_ORG_ID, manager().id, payment.id);

      expect(posted.status).toBe('POSTED');
      expect(posted.paymentNumber).toMatch(/^PMT-\d{6}$/);
      expect(posted.paymentDate).not.toBeNull();
      expect(posted.paymentDateBs).not.toBeNull();
      expect(posted.fiscalYearId).not.toBeNull();
      expect(posted.journalEntryId).not.toBeNull();

      const stamped = await dataSource.manager
        .getRepository(PurchaseBillEntity)
        .findOneByOrFail({ id: bill.id });
      expect(stamped.paidAmount).toBe('250.00');
      expect(stamped.balanceAmount).toBe('428.00');

      const { byAccount } = await journalFor(payment.id);
      expect(byAccount.get(AP_ACCOUNT_ID)?.partyId).toBe(SUPPLIER_PARTY_ID);
      expect(Number(byAccount.get(AP_ACCOUNT_ID)?.debitAmount)).toBe(250);
      expect(Number(byAccount.get(CASH_ACCOUNT_ID)?.creditAmount)).toBe(250);
    });

    it('supports settling one bill across multiple payments', async () => {
      const bill = await postedBill();
      const first = await service.create(
        TEST_ORG_ID,
        actor().id,
        createDto({
          allocations: [{ purchaseBillId: bill.id, allocatedAmount: 200 }],
        }),
      );
      const second = await service.create(
        TEST_ORG_ID,
        actor().id,
        createDto({
          allocations: [{ purchaseBillId: bill.id, allocatedAmount: 300 }],
        }),
      );

      await service.post(TEST_ORG_ID, manager().id, first.id);
      await service.post(TEST_ORG_ID, manager().id, second.id);

      const stamped = await dataSource.manager
        .getRepository(PurchaseBillEntity)
        .findOneByOrFail({ id: bill.id });
      expect(stamped.paidAmount).toBe('500.00');
      expect(stamped.balanceAmount).toBe('178.00');
    });

    it('rejects posting twice', async () => {
      const bill = await postedBill();
      const payment = await service.create(
        TEST_ORG_ID,
        actor().id,
        createDto({
          allocations: [{ purchaseBillId: bill.id, allocatedAmount: 250 }],
        }),
      );
      await service.post(TEST_ORG_ID, manager().id, payment.id);

      await expect(
        service.post(TEST_ORG_ID, manager().id, payment.id),
      ).rejects.toBeInstanceOf(SupplierPaymentNotDraftException);
    });

    it('re-validates the bill balance at POST time', async () => {
      const bill = await postedBill();
      const first = await service.create(
        TEST_ORG_ID,
        actor().id,
        createDto({
          allocations: [{ purchaseBillId: bill.id, allocatedAmount: 678 }],
        }),
      );
      await service.post(TEST_ORG_ID, manager().id, first.id);

      const second = await service.create(
        TEST_ORG_ID,
        actor().id,
        createDto({
          allocations: [{ purchaseBillId: bill.id, allocatedAmount: 10 }],
        }),
      );

      await expect(
        service.post(TEST_ORG_ID, manager().id, second.id),
      ).rejects.toBeInstanceOf(
        SupplierPaymentAllocationExceedsBalanceException,
      );
    });

    it('rejects a non-asset payment account', async () => {
      const bill = await postedBill();
      const payment = await service.create(
        TEST_ORG_ID,
        actor().id,
        createDto({
          paymentAccountId: AP_ACCOUNT_ID,
          allocations: [{ purchaseBillId: bill.id, allocatedAmount: 250 }],
        }),
      );

      await expect(
        service.post(TEST_ORG_ID, manager().id, payment.id),
      ).rejects.toBeInstanceOf(SupplierPaymentAccountTypeException);
    });
  });

  describe('void', () => {
    it('cancels a draft payment', async () => {
      const bill = await postedBill();
      const payment = await service.create(
        TEST_ORG_ID,
        actor().id,
        createDto({
          allocations: [{ purchaseBillId: bill.id, allocatedAmount: 250 }],
        }),
      );

      const voided = await service.voidPayment(
        TEST_ORG_ID,
        manager().id,
        payment.id,
      );

      expect(voided.status).toBe('CANCELLED');
      const stored = await dataSource.manager
        .getRepository(PurchaseBillEntity)
        .findOneByOrFail({ id: bill.id });
      expect(stored.paidAmount).toBe('0.00');
      expect(stored.balanceAmount).toBe('678.00');
    });

    it('rejects voiding a posted payment', async () => {
      const bill = await postedBill();
      const payment = await service.create(
        TEST_ORG_ID,
        actor().id,
        createDto({
          allocations: [{ purchaseBillId: bill.id, allocatedAmount: 250 }],
        }),
      );
      await service.post(TEST_ORG_ID, manager().id, payment.id);

      await expect(
        service.voidPayment(TEST_ORG_ID, manager().id, payment.id),
      ).rejects.toBeInstanceOf(SupplierPaymentNotDraftException);
    });
  });

  describe('reads', () => {
    it('returns 404 for an unknown payment', async () => {
      await expect(
        service.get(TEST_ORG_ID, '00000000-0000-4000-8000-000000000000'),
      ).rejects.toBeInstanceOf(SupplierPaymentNotFoundException);
    });

    it('lists payments', async () => {
      const bill = await postedBill();
      const payment = await service.create(
        TEST_ORG_ID,
        actor().id,
        createDto({
          allocations: [{ purchaseBillId: bill.id, allocatedAmount: 250 }],
        }),
      );
      await service.post(TEST_ORG_ID, manager().id, payment.id);

      const [rows, total] = await service.list(TEST_ORG_ID, {
        page: 1,
        limit: 10,
        status: 'POSTED',
        partyId: SUPPLIER_PARTY_ID,
      });
      expect(total).toBe(1);
      expect(rows[0].id).toBe(payment.id);
      expect(rows[0].status).toBe('POSTED');
    });
  });
});
