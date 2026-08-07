import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentSequenceEntity } from '../accounting/entities/document-sequence.entity';
import { DocumentSequenceService } from '../accounting/document-sequence.service';
import { PartyEntity } from '../accounting/entities/party.entity';
import { AuditModule } from '../audit/audit.module';
import { UserEntity } from '../iam/entities/user.entity';
import { InventoryBalanceEntity } from '../inventory/entities/inventory-balance.entity';
import { NepaliDateModule } from '../nepali-date/nepali-date.module';
import { ItemEntity } from '../trading/entities/item.entity';
import { UomConversionEntity } from '../trading/entities/uom-conversion.entity';
import { UomEntity } from '../trading/entities/uom.entity';
import { SalesOrderLineEntity } from './entities/sales-order-line.entity';
import { SalesOrderEntity } from './entities/sales-order.entity';
import { SalesOrderController } from './sales-order.controller';
import { SalesOrderService } from './sales-order.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SalesOrderEntity,
      SalesOrderLineEntity,
      PartyEntity,
      UserEntity,
      ItemEntity,
      UomEntity,
      UomConversionEntity,
      InventoryBalanceEntity,
      DocumentSequenceEntity,
    ]),
    AuditModule,
    NepaliDateModule,
  ],
  controllers: [SalesOrderController],
  providers: [SalesOrderService, DocumentSequenceService],
})
export class SalesModule {}
