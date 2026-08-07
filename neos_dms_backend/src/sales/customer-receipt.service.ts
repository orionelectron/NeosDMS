import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { AccountEntity } from '../accounting/entities/account.entity';
import { FiscalYearEntity } from '../accounting/entities/fiscal-year.entity';
import { JournalEntryEntity } from '../accounting/entities/journal-entry.entity';
import { PartyEntity } from '../accounting/entities/party.entity';
import { PaymentMethodEntity } from '../accounting/entities/payment-method.entity';
import type { SystemPurpose } from '../accounting/accounting.constants';
import { DocumentSequenceService } from '../accounting/document-sequence.service';
import { JournalService } from '../accounting/journal.service';
import { AuditService } from '../audit/audit.service';
import { NepaliDateConverter } from '../nepali-date/nepali-date-converter';
import { BranchEntity } from '../tenancy/entities/branch.entity';
import {
  CreateCustomerReceiptDto,
  CustomerReceiptAllocationDto,
  CustomerReceiptQueryDto,
  UpdateCustomerReceiptDto,
} from './dto/customer-receipt.dto';
import { SalesInvoiceEntity } from './entities/sales-invoice.entity';
import { CustomerReceiptAllocationEntity } from './entities/customer-receipt-allocation.entity';
import { CustomerReceiptEntity } from './entities/customer-receipt.entity';
import {
  CUSTOMER_RECEIPT_DOCUMENT_TYPE,
  CUSTOMER_RECEIPT_NUMBER_PREFIX,
  SALES_AUDIT_ACTIONS,
} from './sales.constants';
import {
  CustomerReceiptAccountMissingException,
  CustomerReceiptAccountNotFoundException,
  CustomerReceiptAccountTypeException,
  CustomerReceiptAllocationExceedsBalanceException,
  CustomerReceiptAllocationZeroException,
  CustomerReceiptCustomerNotFoundException,
  CustomerReceiptFiscalYearMissingException,
  CustomerReceiptInvoiceCustomerMismatchException,
  CustomerReceiptInvoiceNotFoundException,
  CustomerReceiptInvoiceNotPostedException,
  CustomerReceiptMethodNotFoundException,
  CustomerReceiptNoAllocationsException,
  CustomerReceiptNotDraftException,
  CustomerReceiptNotFoundException,
} from './sales.errors';

const ROUND2 = (n: number): number => Math.round(n * 100) / 100;

interface PreparedAllocation {
  salesInvoiceId: string;
  allocatedAmount: number;
}

interface PreparedReceipt {
  allocations: PreparedAllocation[];
  receivedAmount: number;
}

