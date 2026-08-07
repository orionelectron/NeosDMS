import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { UserEntity } from '../iam/entities/user.entity';
import {
  NepaliDateConverter,
  type AdDate,
} from '../nepali-date/nepali-date-converter';
import {
  CreateExpenseClaimDto,
  CreateExpenseItemDto,
  CreateTravelRequestDto,
  ExpenseClaimQueryDto,
  PayExpenseClaimDto,
  TravelRequestQueryDto,
  UpdateExpenseItemDto,
  UpdateTravelRequestDto,
} from './dto/travel.dto';
import { ApprovalEventEntity } from './entities/approval-event.entity';
import { TravelExpenseClaimEntity } from './entities/travel-expense-claim.entity';
import { TravelExpenseItemEntity } from './entities/travel-expense-item.entity';
import { TravelRequestEntity } from './entities/travel-request.entity';
import { toBsKey } from './hr.constants';
import {
  ExpenseClaimNotFoundException,
  ExpenseClaimStatusTransitionException,
  ExpenseItemNotFoundException,
  InvalidBsRangeException,
  InvalidExpenseAmountException,
  NotTheManagerException,
  TravelRequestMismatchException,
  TravelRequestNotFoundException,
  TravelStatusTransitionException,
} from './hr.errors';

const toNum = (value: string | number): number => Number(value);

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toAdKey(ad: {
  adYear: number;
  adMonth: number;
  adDay: number;
}): string {
  return `${ad.adYear}-${pad2(ad.adMonth)}-${pad2(ad.adDay)}`;
}

type BsDateInput = { bsYear: number; bsMonth: number; bsDay: number };

@Injectable()
export class TravelService {
  constructor(
    @InjectRepository(TravelRequestEntity)
    private readonly requestRepo: Repository<TravelRequestEntity>,
    @InjectRepository(TravelExpenseClaimEntity)
    private readonly claimRepo: Repository<TravelExpenseClaimEntity>,
    @InjectRepository(TravelExpenseItemEntity)
    private readonly itemRepo: Repository<TravelExpenseItemEntity>,
    @InjectRepository(ApprovalEventEntity)
    private readonly eventRepo: Repository<ApprovalEventEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly nepaliDate: NepaliDateConverter,
  ) {}

  // ---- Travel requests ---------------------------------------------------

  async createTravelRequest(
    organizationId: string,
    actorId: string,
    dto: CreateTravelRequestDto,
  ): Promise<TravelRequestEntity> {
    const { fromAd, toAd, fromBs, toBs } = this.resolveRange(dto.from, dto.to);
    const request = await this.requestRepo.save(
      this.requestRepo.create({
        organizationId,
        userId: actorId,
        purpose: dto.purpose,
        fromDate: toAdKey(fromAd),
        toDate: toAdKey(toAd),
        fromBsDate: fromBs,
        toBsDate: toBs,
        transportMode: dto.transportMode,
        estimatedCost: (dto.estimatedCost ?? 0).toFixed(2),
        status: 'PENDING',
      }),
    );

    await this.eventRepo.save(
      this.eventRepo.create({
        organizationId,
        entityType: 'travel_request',
        entityId: request.id,
        actorId,
        action: 'SUBMIT',
        note: null,
      }),
    );
    await this.audit.record({
      organizationId,
      userId: actorId,
      action: 'hr.travel_request.create',
      entityType: 'travel_request',
      entityId: request.id,
      newData: {
        purpose: request.purpose,
        fromBsDate: request.fromBsDate,
        toBsDate: request.toBsDate,
        transportMode: request.transportMode,
      },
    });
    return request;
  }

