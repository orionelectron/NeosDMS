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
import { AuditLogEntity } from '../audit/audit-log.entity';
import { AuditService } from '../audit/audit.service';
import { RouteEntity } from '../field/entities/route.entity';
import { UserEntity } from '../iam/entities/user.entity';
import { InventoryBalanceEntity } from '../inventory/entities/inventory-balance.entity';
import { InventoryLocationEntity } from '../inventory/entities/inventory-location.entity';
import { InventoryTransactionLineEntity } from '../inventory/entities/inventory-transaction-line.entity';
import { InventoryTransactionEntity } from '../inventory/entities/inventory-transaction.entity';
import { InventoryService } from '../inventory/inventory.service';
import { NepaliDateConverter } from '../nepali-date/nepali-date-converter';
import { SalesInvoiceService } from '../sales/sales-invoice.service';
import { SalesReturnService } from '../sales/sales-return.service';
import { SalesOrderService } from '../sales/sales-order.service';
import { OrganizationUsageEntity } from '../subscription/entities/organization-usage.entity';
import { SubscriptionEntity } from '../subscription/entities/subscription.entity';
import { PlanLimitService } from '../subscription/plan-limits/plan-limit.service';
import { BranchEntity } from '../tenancy/entities/branch.entity';
import { OrganizationEntity } from '../tenancy/entities/organization.entity';
import { ItemEntity } from '../trading/entities/item.entity';
import { UomConversionEntity } from '../trading/entities/uom-conversion.entity';
import { UomEntity } from '../trading/entities/uom.entity';
import { JournalService } from '../accounting/journal.service';
import { CBMS_INVOICE_CLIENT } from '../sales/cbms/cbms-invoice.client';
import { NoopCbmsInvoiceClient } from '../sales/cbms/cbms-noop.client';
import { SalesInvoiceLineEntity } from '../sales/entities/sales-invoice-line.entity';
import { SalesInvoiceEntity } from '../sales/entities/sales-invoice.entity';
import { SalesOrderLineEntity } from '../sales/entities/sales-order-line.entity';
import { SalesOrderEntity } from '../sales/entities/sales-order.entity';
import { SalesReturnLineEntity } from '../sales/entities/sales-return-line.entity';
import { SalesReturnEntity } from '../sales/entities/sales-return.entity';
import { DispatchService } from '../dispatch/dispatch.service';
import { DispatchStopLineEntity } from '../dispatch/entities/dispatch-stop-line.entity';
import { DispatchStopEntity } from '../dispatch/entities/dispatch-stop.entity';
import { DispatchEntity } from '../dispatch/entities/dispatch.entity';
import { VehicleEntity } from '../dispatch/entities/vehicle.entity';
import { VehicleService } from '../dispatch/vehicle.service';
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
  TEST_BRANCH_ID,
  TEST_ORG_ID,
};
export type { TestTransaction };
export {
  ACCOUNTANT_USER_ID,
  MANAGER_USER_ID,
  SALESMAN_USER_ID,
  TEAMMATE_USER_ID,
  seedHrBaseline,
} from './hr-test.harness';
export {
  seedSalesInvoiceBaseline,
  seedSalesOrderParties,
  seedStockAtLocation,
} from './sales-invoice-test.harness';
export {
  BASE_UOM_ID,
  BOX_UOM_ID,
  CUSTOMER_PARTY_ID,
  GOODS_ITEM_ID,
  TEST_LOCATION_ID,
} from './sales-invoice-test.harness';
export const DRIVER_USER_ID = '44444444-4444-4444-8444-444444444444';

export const VEHICLE_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee20';
export const VEHICLE_2_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee21';

export {
  FISCAL_YEAR_ID,
  VAT_TAX_CODE_ID,
  EXEMPT_TAX_CODE_ID,
  AR_ACCOUNT_ID,
  SALES_ACCOUNT_ID,
  DISCOUNT_ACCOUNT_ID,
  VAT_PAYABLE_ACCOUNT_ID,
  INVENTORY_ACCOUNT_ID,
  COGS_ACCOUNT_ID,
} from './sales-invoice-test.harness';

export async function seedDispatchBaseline(
  dataSource: DataSource,
): Promise<void> {
  await seedBaseline(dataSource);
  const manager = dataSource.manager;

  await manager.upsert(
    VehicleEntity,
    [
      {
        id: VEHICLE_ID,
        organizationId: TEST_ORG_ID,
        name: 'Tata 407',
        registrationNumber: 'BA 1 KHA 1234',
        vehicleType: 'truck',
        capacityWeightKg: '2000.000',
        capacityVolumeCbm: null,
        isActive: true,
        currentDriverId: null,
      },
      {
        id: VEHICLE_2_ID,
        organizationId: TEST_ORG_ID,
        name: 'Scooter',
        registrationNumber: 'BA 1 JA 5678',
        vehicleType: 'motorbike',
        capacityWeightKg: '50.000',
        capacityVolumeCbm: null,
        isActive: true,
        currentDriverId: null,
      },
    ],
    ['id'],
  );
}

/** Upserts an active route for route-filtered dispatches. */
export async function seedDispatchRoute(
  dataSource: DataSource,
): Promise<string> {
  const id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee22';
  await dataSource.manager.upsert(
    RouteEntity,
    {
      id,
      organizationId: TEST_ORG_ID,
      name: 'Kathmandu Ring Road',
      code: 'KTM-RR',
      description: null,
      province: null,
      district: null,
      status: 'ACTIVE',
    },
    ['id'],
  );
  return id;
}

export async function createDispatchTestingModule(
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
      repo(TaxCodeEntity),
      repo(AccountEntity),
      repo(OrganizationEntity),
      repo(FiscalYearEntity),
      repo(FiscalPeriodEntity),
      repo(BranchEntity),
      repo(JournalEntryEntity),
      repo(InventoryTransactionEntity),
      repo(InventoryTransactionLineEntity),
      repo(SubscriptionEntity),
      repo(OrganizationUsageEntity),
      repo(VehicleEntity),
      repo(DispatchEntity),
      repo(DispatchStopEntity),
      repo(DispatchStopLineEntity),
      repo(RouteEntity),
      DocumentSequenceService,
      JournalService,
      InventoryService,
      PlanLimitService,
      SalesOrderService,
      SalesInvoiceService,
      SalesReturnService,
      VehicleService,
      DispatchService,
      { provide: CBMS_INVOICE_CLIENT, useClass: NoopCbmsInvoiceClient },
    ],
  }).compile();
}
