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
import { PurchaseBillLineEntity } from './entities/purchase-bill-line.entity';
import { PurchaseBillEntity } from './entities/purchase-bill.entity';
import { PurchaseReceiptLineEntity } from './entities/purchase-receipt-line.entity';
import { PurchaseReceiptEntity } from './entities/purchase-receipt.entity';
import { PurchaseReturnLineEntity } from './entities/purchase-return-line.entity';
import { PurchaseReturnEntity } from './entities/purchase-return.entity';
import { PurchaseBillController } from './purchase-bill.controller';
import { PurchaseBillService } from './purchase-bill.service';
import { PurchaseReceiptController } from './purchase-receipt.controller';
import { PurchaseReceiptService } from './purchase-receipt.service';
import { PurchaseReturnController } from './purchase-return.controller';
import { PurchaseReturnService } from './purchase-return.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PurchaseReceiptEntity,
      PurchaseReceiptLineEntity,
      PurchaseBillEntity,
      PurchaseBillLineEntity,
      PurchaseReturnEntity,
      PurchaseReturnLineEntity,
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
  controllers: [
    PurchaseReceiptController,
    PurchaseBillController,
    PurchaseReturnController,
  ],
  providers: [
    PurchaseReceiptService,
    PurchaseBillService,
    PurchaseReturnService,
    DocumentSequenceService,
  ],
})
export class PurchaseModule {}