  async updateTravelRequest(
    organizationId: string,
    actorId: string,
    id: string,
    dto: UpdateTravelRequestDto,
  ): Promise<TravelRequestEntity> {
    const request = await this.requestRepo.findOne({
      where: { id, organizationId },
    });
    if (!request) throw new TravelRequestNotFoundException();
    if (request.status !== 'PENDING') {
      throw new TravelStatusTransitionException(
        'Only pending travel requests can be edited',
      );
    }
    if (request.userId !== actorId) {
      throw new TravelStatusTransitionException(
        'Only the requester can edit their travel request',
      );
    }

    const parseBs = (key: string): BsDateInput => ({
      bsYear: Number(key.slice(0, 4)),
      bsMonth: Number(key.slice(5, 7)),
      bsDay: Number(key.slice(8, 10)),
    });
    const fromInput: BsDateInput = dto.from ?? parseBs(request.fromBsDate);
    const toInput: BsDateInput = dto.to ?? parseBs(request.toBsDate);
    const { fromAd, toAd, fromBs, toBs } = this.resolveRange(
      fromInput,
      toInput,
    );

    if (dto.purpose !== undefined) request.purpose = dto.purpose;
    if (dto.transportMode !== undefined)
      request.transportMode = dto.transportMode;
    if (dto.estimatedCost !== undefined)
      request.estimatedCost = dto.estimatedCost.toFixed(2);
    request.fromDate = toAdKey(fromAd);
    request.toDate = toAdKey(toAd);
    request.fromBsDate = fromBs;
    request.toBsDate = toBs;

    const updated = await this.requestRepo.save(request);
    await this.eventRepo.save(
      this.eventRepo.create({
        organizationId,
        entityType: 'travel_request',
        entityId: updated.id,
        actorId,
        action: 'UPDATE',
        note: null,
      }),
    );
    await this.audit.record({
      organizationId,
      userId: actorId,
      action: 'hr.travel_request.update',
      entityType: 'travel_request',
      entityId: updated.id,
      newData: {
        purpose: updated.purpose,
        fromBsDate: updated.fromBsDate,
        toBsDate: updated.toBsDate,
      },
    });
    return updated;
  }

  async reviewTravelRequest(
    organizationId: string,
    actorId: string,
    id: string,
    action: 'APPROVE' | 'REJECT',
    note?: string,
  ): Promise<TravelRequestEntity> {
    return this.dataSource.transaction(async (manager) => {
      const requestRepo = manager.getRepository(TravelRequestEntity);
      const request = await requestRepo.findOne({
        where: { id, organizationId },
      });
      if (!request) throw new TravelRequestNotFoundException();
      if (request.status !== 'PENDING') {
        throw new TravelStatusTransitionException(
          `Only pending requests can be ${action === 'APPROVE' ? 'approved' : 'rejected'}`,
        );
      }
      await this.assertActorIsManager(
        manager,
        organizationId,
        request.userId,
        actorId,
      );

      request.status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      request.approvedBy = actorId;
      request.approvedAt = new Date();
      request.reviewerNote = note ?? request.reviewerNote;
      const updated = await requestRepo.save(request);

      await manager.getRepository(ApprovalEventEntity).save(
        manager.getRepository(ApprovalEventEntity).create({
          organizationId,
          entityType: 'travel_request',
          entityId: updated.id,
          actorId,
          action,
          note: note ?? null,
        }),
      );
      await this.audit.record(
        {
          organizationId,
          userId: actorId,
          action:
            action === 'APPROVE'
              ? 'hr.travel_request.approve'
              : 'hr.travel_request.reject',
          entityType: 'travel_request',
          entityId: updated.id,
          newData: { status: updated.status },
        },
        manager,
      );
      return updated;
    });
  }

  async cancelTravelRequest(
    organizationId: string,
    actorId: string,
    id: string,
  ): Promise<TravelRequestEntity> {
    return this.dataSource.transaction(async (manager) => {
      const requestRepo = manager.getRepository(TravelRequestEntity);
      const request = await requestRepo.findOne({
        where: { id, organizationId },
      });
      if (!request) throw new TravelRequestNotFoundException();
      if (request.status !== 'PENDING') {
        throw new TravelStatusTransitionException(
          'Only pending travel requests can be cancelled',
        );
      }
      if (actorId !== request.userId) {
        await this.assertActorIsManager(
          manager,
          organizationId,
          request.userId,
          actorId,
        );
      }
      request.status = 'CANCELLED';
      const updated = await requestRepo.save(request);

      await manager.getRepository(ApprovalEventEntity).save(
        manager.getRepository(ApprovalEventEntity).create({
          organizationId,
          entityType: 'travel_request',
          entityId: updated.id,
          actorId,
          action: 'CANCEL',
          note: null,
        }),
      );
      await this.audit.record(
        {
          organizationId,
          userId: actorId,
          action: 'hr.travel_request.cancel',
          entityType: 'travel_request',
          entityId: updated.id,
          newData: { status: updated.status },
        },
        manager,
      );
      return updated;
    });
  }

