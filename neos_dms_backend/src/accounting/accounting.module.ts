import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { NepaliDateModule } from '../nepali-date/nepali-date.module';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { DocumentSequenceController } from './document-sequence.controller';
import { DocumentSequenceService } from './document-sequence.service';
import { AccountEntity } from './entities/account.entity';
import { CurrencyEntity } from './entities/currency.entity';
import { DocumentSequenceEntity } from './entities/document-sequence.entity';
import { FiscalPeriodEntity } from './entities/fiscal-period.entity';
import { FiscalYearEntity } from './entities/fiscal-year.entity';
import { JournalEntryEntity } from './entities/journal-entry.entity';
import { JournalLineEntity } from './entities/journal-line.entity';
import { PartyAddressEntity } from './entities/party-address.entity';
import { PartyEntity } from './entities/party.entity';
import { PaymentMethodEntity } from './entities/payment-method.entity';
import { PaymentTermEntity } from './entities/payment-term.entity';
import { TaxCodeEntity } from './entities/tax-code.entity';
import { TaxTemplateEntity } from './entities/tax-template.entity';
import { TaxTypeEntity } from './entities/tax-type.entity';
import { TransactionTypeEntity } from './entities/transaction-type.entity';
import { FiscalYearController } from './fiscal-year.controller';
import { FiscalYearService } from './fiscal-year.service';
import { JournalController } from './journal.controller';
import { JournalService } from './journal.service';
import { PartyController } from './party.controller';
import { PartyService } from './party.service';
import { ProvisioningController } from './provisioning.controller';
import { AccountingProvisioningService } from './provisioning.service';
import { TaxController } from './tax.controller';
import { TaxService } from './tax.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AccountEntity,
      CurrencyEntity,
      DocumentSequenceEntity,
      FiscalPeriodEntity,
      FiscalYearEntity,
      JournalEntryEntity,
      JournalLineEntity,
      PartyAddressEntity,
      PartyEntity,
      PaymentMethodEntity,
      PaymentTermEntity,
      TaxCodeEntity,
      TaxTemplateEntity,
      TaxTypeEntity,
      TransactionTypeEntity,
    ]),
    AuditModule,
    NepaliDateModule,
  ],
  controllers: [
    AccountController,
    DocumentSequenceController,
    FiscalYearController,
    JournalController,
    PartyController,
    ProvisioningController,
    TaxController,
  ],
  providers: [
    AccountService,
    AccountingProvisioningService,
    DocumentSequenceService,
    FiscalYearService,
    JournalService,
    PartyService,
    TaxService,
  ],
  exports: [AccountingProvisioningService],
})
export class AccountingModule {}
