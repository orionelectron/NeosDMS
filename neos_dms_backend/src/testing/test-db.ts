import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { AccountingEngine1786070270761 } from '../database/migrations/1786070270761-AccountingEngine';
import { FixFiscalYearShrawanBasis1786080000000 } from '../database/migrations/1786080000000-FixFiscalYearShrawanBasis';
import { DmsFieldSales1786091000000 } from '../database/migrations/1786091000000-DmsFieldSales';
import { HrLeave1786100000000 } from '../database/migrations/1786100000000-HrLeave';
import { HrTravel1786200000000 } from '../database/migrations/1786200000000-HrTravel';
import { HrAttendance1786300000000 } from '../database/migrations/1786300000000-HrAttendance';
import { Inventory1786500000000 } from '../database/migrations/1786500000000-Inventory';
import { MovingAverageCost1786900000000 } from '../database/migrations/1786900000000-MovingAverageCost';
import { SalesInvoice1786700000000 } from '../database/migrations/1786700000000-SalesInvoice';
import { SalesOrder1786600000000 } from '../database/migrations/1786600000000-SalesOrder';
import { SalesTarget1786400000000 } from '../database/migrations/1786400000000-SalesTarget';
import { TradingMasters1786090000000 } from '../database/migrations/1786090000000-TradingMasters';
import { IamAndAuth1786035687494 } from '../database/migrations/1786035687494-IamAndAuth';
import { JournalEntrySourceUniqueness1786081000000 } from '../database/migrations/1786081000000-JournalEntrySourceUniqueness';
import { PurchaseReceipt1786800000000 } from '../database/migrations/1786800000000-PurchaseReceipt';
import { TaxCodeUniqueness1786072881892 } from '../database/migrations/1786072881892-TaxCodeUniqueness';
import { TenantAndSubscription1786033873511 } from '../database/migrations/1786033873511-tenant-and-subscription';

/**
 * Disposable PostgreSQL for jest integration tests (TestingHandBook §3.2/§3.3).
 * Run it with the `db-test` compose service on port 5433:
 *
 *   docker compose up -d db-test
 */
export const TEST_DB_OPTIONS: DataSourceOptions = {
  type: 'postgres',
  host: process.env.TEST_DB_HOST ?? 'localhost',
  port: Number(process.env.TEST_DB_PORT ?? 5433),
  username: process.env.TEST_DB_USER ?? 'neos',
  password: process.env.TEST_DB_PASSWORD ?? 'neos',
  database: process.env.TEST_DB_NAME ?? 'neos_dms_test',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [
    TenantAndSubscription1786033873511,
    IamAndAuth1786035687494,
    AccountingEngine1786070270761,
    TaxCodeUniqueness1786072881892,
    FixFiscalYearShrawanBasis1786080000000,
    JournalEntrySourceUniqueness1786081000000,
    TradingMasters1786090000000,
    DmsFieldSales1786091000000,
    HrLeave1786100000000,
    HrTravel1786200000000,
    HrAttendance1786300000000,
    SalesTarget1786400000000,
    Inventory1786500000000,
    SalesOrder1786600000000,
    SalesInvoice1786700000000,
    PurchaseReceipt1786800000000,
    MovingAverageCost1786900000000,
  ],
  synchronize: false,
  logging: false,
};

export async function createTestDataSource(): Promise<DataSource> {
  const dataSource = new DataSource(TEST_DB_OPTIONS);
  await dataSource.initialize();
  await dataSource.runMigrations();
  return dataSource;
}