  async listTravelRequests(
    organizationId: string,
    actorId: string,
    query: TravelRequestQueryDto,
    scope: 'mine' | 'team' | 'all',
  ): Promise<TravelRequestEntity[]> {
    const qb = this.requestRepo
      .createQueryBuilder('tr')
      .leftJoinAndSelect('tr.user', 'user')
      .where('tr.organization_id = :organizationId', { organizationId });

    if (scope === 'mine') {
      qb.andWhere('tr.user_id = :actorId', { actorId });
    } else if (scope === 'team') {
      const teamIds = await this.userRepo
        .find({ where: { organizationId, managerId: actorId } })
        .then((rows) => rows.map((r) => r.id));
      if (teamIds.length === 0) return [];
      qb.andWhere('tr.user_id IN (:...teamIds)', { teamIds });
    }
    if (query.status) {
      qb.andWhere('tr.status = :status', { status: query.status });
    }
    if (query.userId) {
      qb.andWhere('tr.user_id = :userId', { userId: query.userId });
    }
    return qb.orderBy('tr.createdAt', 'DESC').getMany();
  }

  // ---- Expense claims ----------------------------------------------------

  async createExpenseClaim(
    organizationId: string,
    actorId: string,
    dto: CreateExpenseClaimDto,
  ): Promise<TravelExpenseClaimEntity> {
    const { fromAd, toAd, fromBs, toBs } = this.resolveRange(dto.from, dto.to);

    if (dto.travelRequestId) {
      const travel = await this.requestRepo.findOne({
        where: { id: dto.travelRequestId, organizationId },
      });
      if (!travel || travel.userId !== actorId) {
        throw new TravelRequestMismatchException();
      }
    }

    const claim = await this.claimRepo.save(
      this.claimRepo.create({
        organizationId,
        userId: actorId,
        travelRequestId: dto.travelRequestId ?? null,
        fromDate: toAdKey(fromAd),
        toDate: toAdKey(toAd),
        fromBsDate: fromBs,
        toBsDate: toBs,
        total: '0',
        status: 'PENDING',
      }),
    );

    await this.eventRepo.save(
      this.eventRepo.create({
        organizationId,
        entityType: 'expense_claim',
        entityId: claim.id,
        actorId,
        action: 'SUBMIT',
        note: null,
      }),
    );
    await this.audit.record({
      organizationId,
      userId: actorId,
      action: 'hr.expense.create',
      entityType: 'expense_claim',
      entityId: claim.id,
      newData: {
        travelRequestId: claim.travelRequestId,
        fromBsDate: claim.fromBsDate,
        toBsDate: claim.toBsDate,
      },
    });
    return claim;
  }

  async addExpenseItem(
    organizationId: string,
    actorId: string,
    claimId: string,
    dto: CreateExpenseItemDto,
  ): Promise<TravelExpenseItemEntity> {
    if (!Number.isFinite(dto.amount) || dto.amount <= 0) {
      throw new InvalidExpenseAmountException();
    }
    return this.dataSource.transaction(async (manager) => {
      const claim = await manager
        .getRepository(TravelExpenseClaimEntity)
        .findOne({
          where: { id: claimId, organizationId },
        });
      if (!claim) throw new ExpenseClaimNotFoundException();
      this.assertClaimPendingAndOwned(claim, actorId);

      const amount = dto.amount.toFixed(2);
      const item = await manager.getRepository(TravelExpenseItemEntity).save(
        manager.getRepository(TravelExpenseItemEntity).create({
          organizationId,
          claimId: claim.id,
          bsDate: toBsKey(
            dto.bsDate.bsYear,
            dto.bsDate.bsMonth,
            dto.bsDate.bsDay,
          ),
          category: dto.category,
          description: dto.description,
          amount,
          approvedAmount: amount,
          receiptKey: dto.receiptKey ?? null,
        }),
      );

      await this.refreshClaimTotal(manager, organizationId, claim.id);
      await this.recordClaimUpdate(manager, claim.id, actorId, organizationId);
      return item;
    });
  }

