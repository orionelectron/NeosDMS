import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountingModule } from '../accounting/accounting.module';
import { FiscalYearEntity } from '../accounting/entities/fiscal-year.entity';
import { AuditModule } from '../audit/audit.module';
import { RouteEntity } from '../field/entities/route.entity';
import { UserEntity } from '../iam/entities/user.entity';
import { InventoryBalanceEntity } from '../inventory/entities/inventory-balance.entity';
import { InventoryLocationEntity } from '../inventory/entities/inventory-location.entity';
import { InventoryModule } from '../inventory/inventory.module';
import { SalesOrderLineEntity } from '../sales/entities/sales-order-line.entity';
import { SalesOrderEntity } from '../sales/entities/sales-order.entity';
import { SalesInvoiceLineEntity } from '../sales/entities/sales-invoice-line.entity';
import { SalesModule } from '../sales/sales.module';
import { BranchEntity } from '../tenancy/entities/branch.entity';
import { ItemEntity } from '../trading/entities/item.entity';
import { UomConversionEntity } from '../trading/entities/uom-conversion.entity';
import { UomEntity } from '../trading/entities/uom.entity';
import { DispatchController } from './dispatch.controller';
import { DispatchService } from './dispatch.service';
import { DispatchStopLineEntity } from './entities/dispatch-stop-line.entity';
import { DispatchStopEntity } from './entities/dispatch-stop.entity';
import { DispatchEntity } from './entities/dispatch.entity';
import { VehicleEntity } from './entities/vehicle.entity';
import { VehicleController } from './vehicle.controller';
import { VehicleService } from './vehicle.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      VehicleEntity,
      DispatchEntity,
      DispatchStopEntity,
      DispatchStopLineEntity,
      UserEntity,
      RouteEntity,
      BranchEntity,
      InventoryLocationEntity,
      InventoryBalanceEntity,
      FiscalYearEntity,
      SalesOrderEntity,
      SalesOrderLineEntity,
      SalesInvoiceLineEntity,
      ItemEntity,
      UomEntity,
      UomConversionEntity,
    ]),
    AuditModule,
    AccountingModule,
    InventoryModule,
    SalesModule,
  ],
  controllers: [VehicleController, DispatchController],
  providers: [VehicleService, DispatchService],
  exports: [VehicleService, DispatchService],
})
export class DispatchModule {}
