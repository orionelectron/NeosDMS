import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AccountEntity } from '../accounting/entities/account.entity';
import { DocumentSequenceEntity } from '../accounting/entities/document-sequence.entity';
import { DocumentSequenceService } from '../accounting/document-sequence.service';
import { FiscalYearEntity } from '../accounting/entities/fiscal-year.entity';
import { JournalEntryEntity } from '../accounting/entities/journal-entry.entity';
import { JournalService } from '../accounting/journal.service';
import { PartyEntity } from '../accounting/entities/party.entity';
import { PaymentMethodEntity } from '../accounting/entities/payment-method.entity';
import { TaxCodeEntity } from '../accounting/entities/tax-code.entity';
import { AuditLogEntity } from '../audit/audit-log.entity';
import { AuditService } from '../audit/audit.service';
import { InventoryBalanceEntity } from '../inventory/entities/inventory-balance.entity';
import { InventoryLocationEntity } from '../inventory/entities/inventory-location.entity';
import { InventoryTransactionLineEntity } from '../inventory/entities/inventory-transaction-line.entity';
import { InventoryTransactionEntity } from '../inventory/entities/inventory-transaction.entity';
import { InventoryService } from '../inventory/inventory.service';
import { NepaliDateConverter } from '../nepali-date/nepali-date-converter';
import { PurchaseBillLineEntity } from '../purchase/entities/purchase-bill-line.entity';
import { PurchaseBillEntity } from '../purchase/entities/purchase-bill.entity';
import { PurchaseBillService } from '../purchase/purchase-bill.service';
import { PurchaseReceiptLineEntity } from '../purchase/entities/purchase-receipt-line.entity';
import { PurchaseReceiptEntity } from '../purchase/entities/purchase-receipt.entity';
import { PurchaseReceiptService } from '../purchase/purchase-receipt.service';
import { SupplierPaymentBillAllocationEntity } from '../purchase/entities/supplier-payment-bill-allocation.entity';
import { SupplierPaymentEntity } from '../purchase/entities/supplier-payment.entity';
import { SupplierPaymentService } from '../purchase/supplier-payment.service';
import { OrganizationUsageEntity } from '../subscription/entities/organization-usage.entity';
import { SubscriptionEntity } from '../subscription/entities/subscription.entity';
import { PlanLimitService } from '../subscription/plan-limits/plan-limit.service';
import { BranchEntity } from '../tenancy/entities/branch.entity';
import { OrganizationEntity } from '../tenancy/entities/organization.entity';
import { ItemEntity } from '../trading/entities/item.entity';
import { UomConversionEntity } from '../trading/entities/uom-conversion.entity';
import { UomEntity } from '../trading/entities/uom.entity';
import {
  seedPurchaseBillBaseline,
  TEST_ORG_ID,
} from './purchase-bill-test.harness';

export { seedPurchaseBillBaseline };
export {
  AP_ACCOUNT_ID,
  BASE_UOM_ID,
  beginTestTransaction,
  CUSTOMER_PARTY_ID,
  endTestTransaction,
  FISCAL_YEAR_ID,
  GOODS_ITEM_ID,
  MANAGER_USER_ID,
  SALESMAN_USER_ID,
  SECOND_LOCATION_ID,
  SECOND_SUPPLIER_PARTY_ID,
  seedSalesOrderParties,
  seedSecondSupplier,
  SUPPLIER_PARTY_ID,
  TDS_PAYABLE_ACCOUNT_ID,
  TDS_TAX_CODE_ID,
  TEAMMATE_USER_ID,
  TEST_BRANCH_ID,
  TEST_LOCATION_ID,
  TEST_ORG_ID,
  TEST_PLAN_ID,
  VAT_RECEIVABLE_ACCOUNT_ID,
  VAT_TAX_CODE_ID,
} from './purchase-bill-test.harness';
export type { TestTransaction } from './purchase-bill-test.harness';

export const CASH_ACCOUNT_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee20';
export const PAYMENT_METHOD_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee21';

/**
 * Extends the bill baseline (AP 2101, Inventory 1104, VAT Receivable 1105,
 * TDS Payable 2103) with the payment slice's own rows: a Cash account the
 * money leaves (CR side of the payment journal) and a default payment method.
 * Runs once in beforeAll — org-unique upserts.
 */
export async function seedSupplierPaymentBaseline(
  dataSource: DataSource,
): Promise<void> {
  await seedPurchaseBillBaseline(dataSource);

  const manager = dataSource.manager;

  await manager.upsert(
    AccountEntity,
    {
      id: CASH_ACCOUNT_ID,
      organizationId: TEST_ORG_ID,
      parentAccountId: null,
      name: 'Cash',
      code: '1101',
      coaType: 'ASSET',
      isGroup: false,
      branchId: null,
      isSystemAccount: true,
      systemPurpose: 'CASH',
      isLocked: true,
      isActive: true,
      level: 3,
      path: '1000/1100/1101',
    },
    ['id'],
  );

  await manager.upsert(
    PaymentMethodEntity,
    {
      id: PAYMENT_METHOD_ID,
      organizationId: TEST_ORG_ID,
      linkedAccountId: null,
      name: 'Cash',
      methodType: 'CASH',
      isActive: true,
    },
    ['id'],
  );
}

export async function createSupplierPaymentTestingModule(
  dataSource: DataSource,
): Promise<TestingModule> {
  const repo = (entity: unknown) => ({
    provide: getRepositoryToken(entity as new () => object),
    useFactory: (ds: DataSource) =>
      ds.getRepository(entity as new () => object),
    inject: [getDataSourceToken()],
  });

  return Test.createTestingModule({
    providers: [
      NepaliDateConverter,
      AuditService,
      repo(AuditLogEntity),
      { provide: getDataSourceToken(), useValue: dataSource },
      repo(PartyEntity),
      repo(ItemEntity),
      repo(UomEntity),
      repo(UomConversionEntity),
      repo(DocumentSequenceEntity),
      repo(InventoryBalanceEntity),
      repo(InventoryLocationEntity),
      repo(OrganizationEntity),
      repo(FiscalYearEntity),
      repo(BranchEntity),
      repo(SubscriptionEntity),
      repo(OrganizationUsageEntity),
      repo(InventoryTransactionEntity),
      repo(InventoryTransactionLineEntity),
      repo(AccountEntity),
      repo(PaymentMethodEntity),
      repo(TaxCodeEntity),
      repo(JournalEntryEntity),
      repo(PurchaseReceiptEntity),
      repo(PurchaseReceiptLineEntity),
      repo(PurchaseBillEntity),
      repo(PurchaseBillLineEntity),
      repo(SupplierPaymentEntity),
      repo(SupplierPaymentBillAllocationEntity),
      DocumentSequenceService,
      JournalService,
      InventoryService,
      PlanLimitService,
      PurchaseReceiptService,
      PurchaseBillService,
      SupplierPaymentService,
    ],
  }).compile();
}