  async updateExpenseItem(
    organizationId: string,
    actorId: string,
    claimId: string,
    itemId: string,
    dto: UpdateExpenseItemDto,
  ): Promise<TravelExpenseItemEntity> {
    return this.dataSource.transaction(async (manager) => {
      const claim = await manager
        .getRepository(TravelExpenseClaimEntity)
        .findOne({
          where: { id: claimId, organizationId },
        });
      if (!claim) throw new ExpenseClaimNotFoundException();
      this.assertClaimPendingAndOwned(claim, actorId);

      const itemRepo = manager.getRepository(TravelExpenseItemEntity);
      const item = await itemRepo.findOne({
        where: { id: itemId, organizationId, claimId: claim.id },
      });
      if (!item) throw new ExpenseItemNotFoundException();

      if (dto.bsDate) {
        item.bsDate = toBsKey(
          dto.bsDate.bsYear,
          dto.bsDate.bsMonth,
          dto.bsDate.bsDay,
        );
      }
      if (dto.category !== undefined) item.category = dto.category;
      if (dto.description !== undefined) item.description = dto.description;
      if (dto.amount !== undefined) {
        if (!Number.isFinite(dto.amount) || dto.amount <= 0) {
          throw new InvalidExpenseAmountException();
        }
        const amount = dto.amount.toFixed(2);
        item.amount = amount;
        item.approvedAmount = amount;
      }
      if (dto.receiptKey !== undefined) item.receiptKey = dto.receiptKey;
      const updated = await itemRepo.save(item);

      await this.refreshClaimTotal(manager, organizationId, claim.id);
      await this.recordClaimUpdate(manager, claim.id, actorId, organizationId);
      return updated;
    });
  }

