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
  CreateSupplierPaymentDto,
  SupplierPaymentAllocationDto,
  SupplierPaymentQueryDto,
  UpdateSupplierPaymentDto,
} from './dto/supplier-payment.dto';
import { PurchaseBillEntity } from './entities/purchase-bill.entity';
import { SupplierPaymentBillAllocationEntity } from './entities/supplier-payment-bill-allocation.entity';
import { SupplierPaymentEntity } from './entities/supplier-payment.entity';
import {
  PURCHASE_AUDIT_ACTIONS,
  SUPPLIER_PAYMENT_DOCUMENT_TYPE,
  SUPPLIER_PAYMENT_NUMBER_PREFIX,
} from './purchase.constants';
import {
  SupplierPaymentAccountMissingException,
  SupplierPaymentAccountNotFoundException,
  SupplierPaymentAccountTypeException,
  SupplierPaymentAllocationExceedsBalanceException,
  SupplierPaymentAllocationZeroException,
  SupplierPaymentBillNotFoundException,
  SupplierPaymentBillNotPostedException,
  SupplierPaymentBillSupplierMismatchException,
  SupplierPaymentFiscalYearMissingException,
  SupplierPaymentMethodNotFoundException,
  SupplierPaymentNoAllocationsException,
  SupplierPaymentNotDraftException,
  SupplierPaymentNotFoundException,
  SupplierPaymentSupplierNotFoundException,
} from './purchase.errors';

const ROUND2 = (n: number): number => Math.round(n * 100) / 100;

interface PreparedAllocation {
  purchaseBillId: string;
  allocatedAmount: number;
}

interface PreparedPayment {
  allocations: PreparedAllocation[];
  paidAmount: number;
}

