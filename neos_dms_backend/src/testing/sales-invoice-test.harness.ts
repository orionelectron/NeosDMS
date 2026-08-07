import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AccountEntity } from '../accounting/entities/account.entity';
import { DocumentSequenceEntity } from '../accounting/entities/document-sequence.entity';
import { DocumentSequenceService } from '../accounting/document-sequence.service';
import { FiscalPeriodEntity } from '../accounting/entities/fiscal-period.entity';
import { FiscalYearEntity } from '../accounting/entities/fiscal-year.entity';
import { JournalEntryEntity } from '../accounting/entities/journal-entry.entity';
import { PartyEntity } from '../accounting/entities/party.entity';
import { TaxCodeEntity } from '../accounting/entities/tax-code.entity';
import { TaxTypeEntity } from '../accounting/entities/tax-type.entity';
import { AuditLogEntity } from '../audit/audit-log.entity';
import { AuditService } from '../audit/audit.service';
import { UserEntity } from '../iam/entities/user.entity';
import { InventoryBalanceEntity } from '../inventory/entities/inventory-balance.entity';
import { InventoryLocationEntity } from '../inventory/entities/inventory-location.entity';
import { InventoryTransactionLineEntity } from '../inventory/entities/inventory-transaction-line.entity';
import { InventoryTransactionEntity } from '../inventory/entities/inventory-transaction.entity';
import { InventoryService } from '../inventory/inventory.service';
import { NepaliDateConverter } from '../nepali-date/nepali-date-converter';
import { BillingPeriodEntity } from '../subscription/entities/billing-period.entity';
import { OrganizationUsageEntity } from '../subscription/entities/organization-usage.entity';
import { PlanEntity } from '../subscription/entities/plan.entity';
import { SubscriptionEntity } from '../subscription/entities/subscription.entity';
import { PlanLimitService } from '../subscription/plan-limits/plan-limit.service';
import { BranchEntity } from '../tenancy/entities/branch.entity';
import { OrganizationEntity } from '../tenancy/entities/organization.entity';
import { JournalService } from '../accounting/journal.service';
import { CBMS_INVOICE_CLIENT } from '../sales/cbms/cbms-invoice.client';
import { NoopCbmsInvoiceClient } from '../sales/cbms/cbms-noop.client';
import { SalesInvoiceLineEntity } from '../sales/entities/sales-invoice-line.entity';
import { SalesInvoiceEntity } from '../sales/entities/sales-invoice.entity';
import { SalesOrderLineEntity } from '../sales/entities/sales-order-line.entity';
import { SalesOrderEntity } from '../sales/entities/sales-order.entity';
import { SalesInvoiceService } from '../sales/sales-invoice.service';
import { SalesOrderService } from '../sales/sales-order.service';
import { ItemEntity } from '../trading/entities/item.entity';
import { UomConversionEntity } from '../trading/entities/uom-conversion.entity';
import { UomEntity } from '../trading/entities/uom.entity';
import {
  BASE_UOM_ID,
  beginTestTransaction,
  BOX_UOM_ID,
  CUSTOMER_PARTY_ID,
  endTestTransaction,
  GOODS_ITEM_ID,
  seedSalesOrderBaseline,
  TEST_BRANCH_ID,
  TEST_LOCATION_ID,
  TEST_ORG_ID,
  type TestTransaction,
} from './sales-order-test.harness';
import { seedBaseline } from './field-test.harness';

export {
  BASE_UOM_ID,
  beginTestTransaction,
  BOX_UOM_ID,
  CUSTOMER_PARTY_ID,
  endTestTransaction,
  GOODS_ITEM_ID,
  TEST_BRANCH_ID,
  TEST_LOCATION_ID,
  TEST_ORG_ID,
};
export type { TestTransaction };
export {
  ACCOUNTANT_USER_ID,
  MANAGER_USER_ID,
  SALESMAN_USER_ID,
  seedHrBaseline,
  TEAMMATE_USER_ID,
} from './hr-test.harness';
export { seedSalesOrderParties } from './sales-order-test.harness';

export const FISCAL_YEAR_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee0a';
export const FISCAL_PERIOD_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee0b';
export const AR_ACCOUNT_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee0c';
export const SALES_ACCOUNT_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee0d';
export const DISCOUNT_ACCOUNT_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee0e';
export const VAT_PAYABLE_ACCOUNT_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee0f';
export const TAX_TYPE_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee10';
export const VAT_TAX_CODE_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee11';
export const EXEMPT_TAX_CODE_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee12';
export const TEST_PLAN_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee13';
export const TEST_BILLING_PERIOD_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee14';
export const TEST_SUBSCRIPTION_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee15';
export const COGS_ACCOUNT_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee16';
export const INVENTORY_ACCOUNT_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee17';
export const TDS_PAYABLE_ACCOUNT_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee18';
export const TDS_TAX_TYPE_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee19';
export const TDS_TAX_CODE_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee1a';