  async removeExpenseItem(
    organizationId: string,
    actorId: string,
    claimId: string,
    itemId: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const claim = await manager
        .getRepository(TravelExpenseClaimEntity)
        .findOne({
          where: { id: claimId, organizationId },
        });
      if (!claim) throw new ExpenseClaimNotFoundException();
      this.assertClaimPendingAndOwned(claim, actorId);

      const itemRepo = manager.getRepository(TravelExpenseItemEntity);
      const item = await itemRepo.findOne({
        where: { id: itemId, organizationId, claimId: claim.id },
      });
      if (!item) throw new ExpenseItemNotFoundException();
      await itemRepo.softDelete({ id: item.id });

      await this.refreshClaimTotal(manager, organizationId, claim.id);
      await this.recordClaimUpdate(manager, claim.id, actorId, organizationId);
    });
  }

  async reviewExpenseClaim(
    organizationId: string,
    actorId: string,
    claimId: string,
    action: 'APPROVE' | 'REJECT',
    note?: string,
  ): Promise<TravelExpenseClaimEntity> {
    return this.dataSource.transaction(async (manager) => {
      const claimRepo = manager.getRepository(TravelExpenseClaimEntity);
      const claim = await claimRepo.findOne({
        where: { id: claimId, organizationId },
      });
      if (!claim) throw new ExpenseClaimNotFoundException();
      if (claim.status !== 'PENDING') {
        throw new ExpenseClaimStatusTransitionException(
          `Only pending claims can be ${action === 'APPROVE' ? 'approved' : 'rejected'}`,
        );
      }
      await this.assertActorIsManager(
        manager,
        organizationId,
        claim.userId,
        actorId,
      );

      claim.status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      claim.approvedBy = actorId;
      claim.approvedAt = new Date();
      claim.reviewerNote = note ?? claim.reviewerNote;
      const updated = await claimRepo.save(claim);

      await manager.getRepository(ApprovalEventEntity).save(
        manager.getRepository(ApprovalEventEntity).create({
          organizationId,
          entityType: 'expense_claim',
          entityId: updated.id,
          actorId,
          action,
          note: note ?? null,
        }),
      );
      await this.audit.record(
        {
          organizationId,
          userId: actorId,
          action:
            action === 'APPROVE' ? 'hr.expense.approve' : 'hr.expense.reject',
          entityType: 'expense_claim',
          entityId: updated.id,
          newData: { status: updated.status },
        },
        manager,
      );
      return updated;
    });
  }

  async payExpenseClaim(
    organizationId: string,
    actorId: string,
    claimId: string,
    dto: PayExpenseClaimDto,
  ): Promise<TravelExpenseClaimEntity> {
    return this.dataSource.transaction(async (manager) => {
      const claimRepo = manager.getRepository(TravelExpenseClaimEntity);
      const claim = await claimRepo.findOne({
        where: { id: claimId, organizationId },
      });
      if (!claim) throw new ExpenseClaimNotFoundException();
      if (claim.status !== 'APPROVED') {
        throw new ExpenseClaimStatusTransitionException(
          'Only approved claims can be paid',
        );
      }

      if (dto.items && dto.items.length > 0) {
        const itemRepo = manager.getRepository(TravelExpenseItemEntity);
        const ids = dto.items.map((i) => i.id);
        const items = await itemRepo.find({
          where: { id: In(ids), organizationId, claimId: claim.id },
        });
        if (items.length !== ids.length) {
          throw new ExpenseItemNotFoundException();
        }
        const adjustments = new Map(
          dto.items.map((i) => [i.id, i.approvedAmount]),
        );
        for (const item of items) {
          const approved = adjustments.get(item.id);
          if (approved !== undefined) {
            if (!Number.isFinite(approved) || approved < 0) {
              throw new InvalidExpenseAmountException();
            }
            item.approvedAmount = approved.toFixed(2);
          }
        }
        await itemRepo.save(items);
      }

      claim.total = await this.refreshClaimTotal(
        manager,
        organizationId,
        claim.id,
      );
      claim.status = 'PAID';
      claim.paidBy = actorId;
      claim.paidAt = new Date();
      if (dto.note) claim.reviewerNote = dto.note;
      const updated = await claimRepo.save(claim);

      await manager.getRepository(ApprovalEventEntity).save(
        manager.getRepository(ApprovalEventEntity).create({
          organizationId,
          entityType: 'expense_claim',
          entityId: updated.id,
          actorId,
          action: 'PAID',
          note: dto.note ?? null,
        }),
      );
      await this.audit.record(
        {
          organizationId,
          userId: actorId,
          action: 'hr.expense.pay',
          entityType: 'expense_claim',
          entityId: updated.id,
          newData: { status: updated.status, total: updated.total },
        },
        manager,
      );
      return updated;
    });
  }

  async cancelExpenseClaim(
    organizationId: string,
    actorId: string,
    claimId: string,
  ): Promise<TravelExpenseClaimEntity> {
    return this.dataSource.transaction(async (manager) => {
      const claimRepo = manager.getRepository(TravelExpenseClaimEntity);
      const claim = await claimRepo.findOne({
        where: { id: claimId, organizationId },
      });
      if (!claim) throw new ExpenseClaimNotFoundException();
      if (claim.status !== 'PENDING') {
        throw new ExpenseClaimStatusTransitionException(
          'Only pending claims can be cancelled',
        );
      }
      if (actorId !== claim.userId) {
        await this.assertActorIsManager(
          manager,
          organizationId,
          claim.userId,
          actorId,
        );
      }
      claim.status = 'CANCELLED';
      const updated = await claimRepo.save(claim);

      await manager.getRepository(ApprovalEventEntity).save(
        manager.getRepository(ApprovalEventEntity).create({
          organizationId,
          entityType: 'expense_claim',
          entityId: updated.id,
          actorId,
          action: 'CANCEL',
          note: null,
        }),
      );
      await this.audit.record(
        {
          organizationId,
          userId: actorId,
          action: 'hr.expense.cancel',
          entityType: 'expense_claim',
          entityId: updated.id,
          newData: { status: updated.status },
        },
        manager,
      );
      return updated;
    });
  }

  async listExpenseClaims(
    organizationId: string,
    actorId: string,
    query: ExpenseClaimQueryDto,
    scope: 'mine' | 'team' | 'all',
  ): Promise<TravelExpenseClaimEntity[]> {
    const qb = this.claimRepo
      .createQueryBuilder('ec')
      .leftJoinAndSelect('ec.user', 'user')
      .leftJoinAndSelect('ec.travelRequest', 'travelRequest')
      .leftJoinAndSelect('ec.items', 'items')
      .where('ec.organization_id = :organizationId', { organizationId });

    if (scope === 'mine') {
      qb.andWhere('ec.user_id = :actorId', { actorId });
    } else if (scope === 'team') {
      const teamIds = await this.userRepo
        .find({ where: { organizationId, managerId: actorId } })
        .then((rows) => rows.map((r) => r.id));
      if (teamIds.length === 0) return [];
      qb.andWhere('ec.user_id IN (:...teamIds)', { teamIds });
    }
    if (query.status) {
      qb.andWhere('ec.status = :status', { status: query.status });
    }
    if (query.userId) {
      qb.andWhere('ec.user_id = :userId', { userId: query.userId });
    }
    return qb.orderBy('ec.createdAt', 'DESC').getMany();
  }

  async listApprovalEvents(
    organizationId: string,
    entityType: 'travel_request' | 'expense_claim',
    entityId: string,
  ): Promise<ApprovalEventEntity[]> {
    return this.eventRepo.find({
      where: { organizationId, entityType, entityId },
      order: { createdAt: 'ASC' },
    });
  }

  // ---- Helpers -----------------------------------------------------------

  private resolveRange(
    from: BsDateInput,
    to: BsDateInput,
  ): { fromAd: AdDate; toAd: AdDate; fromBs: string; toBs: string } {
    let fromAd: AdDate;
    let toAd: AdDate;
    try {
      fromAd = this.nepaliDate.bsToAd(from.bsYear, from.bsMonth, from.bsDay);
      toAd = this.nepaliDate.bsToAd(to.bsYear, to.bsMonth, to.bsDay);
    } catch (error) {
      throw new InvalidBsRangeException(
        error instanceof Error ? error.message : 'Invalid BS date range',
      );
    }
    try {
      this.nepaliDate.daysBetweenBs(from, to);
    } catch (error) {
      throw new InvalidBsRangeException(
        error instanceof Error ? error.message : 'Invalid BS date range',
      );
    }
    return {
      fromAd,
      toAd,
      fromBs: toBsKey(from.bsYear, from.bsMonth, from.bsDay),
      toBs: toBsKey(to.bsYear, to.bsMonth, to.bsDay),
    };
  }

  private assertClaimPendingAndOwned(
    claim: TravelExpenseClaimEntity,
    actorId: string,
  ): void {
    if (claim.status !== 'PENDING') {
      throw new ExpenseClaimStatusTransitionException(
        'Only pending claims can be modified',
      );
    }
    if (claim.userId !== actorId) {
      throw new ExpenseClaimStatusTransitionException(
        'Only the claimant can modify their claim',
      );
    }
  }

  private async refreshClaimTotal(
    manager: import('typeorm').EntityManager,
    organizationId: string,
    claimId: string,
  ): Promise<string> {
    const items = await manager
      .getRepository(TravelExpenseItemEntity)
      .find({ where: { organizationId, claimId } });
    const total = items.reduce(
      (sum, item) => sum + toNum(item.approvedAmount),
      0,
    );
    await manager
      .getRepository(TravelExpenseClaimEntity)
      .update({ id: claimId, organizationId }, { total: total.toFixed(2) });
    return total.toFixed(2);
  }

  private async recordClaimUpdate(
    manager: import('typeorm').EntityManager,
    claimId: string,
    actorId: string,
    organizationId: string,
  ): Promise<void> {
    await manager.getRepository(ApprovalEventEntity).save(
      manager.getRepository(ApprovalEventEntity).create({
        organizationId,
        entityType: 'expense_claim',
        entityId: claimId,
        actorId,
        action: 'UPDATE',
        note: null,
      }),
    );
    await this.audit.record(
      {
        organizationId,
        userId: actorId,
        action: 'hr.expense.update',
        entityType: 'expense_claim',
        entityId: claimId,
        newData: { status: 'PENDING' },
      },
      manager,
    );
  }

  private async assertActorIsManager(
    manager: import('typeorm').EntityManager,
    organizationId: string,
    requesterId: string,
    actorId: string,
  ): Promise<void> {
    const requester = await manager.getRepository(UserEntity).findOne({
      where: { id: requesterId, organizationId },
    });
    if (!requester || requester.managerId !== actorId) {
      throw new NotTheManagerException();
    }
  }
}
