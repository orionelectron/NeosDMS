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
import { OrganizationUsageEntity } from '../subscription/entities/organization-usage.entity';
import { PlanEntity } from '../subscription/entities/plan.entity';
import { SubscriptionEntity } from '../subscription/entities/subscription.entity';
import { PlanLimitService } from '../subscription/plan-limits/plan-limit.service';
import { BranchEntity } from '../tenancy/entities/branch.entity';
import { OrganizationEntity } from '../tenancy/entities/organization.entity';
import { ItemEntity } from '../trading/entities/item.entity';
import { UomConversionEntity } from '../trading/entities/uom-conversion.entity';
import { UomEntity } from '../trading/entities/uom.entity';
import {
  seedPurchaseReceiptBaseline,
  SUPPLIER_PARTY_ID,
  TEST_ORG_ID,
} from './purchase-receipt-test.harness';
import { seedSalesOrderParties } from './sales-order-test.harness';
import { TEST_PLAN_ID } from './sales-invoice-test.harness';

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
} from './purchase-receipt-test.harness';
export type { TestTransaction } from './purchase-receipt-test.harness';
export {
  ACCOUNTANT_USER_ID,
  MANAGER_USER_ID,
  SALESMAN_USER_ID,
  TEAMMATE_USER_ID,
} from './hr-test.harness';
export {
  FISCAL_YEAR_ID,
  seedStockAtLocation,
  TEST_PLAN_ID,
} from './sales-invoice-test.harness';
export { seedSalesOrderParties, SUPPLIER_PARTY_ID };
export {
  DISCOUNT_ACCOUNT_ID,
  INVENTORY_ACCOUNT_ID,
  TDS_PAYABLE_ACCOUNT_ID,
  TDS_TAX_CODE_ID,
  VAT_TAX_CODE_ID,
} from './sales-invoice-test.harness';

export const AP_ACCOUNT_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee1b';
export const VAT_RECEIVABLE_ACCOUNT_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee1c';
export const DISCOUNT_RECEIVED_ACCOUNT_ID =
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee1d';
export const SECOND_SUPPLIER_PARTY_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee1e';
export const SECOND_LOCATION_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee1f';

/**
 * Extends the GRN baseline with the accounts the bill journal needs
 * (AP 2101, VAT Receivable 1105, Discounts Received 5104), a second godown
 * for location-mismatch tests, and the `purchase_bills_per_month` quota on
 * the test plan. Runs once in beforeAll — org-unique upserts.
 */
export async function seedPurchaseBillBaseline(
  dataSource: DataSource,
): Promise<void> {
  await seedPurchaseReceiptBaseline(dataSource);

  const manager = dataSource.manager;

  await manager.upsert(
    AccountEntity,
    [
      {
        id: AP_ACCOUNT_ID,
        organizationId: TEST_ORG_ID,
        parentAccountId: null,
        name: 'Accounts Payable',
        code: '2101',
        coaType: 'LIABILITY',
        isGroup: false,
        branchId: null,
        isSystemAccount: true,
        systemPurpose: 'ACCOUNTS_PAYABLE',
        isLocked: true,
        isActive: true,
        level: 3,
        path: '2000/2100/2101',
      },
      {
        id: VAT_RECEIVABLE_ACCOUNT_ID,
        organizationId: TEST_ORG_ID,
        parentAccountId: null,
        name: 'VAT Receivable',
        code: '1105',
        coaType: 'ASSET',
        isGroup: false,
        branchId: null,
        isSystemAccount: true,
        systemPurpose: 'TAX_RECEIVABLE',
        isLocked: true,
        isActive: true,
        level: 3,
        path: '1000/1100/1105',
      },
      {
        id: DISCOUNT_RECEIVED_ACCOUNT_ID,
        organizationId: TEST_ORG_ID,
        parentAccountId: null,
        name: 'Discounts Received',
        code: '5104',
        coaType: 'INCOME',
        isGroup: false,
        branchId: null,
        isSystemAccount: true,
        systemPurpose: 'DISCOUNT_RECEIVED',
        isLocked: true,
        isActive: true,
        level: 3,
        path: '5000/5104',
      },
    ],
    ['id'],
  );

  await manager.upsert(
    InventoryLocationEntity,
    {
      id: SECOND_LOCATION_ID,
      organizationId: TEST_ORG_ID,
      branchId: null,
      name: 'Test Godown 2',
      code: 'SO-GD2',
      locationType: 'GODOWN',
      address: null,
      notes: null,
      isDefault: false,
      isActive: true,
    },
    ['id'],
  );

  await manager.upsert(
    PlanEntity,
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
}

/**
 * Upserts the second supplier party. Call INSIDE the test transaction (after
 * `beginTestTransaction`) alongside `seedSalesOrderParties`.
 */
export async function seedSecondSupplier(
  dataSource: DataSource,
): Promise<void> {
  await dataSource.manager.upsert(
    PartyEntity,
    {
      id: SECOND_SUPPLIER_PARTY_ID,
      organizationId: TEST_ORG_ID,
      branchId: null,
      currencyId: null,
      paymentTermId: null,
      name: 'Other Supplier Co',
      legalName: null,
      partyKind: 'BUSINESS',
      isCustomer: false,
      isSupplier: true,
      isLead: false,
      panNumber: null,
      vatNumber: null,
      email: null,
      phone: null,
      address: null,
      creditLimit: '0',
      openingBalance: '0',
      isActive: true,
    },
    ['id'],
  );
}

export async function createPurchaseBillTestingModule(
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
      DocumentSequenceService,
      JournalService,
      InventoryService,
      PlanLimitService,
      PurchaseReceiptService,
      PurchaseBillService,
    ],
  }).compile();
}
