import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AccountEntity } from '../accounting/entities/account.entity';
import { DocumentSequenceEntity } from '../accounting/entities/document-sequence.entity';
import { DocumentSequenceService } from '../accounting/document-sequence.service';
import { FiscalYearEntity } from '../accounting/entities/fiscal-year.entity';
import { JournalEntryEntity } from '../accounting/entities/journal-entry.entity';
import { PartyEntity } from '../accounting/entities/party.entity';
import { PaymentMethodEntity } from '../accounting/entities/payment-method.entity';
import { TaxCodeEntity } from '../accounting/entities/tax-code.entity';
import { AuditLogEntity } from '../audit/audit-log.entity';
import { AuditService } from '../audit/audit.service';
import { UserEntity } from '../iam/entities/user.entity';
import { InventoryBalanceEntity } from '../inventory/entities/inventory-balance.entity';
import { InventoryLocationEntity } from '../inventory/entities/inventory-location.entity';
import { InventoryTransactionLineEntity } from '../inventory/entities/inventory-transaction-line.entity';
import { InventoryTransactionEntity } from '../inventory/entities/inventory-transaction.entity';
import { InventoryService } from '../inventory/inventory.service';
import { NepaliDateConverter } from '../nepali-date/nepali-date-converter';
import { OrganizationUsageEntity } from '../subscription/entities/organization-usage.entity';
import { SubscriptionEntity } from '../subscription/entities/subscription.entity';
import { PlanLimitService } from '../subscription/plan-limits/plan-limit.service';
import { BranchEntity } from '../tenancy/entities/branch.entity';
import { OrganizationEntity } from '../tenancy/entities/organization.entity';
import { JournalService } from '../accounting/journal.service';
import { CBMS_INVOICE_CLIENT } from '../sales/cbms/cbms-invoice.client';
import { NoopCbmsInvoiceClient } from '../sales/cbms/cbms-noop.client';
import { CustomerReceiptAllocationEntity } from '../sales/entities/customer-receipt-allocation.entity';
import { CustomerReceiptEntity } from '../sales/entities/customer-receipt.entity';
import { SalesInvoiceLineEntity } from '../sales/entities/sales-invoice-line.entity';
import { SalesInvoiceEntity } from '../sales/entities/sales-invoice.entity';
import { SalesOrderLineEntity } from '../sales/entities/sales-order-line.entity';
import { SalesOrderEntity } from '../sales/entities/sales-order.entity';
import { SalesReturnLineEntity } from '../sales/entities/sales-return-line.entity';
import { SalesReturnEntity } from '../sales/entities/sales-return.entity';
import { CustomerReceiptService } from '../sales/customer-receipt.service';
import { SalesInvoiceService } from '../sales/sales-invoice.service';
import { SalesOrderService } from '../sales/sales-order.service';
import { SalesReturnService } from '../sales/sales-return.service';
import { ItemEntity } from '../trading/entities/item.entity';
import { UomConversionEntity } from '../trading/entities/uom-conversion.entity';
import { UomEntity } from '../trading/entities/uom.entity';
import {
  seedSalesInvoiceBaseline,
  seedSalesOrderParties,
} from './sales-invoice-test.harness';
import {
  CASH_ACCOUNT_ID,
  PAYMENT_METHOD_ID,
} from './supplier-payment-test.harness';
import {
  beginTestTransaction,
  endTestTransaction,
  seedBaseline,
  TEST_BRANCH_ID,
  TEST_ORG_ID,
  type TestTransaction,
} from './field-test.harness';

export {
  beginTestTransaction,
  endTestTransaction,
  seedBaseline,
  TEST_BRANCH_ID,
  TEST_ORG_ID,
};
export { CASH_ACCOUNT_ID, PAYMENT_METHOD_ID };
export type { TestTransaction };
export {
  ACCOUNTANT_USER_ID,
  MANAGER_USER_ID,
  SALESMAN_USER_ID,
  seedHrBaseline,
  TEAMMATE_USER_ID,
} from './hr-test.harness';
export {
  AR_ACCOUNT_ID,
  BASE_UOM_ID,
  COGS_ACCOUNT_ID,
  CUSTOMER_PARTY_ID,
  DISCOUNT_ACCOUNT_ID,
  EXEMPT_TAX_CODE_ID,
  FISCAL_PERIOD_ID,
  FISCAL_YEAR_ID,
  GOODS_ITEM_ID,
  INVENTORY_ACCOUNT_ID,
  SALES_ACCOUNT_ID,
  seedSalesOrderParties,
  seedStockAtLocation,
  TDS_TAX_CODE_ID,
  TEST_LOCATION_ID,
  VAT_PAYABLE_ACCOUNT_ID,
  VAT_TAX_CODE_ID,
} from './sales-invoice-test.harness';

/** Cash — the customer receipt's DR side (money-in). */
export const SECOND_CUSTOMER_PARTY_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee24';

/**
 * Seeds the customer/supplier parties plus a second active customer (for
 * mismatch tests) INSIDE the test transaction (after `beginTestTransaction`)
 * so no rows leak into the shared test DB.
 */
export async function seedSalesReturnParties(
  dataSource: DataSource,
): Promise<void> {
  await seedSalesOrderParties(dataSource);
  await dataSource.manager.upsert(
    PartyEntity,
    {
      id: SECOND_CUSTOMER_PARTY_ID,
      organizationId: TEST_ORG_ID,
      branchId: null,
      currencyId: null,
      paymentTermId: null,
      name: 'Other Store',
      legalName: null,
      partyKind: 'BUSINESS',
      isCustomer: true,
      isSupplier: false,
      isLead: false,
      panNumber: null,
      vatNumber: null,
      email: null,
      phone: '555-9999',
      address: null,
      creditLimit: '0',
      openingBalance: '0',
      isActive: true,
    },
    ['id'],
  );
}

/**
 * Extends the invoice baseline (fiscal year, purpose accounts, tax codes,
 * plan/subscription) with the receipt slice's own rows: a Cash account and a
 * default payment method. Runs once in beforeAll — org-unique upserts.
 */
export async function seedSalesReturnBaseline(
  dataSource: DataSource,
): Promise<void> {
  await seedSalesInvoiceBaseline(dataSource);

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

export async function createSalesReturnTestingModule(
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
      repo(SalesReturnEntity),
      repo(SalesReturnLineEntity),
      repo(CustomerReceiptEntity),
      repo(CustomerReceiptAllocationEntity),
      repo(TaxCodeEntity),
      repo(AccountEntity),
      repo(OrganizationEntity),
      repo(FiscalYearEntity),
      repo(BranchEntity),
      repo(JournalEntryEntity),
      repo(PaymentMethodEntity),
      repo(InventoryTransactionEntity),
      repo(InventoryTransactionLineEntity),
      repo(SubscriptionEntity),
      repo(OrganizationUsageEntity),
      DocumentSequenceService,
      JournalService,
      InventoryService,
      PlanLimitService,
      SalesOrderService,
      { provide: CBMS_INVOICE_CLIENT, useClass: NoopCbmsInvoiceClient },
      SalesInvoiceService,
      SalesReturnService,
      CustomerReceiptService,
    ],
  }).compile();
}
