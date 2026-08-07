import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DocumentSequenceEntity } from '../accounting/entities/document-sequence.entity';
import { DocumentSequenceService } from '../accounting/document-sequence.service';
import { AuditLogEntity } from '../audit/audit-log.entity';
import { AuditService } from '../audit/audit.service';
import { UserEntity } from '../iam/entities/user.entity';
import { InventoryBalanceEntity } from '../inventory/entities/inventory-balance.entity';
import { InventoryLocationEntity } from '../inventory/entities/inventory-location.entity';
import { InventoryTransactionLineEntity } from '../inventory/entities/inventory-transaction-line.entity';
import { InventoryTransactionEntity } from '../inventory/entities/inventory-transaction.entity';
import { InventoryLocationService } from '../inventory/inventory-location.service';
import { InventoryService } from '../inventory/inventory.service';
import { NepaliDateConverter } from '../nepali-date/nepali-date-converter';
import { ItemEntity } from '../trading/entities/item.entity';
import { UomConversionEntity } from '../trading/entities/uom-conversion.entity';
import { UomEntity } from '../trading/entities/uom.entity';
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
export type { TestTransaction };
export const SALESMAN_USER_ID = '33333333-3333-4333-8333-333333333333';

export const BASE_UOM_ID = '99999999-9999-4999-8999-999999999901';
export const BOX_UOM_ID = '99999999-9999-4999-8999-999999999902';
export const GOODS_ITEM_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01';
export const SERVICE_ITEM_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02';
export const NEGATIVE_OK_ITEM_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03';
export const ZERO_REORDER_ITEM_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa04';

export async function seedInventoryBaseline(
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
        shortName: 'unit',
        isActive: true,
      },
      {
        id: BOX_UOM_ID,
        organizationId: TEST_ORG_ID,
        name: 'Box',
        shortName: 'box',
        isActive: true,
      },
    ],
    ['id'],
  );

  const tracked = {
    id: GOODS_ITEM_ID,
    organizationId: TEST_ORG_ID,
    name: 'Goods Item',
    code: 'GDS',
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
    mrp: '0',
    salePrice: '0',
    standardCost: '0',
    reorderLevel: 10,
    inventoryTracking: 'QUANTITY',
    trackExpiry: false,
    allowNegativeStock: false,
    isActive: true,
    salesAccountId: null,
    purchaseAccountId: null,
    salesReturnAccountId: null,
    purchaseReturnAccountId: null,
  } as const;
  await manager.upsert(
    ItemEntity,
    [
      tracked,
      {
        ...tracked,
        id: SERVICE_ITEM_ID,
        name: 'Service Item',
        code: 'SRV',
        type: 'SERVICE',
        inventoryTracking: 'NONE',
      },
      {
        ...tracked,
        id: NEGATIVE_OK_ITEM_ID,
        name: 'Negative-OK Item',
        code: 'NEG',
        allowNegativeStock: true,
      },
      {
        ...tracked,
        id: ZERO_REORDER_ITEM_ID,
        name: 'Zero-Reorder Item',
        code: 'ZR',
        reorderLevel: 0,
      },
    ],
    ['id'],
  );

  await manager.upsert(
    UomConversionEntity,
    [
      {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01',
        organizationId: TEST_ORG_ID,
        itemId: null,
        fromUomId: BOX_UOM_ID,
        toUomId: BASE_UOM_ID,
        conversionFactor: '12',
      },
    ],
    ['id'],
  );
}

export async function createInventoryTestingModule(
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
      repo(ItemEntity),
      repo(UomEntity),
      repo(UomConversionEntity),
      repo(DocumentSequenceEntity),
      repo(InventoryLocationEntity),
      repo(InventoryTransactionEntity),
      repo(InventoryTransactionLineEntity),
      repo(InventoryBalanceEntity),
      DocumentSequenceService,
      InventoryLocationService,
      InventoryService,
    ],
  }).compile();
}
