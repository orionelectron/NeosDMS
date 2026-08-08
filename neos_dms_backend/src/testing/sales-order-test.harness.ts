import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DocumentSequenceEntity } from '../accounting/entities/document-sequence.entity';
import { DocumentSequenceService } from '../accounting/document-sequence.service';
import { PartyEntity } from '../accounting/entities/party.entity';
import { AuditLogEntity } from '../audit/audit-log.entity';
import { AuditService } from '../audit/audit.service';
import { UserEntity } from '../iam/entities/user.entity';
import { InventoryBalanceEntity } from '../inventory/entities/inventory-balance.entity';
import { InventoryLocationEntity } from '../inventory/entities/inventory-location.entity';
import { NepaliDateConverter } from '../nepali-date/nepali-date-converter';
import { SalesOrderLineEntity } from '../sales/entities/sales-order-line.entity';
import { SalesOrderEntity } from '../sales/entities/sales-order.entity';
import { SalesOrderService } from '../sales/sales-order.service';
import { ItemEntity } from '../trading/entities/item.entity';
import { UomConversionEntity } from '../trading/entities/uom-conversion.entity';
import { UomEntity } from '../trading/entities/uom.entity';
import {
  beginTestTransaction,
  endTestTransaction,
  SALESMAN_USER_ID,
  seedBaseline,
  TEST_BRANCH_ID,
  TEST_ORG_ID,
  type TestTransaction,
} from './field-test.harness';

export {
  beginTestTransaction,
  endTestTransaction,
  SALESMAN_USER_ID,
  TEST_BRANCH_ID,
  TEST_ORG_ID,
};
export type { TestTransaction };
export {
  ACCOUNTANT_USER_ID,
  MANAGER_USER_ID,
  TEAMMATE_USER_ID,
  seedHrBaseline,
} from './hr-test.harness';

export const BASE_UOM_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01';
export const BOX_UOM_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee02';
export const CASE_UOM_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee03';
export const GOODS_ITEM_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee04';
export const SERVICE_ITEM_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee05';
export const CUSTOMER_PARTY_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee06';
export const NON_CUSTOMER_PARTY_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee07';
export const TEST_LOCATION_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee08';

export async function seedSalesOrderBaseline(
  dataSource: DataSource,
): Promise<void> {
  await seedBaseline(dataSource);
  const manager = dataSource.manager;

  await manager.upsert(
    UomEntity,
    [
      {
        id: BASE_UOM_ID,
        organizationId: TEST_ORG_ID,
        name: 'Unit',
        shortName: 's-unit',
        isActive: true,
      },
      {
        id: BOX_UOM_ID,
        organizationId: TEST_ORG_ID,
        name: 'Box',
        shortName: 's-box',
        isActive: true,
      },
      {
        id: CASE_UOM_ID,
        organizationId: TEST_ORG_ID,
        name: 'Case',
        shortName: 's-case',
        isActive: true,
      },
    ],
    ['id'],
  );

  await manager.upsert(
    ItemEntity,
    [
      {
        id: GOODS_ITEM_ID,
        organizationId: TEST_ORG_ID,
        name: 'Cold Drink',
        code: 'SO-GDS',
        sku: null,
        barcode: null,
        description: null,
        type: 'GOODS',
        categoryId: null,
        brandId: null,
        baseUomId: BASE_UOM_ID,
        hsnCode: null,
        valuationMethod: 'FIFO',
        taxCodeId: null,
        mrp: '120',
        rlp: '100',
        standardCost: '60',
        reorderLevel: 10,
        inventoryTracking: 'QUANTITY',
        trackExpiry: false,
        allowNegativeStock: false,
        isActive: true,
        salesAccountId: null,
        purchaseAccountId: null,
        salesReturnAccountId: null,
        purchaseReturnAccountId: null,
      },
      {
        id: SERVICE_ITEM_ID,
        organizationId: TEST_ORG_ID,
        name: 'Delivery Charge',
        code: 'SO-SRV',
        sku: null,
        barcode: null,
        description: null,
        type: 'SERVICE',
        categoryId: null,
        brandId: null,
        baseUomId: BASE_UOM_ID,
        hsnCode: null,
        valuationMethod: 'FIFO',
        taxCodeId: null,
        mrp: '0',
        rlp: '50',
        standardCost: '0',
        reorderLevel: 0,
        inventoryTracking: 'NONE',
        trackExpiry: false,
        allowNegativeStock: false,
        isActive: true,
        salesAccountId: null,
        purchaseAccountId: null,
        salesReturnAccountId: null,
        purchaseReturnAccountId: null,
      },
    ],
    ['id'],
  );

  await manager.upsert(
    UomConversionEntity,
    [
      {
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee09',
        organizationId: TEST_ORG_ID,
        itemId: null,
        fromUomId: BOX_UOM_ID,
        toUomId: BASE_UOM_ID,
        conversionFactor: '12',
      },
    ],
    ['id'],
  );

  await manager.upsert(
    InventoryLocationEntity,
    {
      id: TEST_LOCATION_ID,
      organizationId: TEST_ORG_ID,
      branchId: null,
      name: 'Test Godown',
      code: 'SO-GD1',
      locationType: 'GODOWN',
      address: null,
      notes: null,
      isDefault: false,
      isActive: true,
    },
    ['id'],
  );
}

/**
 * Upserts the customer/supplier parties. Call this INSIDE the test transaction
 * (after `beginTestTransaction`) so no rows are committed to the shared test
 * DB — the field suites assert on global party counts.
 */
export async function seedSalesOrderParties(
  dataSource: DataSource,
): Promise<void> {
  await dataSource.manager.upsert(
    PartyEntity,
    [
      {
        id: CUSTOMER_PARTY_ID,
        organizationId: TEST_ORG_ID,
        branchId: null,
        currencyId: null,
        paymentTermId: null,
        name: 'Corner Store',
        legalName: null,
        partyKind: 'BUSINESS',
        isCustomer: true,
        isSupplier: false,
        isLead: false,
        panNumber: null,
        vatNumber: null,
        email: null,
        phone: '555-1234',
        address: null,
        creditLimit: '0',
        openingBalance: '0',
        isActive: true,
      },
      {
        id: NON_CUSTOMER_PARTY_ID,
        organizationId: TEST_ORG_ID,
        branchId: null,
        currencyId: null,
        paymentTermId: null,
        name: 'Supplier Co',
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
    ],
    ['id'],
  );
}

export async function createSalesOrderTestingModule(
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
      DocumentSequenceService,
      SalesOrderService,
    ],
  }).compile();
}
