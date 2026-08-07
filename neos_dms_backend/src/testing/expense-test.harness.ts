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
import { NepaliDateConverter } from '../nepali-date/nepali-date-converter';
import { ExpenseLineEntity } from '../purchase/entities/expense-line.entity';
import { ExpenseEntity } from '../purchase/entities/expense.entity';
import { ExpenseService } from '../purchase/expense.service';
import { BranchEntity } from '../tenancy/entities/branch.entity';
import { OrganizationEntity } from '../tenancy/entities/organization.entity';
import {
  seedSupplierPaymentBaseline,
  CASH_ACCOUNT_ID,
  PAYMENT_METHOD_ID,
} from './supplier-payment-test.harness';
import { TEST_ORG_ID } from './purchase-bill-test.harness';

export { seedSupplierPaymentBaseline };
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
export { CASH_ACCOUNT_ID, PAYMENT_METHOD_ID };
export type { TestTransaction } from './purchase-bill-test.harness';
export {
  EXEMPT_TAX_CODE_ID,
  seedStockAtLocation,
} from './sales-invoice-test.harness';

/** Direct EXPENSE coaType accounts the expense lines charge (journal DR legs). */
export const TRAVEL_ACCOUNT_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee26';
export const SUPPLIES_ACCOUNT_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee27';

/**
 * Extends the payment baseline (org/branch/fiscal year, purpose accounts,
 * tax codes, plan/subscription, Cash account, payment method) with two
 * direct EXPENSE accounts for the line DR legs. Runs once in beforeAll —
 * org-unique upserts.
 */
export async function seedExpenseBaseline(
  dataSource: DataSource,
): Promise<void> {
  await seedSupplierPaymentBaseline(dataSource);

  const manager = dataSource.manager;
  await manager.upsert(
    AccountEntity,
    [
      {
        id: TRAVEL_ACCOUNT_ID,
        organizationId: TEST_ORG_ID,
        parentAccountId: null,
        name: 'Travel & Conveyance',
        code: '7101',
        coaType: 'EXPENSE',
        isGroup: false,
        branchId: null,
        isSystemAccount: false,
        systemPurpose: null,
        isLocked: false,
        isActive: true,
        level: 3,
        path: '7000/7101',
      },
      {
        id: SUPPLIES_ACCOUNT_ID,
        organizationId: TEST_ORG_ID,
        parentAccountId: null,
        name: 'Office Supplies',
        code: '7102',
        coaType: 'EXPENSE',
        isGroup: false,
        branchId: null,
        isSystemAccount: false,
        systemPurpose: null,
        isLocked: false,
        isActive: true,
        level: 3,
        path: '7000/7102',
      },
    ],
    ['id'],
  );
}

export async function createExpenseTestingModule(
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
      repo(AccountEntity),
      repo(TaxCodeEntity),
      repo(PaymentMethodEntity),
      repo(JournalEntryEntity),
      repo(DocumentSequenceEntity),
      repo(OrganizationEntity),
      repo(FiscalYearEntity),
      repo(BranchEntity),
      repo(ExpenseEntity),
      repo(ExpenseLineEntity),
      DocumentSequenceService,
      JournalService,
      ExpenseService,
    ],
  }).compile();
}
