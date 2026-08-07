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
import { PurchaseReturnLineEntity } from '../purchase/entities/purchase-return-line.entity';
import { PurchaseReturnEntity } from '../purchase/entities/purchase-return.entity';
import { PurchaseReturnService } from '../purchase/purchase-return.service';
import { OrganizationUsageEntity } from '../subscription/entities/organization-usage.entity';
import { SubscriptionEntity } from '../subscription/entities/subscription.entity';
import { PlanLimitService } from '../subscription/plan-limits/plan-limit.service';
import { BranchEntity } from '../tenancy/entities/branch.entity';
import { OrganizationEntity } from '../tenancy/entities/organization.entity';
import { ItemEntity } from '../trading/entities/item.entity';
import { UomConversionEntity } from '../trading/entities/uom-conversion.entity';
import { UomEntity } from '../trading/entities/uom.entity';
import { seedPurchaseBillBaseline } from './purchase-bill-test.harness';

export { seedPurchaseBillBaseline };
export {
  AP_ACCOUNT_ID,
  BASE_UOM_ID,
  beginTestTransaction,
  BOX_UOM_ID,
  CASE_UOM_ID,
  CUSTOMER_PARTY_ID,
  DISCOUNT_RECEIVED_ACCOUNT_ID,
  endTestTransaction,
  FISCAL_YEAR_ID,
  GOODS_ITEM_ID,
  INVENTORY_ACCOUNT_ID,
  MANAGER_USER_ID,
  NON_CUSTOMER_PARTY_ID,
  SALESMAN_USER_ID,
  SECOND_LOCATION_ID,
  SECOND_SUPPLIER_PARTY_ID,
  seedSalesOrderParties,
  seedSecondSupplier,
  seedStockAtLocation,
  SERVICE_ITEM_ID,
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

/**
 * The return slice reuses the bill baseline (AP 2101, VAT Receivable 1105,
 * Discounts Received 5104, Inventory 1104, TDS Payable 2103 accounts are all
 * present) — returns post the mirror journal against those same accounts.
 */
export async function seedPurchaseReturnBaseline(
  dataSource: DataSource,
): Promise<void> {
  await seedPurchaseBillBaseline(dataSource);
}

export async function createPurchaseReturnTestingModule(
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
      repo(TaxCodeEntity),
      repo(JournalEntryEntity),
      repo(PurchaseReceiptEntity),
      repo(PurchaseReceiptLineEntity),
      repo(PurchaseBillEntity),
      repo(PurchaseBillLineEntity),
      repo(PurchaseReturnEntity),
      repo(PurchaseReturnLineEntity),
      DocumentSequenceService,
      JournalService,
      InventoryService,
      PlanLimitService,
      PurchaseReceiptService,
      PurchaseBillService,
      PurchaseReturnService,
    ],
  }).compile();
}
