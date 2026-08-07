import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DocumentSequenceEntity } from '../accounting/entities/document-sequence.entity';
import { DocumentSequenceService } from '../accounting/document-sequence.service';
import { FiscalYearEntity } from '../accounting/entities/fiscal-year.entity';
import { PartyEntity } from '../accounting/entities/party.entity';
import { AuditLogEntity } from '../audit/audit-log.entity';
import { AuditService } from '../audit/audit.service';
import { UserEntity } from '../iam/entities/user.entity';
import { InventoryBalanceEntity } from '../inventory/entities/inventory-balance.entity';
import { InventoryLocationEntity } from '../inventory/entities/inventory-location.entity';
import { InventoryTransactionLineEntity } from '../inventory/entities/inventory-transaction-line.entity';
import { InventoryTransactionEntity } from '../inventory/entities/inventory-transaction.entity';
import { InventoryService } from '../inventory/inventory.service';
import { NepaliDateConverter } from '../nepali-date/nepali-date-converter';
import { PurchaseReceiptLineEntity } from '../purchase/entities/purchase-receipt-line.entity';
import { PurchaseReceiptEntity } from '../purchase/entities/purchase-receipt.entity';
import { PurchaseReceiptService } from '../purchase/purchase-receipt.service';
import { OrganizationUsageEntity } from '../subscription/entities/organization-usage.entity';
import { SubscriptionEntity } from '../subscription/entities/subscription.entity';
import { PlanLimitService } from '../subscription/plan-limits/plan-limit.service';
import { BranchEntity } from '../tenancy/entities/branch.entity';
import { OrganizationEntity } from '../tenancy/entities/organization.entity';
import { ItemEntity } from '../trading/entities/item.entity';
import { UomConversionEntity } from '../trading/entities/uom-conversion.entity';
import { UomEntity } from '../trading/entities/uom.entity';
import {
  beginTestTransaction,
  BASE_UOM_ID,
  BOX_UOM_ID,
  CASE_UOM_ID,
  CUSTOMER_PARTY_ID,
  endTestTransaction,
  GOODS_ITEM_ID,
  NON_CUSTOMER_PARTY_ID,
  seedSalesOrderParties,
  SERVICE_ITEM_ID,
  TEST_BRANCH_ID,
  TEST_LOCATION_ID,
  TEST_ORG_ID,
  type TestTransaction,
} from './sales-order-test.harness';
import { seedSalesInvoiceBaseline } from './sales-invoice-test.harness';

export {
  BASE_UOM_ID,
  beginTestTransaction,
  BOX_UOM_ID,
  CASE_UOM_ID,
  CUSTOMER_PARTY_ID,
  endTestTransaction,
  GOODS_ITEM_ID,
  NON_CUSTOMER_PARTY_ID,
  SERVICE_ITEM_ID,
  TEST_BRANCH_ID,
  TEST_LOCATION_ID,
  TEST_ORG_ID,
};
export type { TestTransaction };
export { seedSalesOrderParties };
export {
  ACCOUNTANT_USER_ID,
  MANAGER_USER_ID,
  SALESMAN_USER_ID,
  seedHrBaseline,
  TEAMMATE_USER_ID,
} from './hr-test.harness';
export {
  FISCAL_YEAR_ID,
  TEST_BILLING_PERIOD_ID,
  TEST_PLAN_ID,
  TEST_SUBSCRIPTION_ID,
} from './sales-invoice-test.harness';

export const SUPPLIER_PARTY_ID = NON_CUSTOMER_PARTY_ID;
export const NON_SUPPLIER_PARTY_ID = CUSTOMER_PARTY_ID;

/**
 * Seeds the org-scoped baseline the GRN create/post paths need: org/branch,
 * items/uoms/conversions/location, an open fiscal year covering today, and the
 * active plan subscription (plan carries the `purchase_receipts_per_month`
 * quota). Runs once in beforeAll — all rows are org-unique upserts. The
 * supplier parties are seeded per-test inside the transaction via
 * `seedSalesOrderParties`.
 */
export async function seedPurchaseReceiptBaseline(
  dataSource: DataSource,
): Promise<void> {
  await seedSalesInvoiceBaseline(dataSource);
}

export async function createPurchaseReceiptTestingModule(
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
      repo(UserEntity),
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
      repo(PurchaseReceiptEntity),
      repo(PurchaseReceiptLineEntity),
      DocumentSequenceService,
      AuditService,
      InventoryService,
      PlanLimitService,
      PurchaseReceiptService,
    ],
  }).compile();
}
