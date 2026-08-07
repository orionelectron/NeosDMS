import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountEntity } from '../accounting/entities/account.entity';
import { DocumentSequenceEntity } from '../accounting/entities/document-sequence.entity';
import { DocumentSequenceService } from '../accounting/document-sequence.service';
import { FiscalYearEntity } from '../accounting/entities/fiscal-year.entity';
import { PartyEntity } from '../accounting/entities/party.entity';
import { PaymentMethodEntity } from '../accounting/entities/payment-method.entity';
import { PaymentTermEntity } from '../accounting/entities/payment-term.entity';
import { TaxCodeEntity } from '../accounting/entities/tax-code.entity';
import { AccountingModule } from '../accounting/accounting.module';
import { AuditModule } from '../audit/audit.module';
import { UserEntity } from '../iam/entities/user.entity';
import { InventoryModule } from '../inventory/inventory.module';
import { InventoryBalanceEntity } from '../inventory/entities/inventory-balance.entity';
import { InventoryLocationEntity } from '../inventory/entities/inventory-location.entity';
import { NepaliDateModule } from '../nepali-date/nepali-date.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { OrganizationEntity } from '../tenancy/entities/organization.entity';
import { ItemEntity } from '../trading/entities/item.entity';
import { UomConversionEntity } from '../trading/entities/uom-conversion.entity';
import { UomEntity } from '../trading/entities/uom.entity';
import { CBMS_INVOICE_CLIENT } from './cbms/cbms-invoice.client';
import { NoopCbmsInvoiceClient } from './cbms/cbms-noop.client';
import { IrdCbmsInvoiceClient } from './cbms/cbms-ird.client';
import { CustomerReceiptAllocationEntity } from './entities/customer-receipt-allocation.entity';
import { CustomerReceiptEntity } from './entities/customer-receipt.entity';
import { SalesInvoiceLineEntity } from './entities/sales-invoice-line.entity';
import { SalesInvoiceEntity } from './entities/sales-invoice.entity';
import { SalesOrderLineEntity } from './entities/sales-order-line.entity';
import { SalesOrderEntity } from './entities/sales-order.entity';
import { SalesReturnLineEntity } from './entities/sales-return-line.entity';
import { SalesReturnEntity } from './entities/sales-return.entity';
import { CustomerReceiptController } from './customer-receipt.controller';
import { CustomerReceiptService } from './customer-receipt.service';
import { SalesInvoiceController } from './sales-invoice.controller';
import { SalesInvoiceService } from './sales-invoice.service';
import { SalesOrderController } from './sales-order.controller';
import { SalesOrderService } from './sales-order.service';
import { SalesReturnController } from './sales-return.controller';
import { SalesReturnService } from './sales-return.service';

/**
 * CBMS provider selection: the no-op client is active until IRD approval +
 * org credentials exist. Flip to IrdCbmsInvoiceClient behind an env flag.
 */
const CbmsClientProvider = {
  provide: CBMS_INVOICE_CLIENT,
  useClass:
    process.env.CBMS_ENABLED === 'true'
      ? IrdCbmsInvoiceClient
      : NoopCbmsInvoiceClient,
};

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SalesOrderEntity,
      SalesOrderLineEntity,
      SalesInvoiceEntity,
      SalesInvoiceLineEntity,
      SalesReturnEntity,
      SalesReturnLineEntity,
      CustomerReceiptEntity,
      CustomerReceiptAllocationEntity,
      PartyEntity,
      UserEntity,
      ItemEntity,
      UomEntity,
      UomConversionEntity,
      InventoryBalanceEntity,
      InventoryLocationEntity,
      TaxCodeEntity,
      AccountEntity,
      OrganizationEntity,
      FiscalYearEntity,
      PaymentTermEntity,
      PaymentMethodEntity,
      DocumentSequenceEntity,
    ]),
    AuditModule,
    NepaliDateModule,
    AccountingModule,
    InventoryModule,
    SubscriptionModule,
  ],
  controllers: [
    SalesOrderController,
    SalesInvoiceController,
    SalesReturnController,
    CustomerReceiptController,
  ],
  providers: [
    SalesOrderService,
    SalesInvoiceService,
    SalesReturnService,
    CustomerReceiptService,
    DocumentSequenceService,
    CbmsClientProvider,
  ],
})
export class SalesModule {}
