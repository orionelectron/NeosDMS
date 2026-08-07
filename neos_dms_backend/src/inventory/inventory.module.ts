import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentSequenceEntity } from '../accounting/entities/document-sequence.entity';
import { DocumentSequenceService } from '../accounting/document-sequence.service';
import { AuditModule } from '../audit/audit.module';
import { NepaliDateModule } from '../nepali-date/nepali-date.module';
import { ItemEntity } from '../trading/entities/item.entity';
import { UomConversionEntity } from '../trading/entities/uom-conversion.entity';
import { UomEntity } from '../trading/entities/uom.entity';
import { InventoryBalanceEntity } from './entities/inventory-balance.entity';
import { InventoryLocationEntity } from './entities/inventory-location.entity';
import { InventoryTransactionLineEntity } from './entities/inventory-transaction-line.entity';
import { InventoryTransactionEntity } from './entities/inventory-transaction.entity';
import { InventoryController } from './inventory.controller';
import { InventoryLocationController } from './inventory-location.controller';
import { InventoryLocationService } from './inventory-location.service';
import { InventoryService } from './inventory.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryLocationEntity,
      InventoryTransactionEntity,
      InventoryTransactionLineEntity,
      InventoryBalanceEntity,
      ItemEntity,
      UomEntity,
      UomConversionEntity,
      DocumentSequenceEntity,
    ]),
    AuditModule,
    NepaliDateModule,
  ],
  controllers: [InventoryLocationController, InventoryController],
  providers: [
    InventoryLocationService,
    InventoryService,
    DocumentSequenceService,
  ],
  exports: [InventoryService],
})
export class InventoryModule {}
