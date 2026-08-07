import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountingModule } from '../accounting/accounting.module';
import { DocumentSequenceEntity } from '../accounting/entities/document-sequence.entity';
import { DocumentSequenceService } from '../accounting/document-sequence.service';
import { FiscalYearEntity } from '../accounting/entities/fiscal-year.entity';
import { PartyEntity } from '../accounting/entities/party.entity';
import { AuditModule } from '../audit/audit.module';
import { InventoryLocationEntity } from '../inventory/entities/inventory-location.entity';
import { InventoryModule } from '../inventory/inventory.module';
import { NepaliDateModule } from '../nepali-date/nepali-date.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { ItemEntity } from '../trading/entities/item.entity';
import { UomConversionEntity } from '../trading/entities/uom-conversion.entity';
import { UomEntity } from '../trading/entities/uom.entity';
import { PurchaseReceiptLineEntity } from './entities/purchase-receipt-line.entity';
import { PurchaseReceiptEntity } from './entities/purchase-receipt.entity';
import { PurchaseReceiptController } from './purchase-receipt.controller';
import { PurchaseReceiptService } from './purchase-receipt.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PurchaseReceiptEntity,
      PurchaseReceiptLineEntity,
      PartyEntity,
      FiscalYearEntity,
      InventoryLocationEntity,
      ItemEntity,
      UomEntity,
      UomConversionEntity,
      DocumentSequenceEntity,
    ]),
    AuditModule,
    NepaliDateModule,
    AccountingModule,
    InventoryModule,
    SubscriptionModule,
  ],
  controllers: [PurchaseReceiptController],
  providers: [PurchaseReceiptService, DocumentSequenceService],
})
export class PurchaseModule {}