@Injectable()
export class SupplierPaymentService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(SupplierPaymentEntity)
    private readonly paymentRepo: Repository<SupplierPaymentEntity>,
    private readonly audit: AuditService,
    private readonly documentSequenceService: DocumentSequenceService,
    private readonly journalService: JournalService,
    private readonly nepaliDate: NepaliDateConverter,
  ) {}

  // ---- Mutations ----------------------------------------------------------

  async create(
    organizationId: string,
    actorId: string,
    dto: CreateSupplierPaymentDto,
  ): Promise<SupplierPaymentEntity> {
    return this.dataSource.transaction(async (manager) => {
      const supplier = await this.requireSupplier(
        manager,
        organizationId,
        dto.partyId,
      );
      const prepared = await this.preparePayment(
        manager,
        organizationId,
        supplier.id,
        dto.allocations,
      );

      const paymentRepo = manager.getRepository(SupplierPaymentEntity);
      const payment = await paymentRepo.save(
        paymentRepo.create({
          organizationId,
          branchId: dto.branchId ?? null,
          paymentNumber: null,
          partyId: supplier.id,
          paymentMethodId: dto.paymentMethodId,
          paymentAccountId: dto.paymentAccountId,
          status: 'DRAFT',
          paidAmount: prepared.paidAmount.toFixed(2),
          referenceNo: dto.referenceNo ?? null,
          notes: dto.notes ?? null,
        }),
      );

      await this.saveAllocations(
        manager,
        organizationId,
        payment.id,
        prepared.allocations,
      );

      await this.audit.record(
        {
          organizationId,
          branchId: payment.branchId,
          userId: actorId,
          action: PURCHASE_AUDIT_ACTIONS.PAYMENT_CREATE,
          entityType: 'supplier_payment',
          entityId: payment.id,
          newData: {
            status: 'DRAFT',
            partyId: supplier.id,
            paidAmount: payment.paidAmount,
            billCount: prepared.allocations.length,
          },
        },
        manager,
      );

      return this.buildPaymentView(manager, organizationId, payment.id);
    });
  }

  async update(
    organizationId: string,
    actorId: string,
    id: string,
    dto: UpdateSupplierPaymentDto,
  ): Promise<SupplierPaymentEntity> {
    return this.dataSource.transaction(async (manager) => {
      const payment = await this.requirePayment(manager, organizationId, id);
      if (payment.status !== 'DRAFT') {
        throw new SupplierPaymentNotDraftException(
          id,
          payment.status,
          'update',
        );
      }

      if (dto.partyId !== undefined && dto.partyId !== payment.partyId) {
        const supplier = await this.requireSupplier(
          manager,
          organizationId,
          dto.partyId,
        );
        payment.partyId = supplier.id;
      }
      if (dto.paymentMethodId !== undefined)
        payment.paymentMethodId = dto.paymentMethodId;
      if (dto.paymentAccountId !== undefined)
        payment.paymentAccountId = dto.paymentAccountId;
      if (dto.branchId !== undefined) payment.branchId = dto.branchId;
      if (dto.referenceNo !== undefined) payment.referenceNo = dto.referenceNo;
      if (dto.notes !== undefined) payment.notes = dto.notes;

      const effectiveAllocations =
        dto.allocations ?? (await this.toAllocationDtos(manager, payment));
      const prepared = await this.preparePayment(
        manager,
        organizationId,
        payment.partyId,
        effectiveAllocations,
      );

      payment.paidAmount = prepared.paidAmount.toFixed(2);

      const allocationRepo = manager.getRepository(
        SupplierPaymentBillAllocationEntity,
      );
      await allocationRepo.delete({ supplierPaymentId: payment.id });
      await this.saveAllocations(
        manager,
        organizationId,
        payment.id,
        prepared.allocations,
      );
      await manager.getRepository(SupplierPaymentEntity).save(payment);

      await this.audit.record(
        {
          organizationId,
          branchId: payment.branchId,
          userId: actorId,
          action: PURCHASE_AUDIT_ACTIONS.PAYMENT_UPDATE,
          entityType: 'supplier_payment',
          entityId: payment.id,
          newData: {
            status: 'DRAFT',
            partyId: payment.partyId,
            paidAmount: payment.paidAmount,
            billCount: prepared.allocations.length,
          },
        },
        manager,
      );

      return this.buildPaymentView(manager, organizationId, payment.id);
    });
  }

  /**
   * Posts a draft: reserves the `PMT-` number and posts
   * `DR AP 2101 (party) / CR payment account` for the allocated total. Bills
   * are re-validated FOR UPDATE so concurrent payments can never overpay
   * (Σ allocations = paid amount, each ≤ the bill's live balance), and each
   * bill's `paid_amount`/`balance_amount` is stamped — all in one transaction.
   */
  async post(
    organizationId: string,
    actorId: string,
    id: string,
  ): Promise<SupplierPaymentEntity> {
    const postedId = await this.dataSource.transaction(async (manager) => {
      const payment = await this.requirePayment(manager, organizationId, id);
      if (payment.status !== 'DRAFT') {
        throw new SupplierPaymentNotDraftException(id, payment.status, 'post');
      }
      await this.assertSupplierActive(manager, organizationId, payment.partyId);
      await this.requirePaymentMethod(
        manager,
        organizationId,
        payment.paymentMethodId,
      );
      await this.requirePaymentAccount(
        manager,
        organizationId,
        payment.paymentAccountId,
      );

      const allocations = await manager
        .getRepository(SupplierPaymentBillAllocationEntity)
        .find({
          where: { supplierPaymentId: payment.id },
          order: { createdAt: 'ASC' },
        });

      // Re-validate every bill against its live row (locked FOR UPDATE) and
      // accumulate the paid/balance stamps.
      const billStamps: Array<{
        bill: PurchaseBillEntity;
        allocatedAmount: number;
      }> = [];
      for (const allocation of allocations) {
        const bill = await this.lockBill(
          manager,
          organizationId,
          allocation.purchaseBillId,
        );
        if (bill.status !== 'POSTED') {
          throw new SupplierPaymentBillNotPostedException(bill.id);
        }
        if (bill.partyId !== payment.partyId) {
          throw new SupplierPaymentBillSupplierMismatchException(bill.id);
        }
        const balance = ROUND2(Number(bill.balanceAmount));
        const allocatedAmount = Number(allocation.allocatedAmount);
        if (ROUND2(allocatedAmount) > balance) {
          throw new SupplierPaymentAllocationExceedsBalanceException(
            bill.id,
            balance.toFixed(2),
          );
        }
        billStamps.push({ bill, allocatedAmount });
      }

      const today = new Date();
      const todayBs = this.toBs(today);
      const fiscalYear = await this.resolveFiscalYear(
        manager,
        organizationId,
        today,
      );

      const paymentNumber = await this.documentSequenceService.nextNumber(
        {
          organizationId,
          branchId: payment.branchId,
          fiscalYearId: fiscalYear.id,
          documentType: SUPPLIER_PAYMENT_DOCUMENT_TYPE,
          prefix: SUPPLIER_PAYMENT_NUMBER_PREFIX,
        },
        manager,
      );

      const journalBranchId =
        payment.branchId ??
        (await this.requireDefaultBranch(manager, organizationId));
      const journal = await this.journalFor(manager, organizationId, payment);
      const entry = await this.journalService.createDraftIn(
        manager,
        organizationId,
        {
          branchId: journalBranchId,
          entryDate: today.toISOString().slice(0, 10),
          description: `Supplier payment ${paymentNumber}`,
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
      // journal for the same payment (uq_journal_entries_source).
      await manager.getRepository(JournalEntryEntity).update(entry.id, {
        sourceType: 'supplier_payment',
        sourceId: payment.id,
      });

      const billRepo = manager.getRepository(PurchaseBillEntity);
      for (const stamp of billStamps) {
        await billRepo.update(
          { id: stamp.bill.id },
          {
            paidAmount: ROUND2(
              Number(stamp.bill.paidAmount) + stamp.allocatedAmount,
            ).toFixed(2),
            balanceAmount: ROUND2(
              Number(stamp.bill.balanceAmount) - stamp.allocatedAmount,
            ).toFixed(2),
          },
        );
      }

      payment.status = 'POSTED';
      payment.paymentNumber = paymentNumber;
      payment.paymentDate = today.toISOString().slice(0, 10);
      payment.paymentDateBs = todayBs;
      payment.fiscalYearId = fiscalYear.id;
      payment.journalEntryId = entry.id;
      await manager.getRepository(SupplierPaymentEntity).save(payment);

      await this.audit.record(
        {
          organizationId,
          branchId: payment.branchId,
          userId: actorId,
          action: PURCHASE_AUDIT_ACTIONS.PAYMENT_POST,
          entityType: 'supplier_payment',
          entityId: payment.id,
          newData: {
            paymentNumber,
            status: 'POSTED',
            journalEntryId: entry.id,
            paidAmount: payment.paidAmount,
            billCount: billStamps.length,
          },
        },
        manager,
      );

      return payment.id;
    });

    return this.get(organizationId, postedId);
  }

  async voidPayment(
    organizationId: string,
    actorId: string,
    id: string,
  ): Promise<SupplierPaymentEntity> {
    return this.dataSource.transaction(async (manager) => {
      const payment = await this.requirePayment(manager, organizationId, id);
      if (payment.status !== 'DRAFT') {
        throw new SupplierPaymentNotDraftException(id, payment.status, 'void');
      }

      payment.status = 'CANCELLED';
      await manager.getRepository(SupplierPaymentEntity).save(payment);
      await this.audit.record(
        {
          organizationId,
          branchId: payment.branchId,
          userId: actorId,
          action: PURCHASE_AUDIT_ACTIONS.PAYMENT_VOID,
          entityType: 'supplier_payment',
          entityId: payment.id,
          newData: { status: 'CANCELLED' },
        },
        manager,
      );

      return this.buildPaymentView(manager, organizationId, payment.id);
    });
  }

  // ---- Reads --------------------------------------------------------------

  async get(
    organizationId: string,
    id: string,
  ): Promise<SupplierPaymentEntity> {
    return this.buildPaymentView(this.dataSource.manager, organizationId, id);
  }

  async list(
    organizationId: string,
    query: SupplierPaymentQueryDto,
  ): Promise<[SupplierPaymentEntity[], number]> {
    const qb = this.paymentRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.party', 'party')
      .where('p.organization_id = :organizationId', { organizationId });

    if (query.status)
      qb.andWhere('p.status = :status', { status: query.status });
    if (query.partyId)
      qb.andWhere('p.party_id = :partyId', { partyId: query.partyId });

    const total = await qb.getCount();
    const rows = await qb
      .orderBy('p.createdAt', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getMany();
    return [rows, total];
  }

  // ---- Preparation --------------------------------------------------------

  private async preparePayment(
    manager: EntityManager,
    organizationId: string,
    partyId: string,
    allocations: SupplierPaymentAllocationDto[],
  ): Promise<PreparedPayment> {
    if (allocations.length === 0) {
      throw new SupplierPaymentNoAllocationsException();
    }
    const prepared: PreparedAllocation[] = [];
    for (const dtoAllocation of allocations) {
      const allocatedAmount = ROUND2(dtoAllocation.allocatedAmount);
      if (allocatedAmount <= 0) {
        throw new SupplierPaymentAllocationZeroException(
          dtoAllocation.purchaseBillId,
        );
      }
      const bill = await manager.getRepository(PurchaseBillEntity).findOne({
        where: { id: dtoAllocation.purchaseBillId, organizationId },
      });
      if (!bill) {
        throw new SupplierPaymentBillNotFoundException(
          dtoAllocation.purchaseBillId,
        );
      }
      if (bill.status !== 'POSTED') {
        throw new SupplierPaymentBillNotPostedException(bill.id);
      }
      if (bill.partyId !== partyId) {
        throw new SupplierPaymentBillSupplierMismatchException(bill.id);
      }
      prepared.push({ purchaseBillId: bill.id, allocatedAmount });
    }

    const paidAmount = ROUND2(
      prepared.reduce((sum, allocation) => sum + allocation.allocatedAmount, 0),
    );

    return { allocations: prepared, paidAmount };
  }

  // ---- Journal ------------------------------------------------------------

  /**
   * Balanced payment journal:
   *   DR Accounts Payable 2101 (paid amount, with the supplier party)
   *   CR payment account (paid amount — cash/bank/other asset)
   */
  private async journalFor(
    manager: EntityManager,
    organizationId: string,
    payment: SupplierPaymentEntity,
  ): Promise<
    Array<{
      accountId: string;
      partyId?: string;
      debit?: number;
      credit?: number;
      description?: string;
    }>
  > {
    const ap = await this.requirePurposeAccount(
      manager,
      organizationId,
      'ACCOUNTS_PAYABLE',
    );
    const paidAmount = Number(payment.paidAmount);

    return [
      {
        accountId: ap.id,
        partyId: payment.partyId,
        debit: paidAmount,
        description: `Supplier payment ${payment.paymentNumber ?? ''}`.trim(),
      },
      {
        accountId: payment.paymentAccountId,
        credit: paidAmount,
        description: 'Payment out',
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
      throw new SupplierPaymentAccountMissingException(purpose);
    }
    return account;
  }

  // ---- Shared -------------------------------------------------------------

  private async saveAllocations(
    manager: EntityManager,
    organizationId: string,
    supplierPaymentId: string,
    allocations: PreparedAllocation[],
  ): Promise<void> {
    const allocationRepo = manager.getRepository(
      SupplierPaymentBillAllocationEntity,
    );
    await allocationRepo.save(
      allocations.map((allocation) =>
        allocationRepo.create({
          organizationId,
          supplierPaymentId,
          purchaseBillId: allocation.purchaseBillId,
          allocatedAmount: allocation.allocatedAmount.toFixed(2),
        }),
      ),
    );
  }

  private async toAllocationDtos(
    manager: EntityManager,
    payment: SupplierPaymentEntity,
  ): Promise<SupplierPaymentAllocationDto[]> {
    const allocations = await manager
      .getRepository(SupplierPaymentBillAllocationEntity)
      .find({
        where: { supplierPaymentId: payment.id },
        order: { createdAt: 'ASC' },
      });
    return allocations.map((allocation) => ({
      purchaseBillId: allocation.purchaseBillId,
      allocatedAmount: Number(allocation.allocatedAmount),
    }));
  }

  private async requirePayment(
    manager: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<SupplierPaymentEntity> {
    const payment = await manager.getRepository(SupplierPaymentEntity).findOne({
      where: { id, organizationId },
      relations: { party: true },
    });
    if (!payment) throw new SupplierPaymentNotFoundException(id);
    return payment;
  }

  private async buildPaymentView(
    manager: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<SupplierPaymentEntity> {
    const payment = await manager.getRepository(SupplierPaymentEntity).findOne({
      where: { id, organizationId },
      relations: {
        party: true,
        branch: true,
        fiscalYear: true,
        paymentMethod: true,
        paymentAccount: true,
        journalEntry: true,
      },
    });
    if (!payment) throw new SupplierPaymentNotFoundException(id);
    payment.allocations = await manager
      .getRepository(SupplierPaymentBillAllocationEntity)
      .find({
        where: { supplierPaymentId: payment.id },
        relations: { bill: true },
        order: { createdAt: 'ASC' },
      });
    return payment;
  }

  private async requireSupplier(
    manager: EntityManager,
    organizationId: string,
    partyId: string,
  ): Promise<PartyEntity> {
    const supplier = await manager.getRepository(PartyEntity).findOne({
      where: { id: partyId, organizationId, isSupplier: true, isActive: true },
    });
    if (!supplier) throw new SupplierPaymentSupplierNotFoundException(partyId);
    return supplier;
  }

  private async assertSupplierActive(
    manager: EntityManager,
    organizationId: string,
    partyId: string,
  ): Promise<void> {
    await this.requireSupplier(manager, organizationId, partyId);
  }

  private async requirePaymentMethod(
    manager: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<PaymentMethodEntity> {
    const method = await manager.getRepository(PaymentMethodEntity).findOne({
      where: { id, organizationId, isActive: true },
    });
    if (!method) throw new SupplierPaymentMethodNotFoundException(id);
    return method;
  }

  private async requirePaymentAccount(
    manager: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<AccountEntity> {
    const account = await manager.getRepository(AccountEntity).findOne({
      where: { id, organizationId, isActive: true },
    });
    if (!account) throw new SupplierPaymentAccountNotFoundException(id);
    if (account.isGroup || account.coaType !== 'ASSET') {
      throw new SupplierPaymentAccountTypeException(id);
    }
    return account;
  }

  private async lockBill(
    manager: EntityManager,
    organizationId: string,
    id: string,
  ): Promise<PurchaseBillEntity> {
    const bill = await manager
      .getRepository(PurchaseBillEntity)
      .createQueryBuilder('bill')
      .where('bill.organizationId = :organizationId', { organizationId })
      .andWhere('bill.id = :id', { id })
      .setLock('pessimistic_write')
      .getOne();
    if (!bill) throw new SupplierPaymentBillNotFoundException(id);
    return bill;
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
      throw new SupplierPaymentFiscalYearMissingException();
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
      throw new SupplierPaymentAccountMissingException('BRANCH');
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