@Injectable()
export class CustomerReceiptService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(CustomerReceiptEntity)
    private readonly receiptRepo: Repository<CustomerReceiptEntity>,
    private readonly audit: AuditService,
    private readonly documentSequenceService: DocumentSequenceService,
    private readonly journalService: JournalService,
    private readonly nepaliDate: NepaliDateConverter,
  ) {}

  // ---- Mutations ----------------------------------------------------------

  async create(
    organizationId: string,
    actorId: string,
    dto: CreateCustomerReceiptDto,
  ): Promise<CustomerReceiptEntity> {
    return this.dataSource.transaction(async (manager) => {
      const customer = await this.requireCustomer(
        manager,
        organizationId,
        dto.partyId,
      );
      const prepared = await this.prepareReceipt(
        manager,
        organizationId,
        customer.id,
        dto.allocations,
      );

      const receiptRepo = manager.getRepository(CustomerReceiptEntity);
      const receipt = await receiptRepo.save(
        receiptRepo.create({
          organizationId,
          branchId: dto.branchId ?? null,
          receiptNumber: null,
          partyId: customer.id,
          paymentMethodId: dto.paymentMethodId,
          receiptAccountId: dto.receiptAccountId,
          status: 'DRAFT',
          receivedAmount: prepared.receivedAmount.toFixed(2),
          referenceNo: dto.referenceNo ?? null,
          notes: dto.notes ?? null,
        }),
      );

      await this.saveAllocations(
        manager,
        organizationId,
        receipt.id,
        prepared.allocations,
      );

      await this.audit.record(
        {
          organizationId,
          branchId: receipt.branchId,
          userId: actorId,
          action: SALES_AUDIT_ACTIONS.RECEIPT_CREATE,
          entityType: 'customer_receipt',
          entityId: receipt.id,
          newData: {
            status: 'DRAFT',
            partyId: customer.id,
            receivedAmount: receipt.receivedAmount,
            invoiceCount: prepared.allocations.length,
          },
        },
        manager,
      );

      return this.buildReceiptView(manager, organizationId, receipt.id);
    });
  }

  async update(
    organizationId: string,
    actorId: string,
    id: string,
    dto: UpdateCustomerReceiptDto,
  ): Promise<CustomerReceiptEntity> {
    return this.dataSource.transaction(async (manager) => {
      const receipt = await this.requireReceipt(manager, organizationId, id);
      if (receipt.status !== 'DRAFT') {
        throw new CustomerReceiptNotDraftException(
          id,
          receipt.status,
          'update',
        );
      }

      if (dto.partyId !== undefined && dto.partyId !== receipt.partyId) {
        const customer = await this.requireCustomer(
          manager,
          organizationId,
          dto.partyId,
        );
        receipt.partyId = customer.id;
      }
      if (dto.paymentMethodId !== undefined)
        receipt.paymentMethodId = dto.paymentMethodId;
      if (dto.receiptAccountId !== undefined)
        receipt.receiptAccountId = dto.receiptAccountId;
      if (dto.branchId !== undefined) receipt.branchId = dto.branchId;
      if (dto.referenceNo !== undefined) receipt.referenceNo = dto.referenceNo;
      if (dto.notes !== undefined) receipt.notes = dto.notes;

      const effectiveAllocations =
        dto.allocations ?? (await this.toAllocationDtos(manager, receipt));
      const prepared = await this.prepareReceipt(
        manager,
        organizationId,
        receipt.partyId,
        effectiveAllocations,
      );

      receipt.receivedAmount = prepared.receivedAmount.toFixed(2);

      const allocationRepo = manager.getRepository(
        CustomerReceiptAllocationEntity,
      );
      await allocationRepo.delete({ customerReceiptId: receipt.id });
      await this.saveAllocations(
        manager,
        organizationId,
        receipt.id,
        prepared.allocations,
      );
      await manager.getRepository(CustomerReceiptEntity).save(receipt);

      await this.audit.record(
        {
          organizationId,
          branchId: receipt.branchId,
          userId: actorId,
          action: SALES_AUDIT_ACTIONS.RECEIPT_UPDATE,
          entityType: 'customer_receipt',
          entityId: receipt.id,
          newData: {
            status: 'DRAFT',
            partyId: receipt.partyId,
            receivedAmount: receipt.receivedAmount,
            invoiceCount: prepared.allocations.length,
          },
        },
        manager,
      );

      return this.buildReceiptView(manager, organizationId, receipt.id);
    });
  }

  /**
   * Posts a draft: reserves the `RCV-` number and posts
   * `DR receipt account / CR AR 1103 (party)` for the allocated total.
   * Invoices are re-validated FOR UPDATE so concurrent receipts can never
   * over-collect (Σ allocations = received amount, each ≤ the invoice's live
   * balance), and each invoice's `paid_amount`/`balance_amount` is stamped —
   * all in one transaction.
   */
  async post(
    organizationId: string,
    actorId: string,
    id: string,
  ): Promise<CustomerReceiptEntity> {
    const postedId = await this.dataSource.transaction(async (manager) => {
      const receipt = await this.requireReceipt(manager, organizationId, id);
      if (receipt.status !== 'DRAFT') {
        throw new CustomerReceiptNotDraftException(id, receipt.status, 'post');
      }
      await this.assertCustomerActive(manager, organizationId, receipt.partyId);
      await this.requirePaymentMethod(
        manager,
        organizationId,
        receipt.paymentMethodId,
      );
      await this.requireReceiptAccount(
        manager,
        organizationId,
        receipt.receiptAccountId,
      );

      const allocations = await manager
        .getRepository(CustomerReceiptAllocationEntity)
        .find({
          where: { customerReceiptId: receipt.id },
          order: { createdAt: 'ASC' },
        });

      // Re-validate every invoice against its live row (locked FOR UPDATE)
      // and accumulate the paid/balance stamps.
      const invoiceStamps: Array<{
        invoice: SalesInvoiceEntity;
        allocatedAmount: number;
      }> = [];
      for (const allocation of allocations) {
        const invoice = await this.lockInvoice(
          manager,
          organizationId,
          allocation.salesInvoiceId,
        );
        if (invoice.status !== 'POSTED') {
          throw new CustomerReceiptInvoiceNotPostedException(invoice.id);
        }
        if (invoice.partyId !== receipt.partyId) {
          throw new CustomerReceiptInvoiceCustomerMismatchException(invoice.id);
        }
        const balance = ROUND2(Number(invoice.balanceAmount));
        const allocatedAmount = Number(allocation.allocatedAmount);
        if (ROUND2(allocatedAmount) > balance) {
          throw new CustomerReceiptAllocationExceedsBalanceException(
            invoice.id,
            balance.toFixed(2),
          );
        }
        invoiceStamps.push({ invoice, allocatedAmount });
      }

      const today = new Date();
      const todayBs = this.toBs(today);
      const fiscalYear = await this.resolveFiscalYear(
        manager,
        organizationId,
        today,
      );

      const receiptNumber = await this.documentSequenceService.nextNumber(
        {
          organizationId,
          branchId: receipt.branchId,
          fiscalYearId: fiscalYear.id,
          documentType: CUSTOMER_RECEIPT_DOCUMENT_TYPE,
          prefix: CUSTOMER_RECEIPT_NUMBER_PREFIX,
        },
        manager,
      );

      const journalBranchId =
        receipt.branchId ??
        (await this.requireDefaultBranch(manager, organizationId));
      const journal = await this.journalFor(manager, organizationId, receipt);
      const entry = await this.journalService.createDraftIn(
        manager,
        organizationId,
        {
          branchId: journalBranchId,
          entryDate: today.toISOString().slice(0, 10),
          description: `Customer receipt ${receiptNumber}`,
          lines: journal,
        },
        actorId,
      );
      await this.journalService.postIn(
        manager,
        organizationId,
        entry.id,
        actorId,
      );
      // Retry idempotency: a re-run of this POST can never mint a second
      // journal for the same receipt (uq_journal_entries_source).
      await manager.getRepository(JournalEntryEntity).update(entry.id, {
        sourceType: 'customer_receipt',
        sourceId: receipt.id,
      });

      const invoiceRepo = manager.getRepository(SalesInvoiceEntity);
      for (const stamp of invoiceStamps) {
        await invoiceRepo.update(
          { id: stamp.invoice.id },
          {
            paidAmount: ROUND2(
              Number(stamp.invoice.paidAmount) + stamp.allocatedAmount,
            ).toFixed(2),
            balanceAmount: ROUND2(
              Number(stamp.invoice.balanceAmount) - stamp.allocatedAmount,
            ).toFixed(2),
          },
        );
      }

      receipt.status = 'POSTED';
      receipt.receiptNumber = receiptNumber;
      receipt.receiptDate = today.toISOString().slice(0, 10);
      receipt.receiptDateBs = todayBs;
      receipt.fiscalYearId = fiscalYear.id;
      receipt.journalEntryId = entry.id;
      await manager.getRepository(CustomerReceiptEntity).save(receipt);

      await this.audit.record(
        {
          organizationId,
          branchId: receipt.branchId,
          userId: actorId,
          action: SALES_AUDIT_ACTIONS.RECEIPT_POST,
          entityType: 'customer_receipt',
          entityId: receipt.id,
          newData: {
            receiptNumber,
            status: 'POSTED',
            journalEntryId: entry.id,
            receivedAmount: receipt.receivedAmount,
            invoiceCount: invoiceStamps.length,
          },
        },
        manager,
      );

      return receipt.id;
    });

    return this.get(organizationId, postedId);
  }

  async voidReceipt(
    organizationId: string,
    actorId: string,
    id: string,
  ): Promise<CustomerReceiptEntity> {
    return this.dataSource.transaction(async (manager) => {
      const receipt = await this.requireReceipt(manager, organizationId, id);
      if (receipt.status !== 'DRAFT') {
        throw new CustomerReceiptNotDraftException(id, receipt.status, 'void');
      }

      receipt.status = 'CANCELLED';
      await manager.getRepository(CustomerReceiptEntity).save(receipt);
      await this.audit.record(
        {
          organizationId,
          branchId: receipt.branchId,
          userId: actorId,
          action: SALES_AUDIT_ACTIONS.RECEIPT_VOID,
          entityType: 'customer_receipt',
          entityId: receipt.id,
          newData: { status: 'CANCELLED' },
        },
        manager,
      );

      return this.buildReceiptView(manager, organizationId, receipt.id);
    });
  }

  // ---- Reads --------------------------------------------------------------

  async get(
    organizationId: string,
    id: string,
  ): Promise<CustomerReceiptEntity> {
    return this.buildReceiptView(this.dataSource.manager, organizationId, id);
  }

  async list(
    organizationId: string,
    query: CustomerReceiptQueryDto,
  ): Promise<[CustomerReceiptEntity[], number]> {
    const qb = this.receiptRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.party', 'party')
      .where('r.organization_id = :organizationId', { organizationId });

    if (query.status)
      qb.andWhere('r.status = :status', { status: query.status });
    if (query.partyId)
      qb.andWhere('r.party_id = :partyId', { partyId: query.partyId });

    const total = await qb.getCount();
    const rows = await qb
      .orderBy('r.createdAt', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getMany();
    return [rows, total];
  }

  // ---- Preparation --------------------------------------------------------

  private async prepareReceipt(
    manager: EntityManager,
    organizationId: string,
    partyId: string,
    allocations: CustomerReceiptAllocationDto[],
  ): Promise<PreparedReceipt> {
    if (allocations.length === 0) {
      throw new CustomerReceiptNoAllocationsException();
    }
    const prepared: PreparedAllocation[] = [];
    for (const dtoAllocation of allocations) {
      const allocatedAmount = ROUND2(dtoAllocation.allocatedAmount);
      if (allocatedAmount <= 0) {
        throw new CustomerReceiptAllocationZeroException(
          dtoAllocation.salesInvoiceId,
        );
      }
      const invoice = await manager.getRepository(SalesInvoiceEntity).findOne({
        where: { id: dtoAllocation.salesInvoiceId, organizationId },
      });
      if (!invoice) {
        throw new CustomerReceiptInvoiceNotFoundException(
          dtoAllocation.salesInvoiceId,
        );
      }
      if (invoice.status !== 'POSTED') {
        throw new CustomerReceiptInvoiceNotPostedException(invoice.id);
      }
      if (invoice.partyId !== partyId) {
        throw new CustomerReceiptInvoiceCustomerMismatchException(invoice.id);
      }
      prepared.push({ salesInvoiceId: invoice.id, allocatedAmount });
    }

    const receivedAmount = ROUND2(
      prepared.reduce((sum, allocation) => sum + allocation.allocatedAmount, 0),
    );

    return { allocations: prepared, receivedAmount };
  }

  // ---- Journal ------------------------------------------------------------

  /**
   * Balanced receipt journal:
   *   DR receipt account (received amount — cash/bank/other asset)
   *   CR Accounts Receivable 1103 (received amount, with the customer party)
   */
  private async journalFor(
    manager: EntityManager,
    organizationId: string,
    receipt: CustomerReceiptEntity,
  ): Promise<
    Array<{
      accountId: string;
      partyId?: string;
      debit?: number;
      credit?: number;
      description?: string;
    }>
  > {
    const ar = await this.requirePurposeAccount(
      manager,
      organizationId,
      'ACCOUNTS_RECEIVABLE',
    );
    const receivedAmount = Number(receipt.receivedAmount);

    return [
      {
        accountId: receipt.receiptAccountId,
        debit: receivedAmount,
        description: 'Payment in',
      },
      {
        accountId: ar.id,
        partyId: receipt.partyId,
        credit: receivedAmount,
        description: `Customer receipt ${receipt.receiptNumber ?? ''}`.trim(),
      },
    ];
  }

  private async requirePurposeAccount(
    manager: EntityManager,
    organizationId: string,
    purpose: SystemPurpose,
  ): Promise<AccountEntity> {
    const account = await manager.getRepository(AccountEntity).findOne({
      where: { organizationId, systemPurpose: purpose, isActive: true },
    });
    if (!account) {
      throw new CustomerReceiptAccountMissingException(purpose);
    }
    return account;
  }

  // ---- Shared -------------------------------------------------------------

  private async saveAllocations(
    manager: EntityManager,
    organizationId: string,
    customerReceiptId: string,
    allocations: PreparedAllocation[],
  ): Promise<void> {
    const allocationRepo = manager.getRepository(
      CustomerReceiptAllocationEntity,
    );
    await allocationRepo.save(
      allocations.map((allocation) =>
        allocationRepo.create({
          organizationId,
          customerReceiptId,
          salesInvoiceId: allocation.salesInvoiceId,
          allocatedAmount: allocation.allocatedAmount.toFixed(2),
        }),
      ),
    );
  }

  private async toAllocationDtos(
    manager: EntityManager,
    receipt: CustomerReceiptEntity,
  ): Promise<CustomerReceiptAllocationDto[]> {
    const allocations = await manager
      .getRepository(CustomerReceiptAllocationEntity)
      .find({
        where: { customerReceiptId: receipt.id },
        order: { createdAt: 'ASC' },
      });
    return allocations.map((allocation) => ({
      salesInvoiceId: allocation.salesInvoiceId,
      allocatedAmount: Number(allocation.allocatedAmount),
    }));
  }

  private async requireReceipt(
    manager: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<CustomerReceiptEntity> {
    const receipt = await manager.getRepository(CustomerReceiptEntity).findOne({
      where: { id, organizationId },
      relations: { party: true },
    });
    if (!receipt) throw new CustomerReceiptNotFoundException(id);
    return receipt;
  }

  private async buildReceiptView(
    manager: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<CustomerReceiptEntity> {
    const receipt = await manager.getRepository(CustomerReceiptEntity).findOne({
      where: { id, organizationId },
      relations: {
        party: true,
        branch: true,
        fiscalYear: true,
        paymentMethod: true,
        receiptAccount: true,
        journalEntry: true,
      },
    });
    if (!receipt) throw new CustomerReceiptNotFoundException(id);
    receipt.allocations = await manager
      .getRepository(CustomerReceiptAllocationEntity)
      .find({
        where: { customerReceiptId: receipt.id },
        relations: { invoice: true },
        order: { createdAt: 'ASC' },
      });
    return receipt;
  }

  private async requireCustomer(
    manager: EntityManager,
    organizationId: string,
    partyId: string,
  ): Promise<PartyEntity> {
    const customer = await manager.getRepository(PartyEntity).findOne({
      where: { id: partyId, organizationId, isCustomer: true, isActive: true },
    });
    if (!customer) throw new CustomerReceiptCustomerNotFoundException(partyId);
    return customer;
  }

  private async assertCustomerActive(
    manager: EntityManager,
    organizationId: string,
    partyId: string,
  ): Promise<void> {
    await this.requireCustomer(manager, organizationId, partyId);
  }

  private async requirePaymentMethod(
    manager: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<PaymentMethodEntity> {
    const method = await manager.getRepository(PaymentMethodEntity).findOne({
      where: { id, organizationId, isActive: true },
    });
    if (!method) throw new CustomerReceiptMethodNotFoundException(id);
    return method;
  }

  private async requireReceiptAccount(
    manager: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<AccountEntity> {
    const account = await manager.getRepository(AccountEntity).findOne({
      where: { id, organizationId, isActive: true },
    });
    if (!account) throw new CustomerReceiptAccountNotFoundException(id);
    if (account.isGroup || account.coaType !== 'ASSET') {
      throw new CustomerReceiptAccountTypeException(id);
    }
    return account;
  }

  private async lockInvoice(
    manager: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<SalesInvoiceEntity> {
    const invoice = await manager
      .getRepository(SalesInvoiceEntity)
      .createQueryBuilder('invoice')
      .where('invoice.organizationId = :organizationId', { organizationId })
      .andWhere('invoice.id = :id', { id })
      .setLock('pessimistic_write')
      .getOne();
    if (!invoice) throw new CustomerReceiptInvoiceNotFoundException(id);
    return invoice;
  }

  private async resolveFiscalYear(
    manager: EntityManager,
    organizationId: string,
    date: Date,
  ): Promise<FiscalYearEntity> {
    const fiscalYear = await manager.getRepository(FiscalYearEntity).findOne({
      where: {
        organizationId,
        isActive: true,
        isClosed: false,
        startDate: LessThanOrEqual(date),
        endDate: MoreThanOrEqual(date),
      },
    });
    if (!fiscalYear) {
      throw new CustomerReceiptFiscalYearMissingException();
    }
    return fiscalYear;
  }

  private async requireDefaultBranch(
    manager: EntityManager,
    organizationId: string,
  ): Promise<string> {
    const branch = await manager.getRepository(BranchEntity).findOne({
      where: { organizationId, isActive: true },
      order: { name: 'ASC' },
    });
    if (!branch) {
      throw new CustomerReceiptAccountMissingException('BRANCH');
    }
    return branch.id;
  }

  private toBs(date: Date): string {
    const bs = this.nepaliDate.adToBs(
      date.getFullYear(),
      date.getMonth() + 1,
      date.getDate(),
    );
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${bs.bsYear}-${pad(bs.bsMonth)}-${pad(bs.bsDay)}`;
  }
}