/**
 * Seeds the org-scoped accounting/subscription/tax rows the invoice POST path
 * needs (fiscal year + period, purpose accounts, tax codes, active plan
 * subscription). Runs once in beforeAll — the rows are org-unique upserts.
 */
export async function seedSalesInvoiceBaseline(
  dataSource: DataSource,
): Promise<void> {
  await seedBaseline(dataSource);
  await seedSalesOrderBaseline(dataSource);

  const manager = dataSource.manager;

  await manager.upsert(
    FiscalYearEntity,
    {
      id: FISCAL_YEAR_ID,
      organizationId: TEST_ORG_ID,
      name: '2083/84',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2030-12-31'),
      isActive: true,
      isClosed: false,
      closedAt: null,
      closedBy: null,
    },
    ['id'],
  );

  await manager.upsert(
    FiscalPeriodEntity,
    {
      id: FISCAL_PERIOD_ID,
      fiscalYearId: FISCAL_YEAR_ID,
      name: 'Test Period',
      sequence: 1,
      startDateBs: '2083-01-01',
      endDateBs: '2083-12-31',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2030-12-31'),
      isLocked: false,
      lockedAt: null,
      lockedBy: null,
    },
    ['id'],
  );

  await manager.upsert(
    AccountEntity,
    [
      {
        id: AR_ACCOUNT_ID,
        organizationId: TEST_ORG_ID,
        parentAccountId: null,
        name: 'Accounts Receivable',
        code: '1103',
        coaType: 'ASSET',
        isGroup: false,
        branchId: null,
        isSystemAccount: true,
        systemPurpose: 'ACCOUNTS_RECEIVABLE',
        isLocked: true,
        isActive: true,
        level: 3,
        path: '1000/1100/1103',
      },
      {
        id: SALES_ACCOUNT_ID,
        organizationId: TEST_ORG_ID,
        parentAccountId: null,
        name: 'Sales Revenue',
        code: '4101',
        coaType: 'INCOME',
        isGroup: false,
        branchId: null,
        isSystemAccount: true,
        systemPurpose: 'SALES',
        isLocked: true,
        isActive: true,
        level: 3,
        path: '4000/4100/4101',
      },
      {
        id: DISCOUNT_ACCOUNT_ID,
        organizationId: TEST_ORG_ID,
        parentAccountId: null,
        name: 'Sales Discounts',
        code: '4102',
        coaType: 'INCOME',
        isGroup: false,
        branchId: null,
        isSystemAccount: true,
        systemPurpose: 'DISCOUNT_ALLOWED',
        isLocked: true,
        isActive: true,
        level: 3,
        path: '4000/4100/4102',
      },
      {
        id: VAT_PAYABLE_ACCOUNT_ID,
        organizationId: TEST_ORG_ID,
        parentAccountId: null,
        name: 'VAT Payable',
        code: '2102',
        coaType: 'LIABILITY',
        isGroup: false,
        branchId: null,
        isSystemAccount: true,
        systemPurpose: 'TAX_PAYABLE',
        isLocked: true,
        isActive: true,
        level: 3,
        path: '2000/2100/2102',
      },
      {
        id: INVENTORY_ACCOUNT_ID,
        organizationId: TEST_ORG_ID,
        parentAccountId: null,
        name: 'Inventory',
        code: '1104',
        coaType: 'ASSET',
        isGroup: false,
        branchId: null,
        isSystemAccount: true,
        systemPurpose: 'INVENTORY',
        isLocked: true,
        isActive: true,
        level: 3,
        path: '1000/1100/1104',
      },
      {
        id: COGS_ACCOUNT_ID,
        organizationId: TEST_ORG_ID,
        parentAccountId: null,
        name: 'Cost of Goods Sold',
        code: '5101',
        coaType: 'EXPENSE',
        isGroup: false,
        branchId: null,
        isSystemAccount: true,
        systemPurpose: 'COST_OF_GOODS_SOLD',
        isLocked: true,
        isActive: true,
        level: 3,
        path: '5000/5101',
      },
      {
        id: TDS_PAYABLE_ACCOUNT_ID,
        organizationId: TEST_ORG_ID,
        parentAccountId: null,
        name: 'TDS Payable',
        code: '2103',
        coaType: 'LIABILITY',
        isGroup: false,
        branchId: null,
        isSystemAccount: true,
        systemPurpose: 'TDS_PAYABLE',
        isLocked: true,
        isActive: true,
        level: 3,
        path: '2000/2100/2103',
      },
    ],
    ['id'],
  );

  await manager.upsert(
    TaxTypeEntity,
    [
      {
        id: TAX_TYPE_ID,
        name: 'VAT',
        description: null,
        mathSign: 1,
        isSystem: true,
      },
      {
        id: TDS_TAX_TYPE_ID,
        name: 'TDS',
        description: null,
        mathSign: -1,
        isSystem: true,
      },
    ],
    ['id'],
  );

  await manager.upsert(
    TaxCodeEntity,
    [
      {
        id: VAT_TAX_CODE_ID,
        organizationId: TEST_ORG_ID,
        taxTypeId: TAX_TYPE_ID,
        accountId: VAT_PAYABLE_ACCOUNT_ID,
        name: 'VAT 13% (Output)',
        irdCategory: 'TAXABLE',
        rate: '13.0000',
        effectiveFrom: new Date('2024-01-01'),
        effectiveTo: null,
        isLocked: true,
        isActive: true,
      },
      {
        id: EXEMPT_TAX_CODE_ID,
        organizationId: TEST_ORG_ID,
        taxTypeId: TAX_TYPE_ID,
        accountId: null,
        name: 'Exempt',
        irdCategory: 'EXEMPT',
        rate: '0.0000',
        effectiveFrom: new Date('2024-01-01'),
        effectiveTo: null,
        isLocked: true,
        isActive: true,
      },
      {
        id: TDS_TAX_CODE_ID,
        organizationId: TEST_ORG_ID,
        taxTypeId: TDS_TAX_TYPE_ID,
        accountId: TDS_PAYABLE_ACCOUNT_ID,
        name: 'TDS 1.5% (Services)',
        irdCategory: 'TDS_WITHHOLDING',
        rate: '1.5000',
        effectiveFrom: new Date('2024-01-01'),
        effectiveTo: null,
        isLocked: true,
        isActive: true,
      },
    ],
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
      limits: { invoices_per_month: 1000, purchase_receipts_per_month: 1000 },
    },
    ['id'],
  );

  await manager.upsert(
    BillingPeriodEntity,
    {
      id: TEST_BILLING_PERIOD_ID,
      name: 'Monthly',
      durationDays: 30,
    },
    ['id'],
  );

  await manager.upsert(
    SubscriptionEntity,
    {
      id: TEST_SUBSCRIPTION_ID,
      organizationId: TEST_ORG_ID,
      planId: TEST_PLAN_ID,
      billingPeriodId: TEST_BILLING_PERIOD_ID,
      amount: '0.00',
      currency: 'NPR',
      status: 'active',
      trialEndDate: null,
      currentPeriodStart: new Date('2026-01-01'),
      currentPeriodEnd: new Date('2026-12-31'),
      autoRenew: false,
      canceledAt: null,
      gracePeriodEnd: null,
    },
    ['id'],
  );
}

/** Seed opening stock inside the test transaction before posting invoices. */
export async function seedStockAtLocation(
  dataSource: DataSource,
  itemId: string,
  quantity: number,
  locationId: string = TEST_LOCATION_ID,
  avgCost: number = 0,
): Promise<void> {
  const repo = dataSource.manager.getRepository(InventoryBalanceEntity);
  const existing = await repo.findOne({
    where: { organizationId: TEST_ORG_ID, locationId, itemId },
  });
  if (existing) {
    existing.quantity = quantity.toFixed(3);
    existing.avgCost = avgCost.toFixed(2);
    await repo.save(existing);
  } else {
    await repo.save(
      repo.create({
        organizationId: TEST_ORG_ID,
        locationId,
        itemId,
        quantity: quantity.toFixed(3),
        avgCost: avgCost.toFixed(2),
      }),
    );
  }
}

export async function createSalesInvoiceTestingModule(
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
      repo(SalesOrderEntity),
      repo(SalesOrderLineEntity),
      repo(SalesInvoiceEntity),
      repo(SalesInvoiceLineEntity),
      repo(TaxCodeEntity),
      repo(AccountEntity),
      repo(OrganizationEntity),
      repo(FiscalYearEntity),
      repo(BranchEntity),
      repo(JournalEntryEntity),
      repo(InventoryTransactionEntity),
      repo(InventoryTransactionLineEntity),
      repo(SubscriptionEntity),
      repo(OrganizationUsageEntity),
      DocumentSequenceService,
      AuditService,
      JournalService,
      InventoryService,
      PlanLimitService,
      SalesOrderService,
      { provide: CBMS_INVOICE_CLIENT, useClass: NoopCbmsInvoiceClient },
      SalesInvoiceService,
    ],
  }).compile();
}
