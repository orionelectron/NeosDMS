import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { UserEntity } from '../iam/entities/user.entity';
import { UserNotFoundException } from '../iam/iam.errors';
import { NepaliDateConverter } from '../nepali-date/nepali-date-converter';
import { CreateLeaveRequestDto, LeaveListQueryDto } from './dto/leave.dto';
import {
  CreateLeaveBalanceDto,
  CreateLeaveTypeDto,
  UpdateLeaveTypeDto,
} from './dto/leave-type.dto';
import { ApprovalEventEntity } from './entities/approval-event.entity';
import { LeaveBalanceEntity } from './entities/leave-balance.entity';
import { LeaveRequestEntity } from './entities/leave-request.entity';
import { LeaveTypeEntity } from './entities/leave-type.entity';
import { toBsKey, type ApprovalEntityType } from './hr.constants';
import {
  InsufficientLeaveBalanceException,
  InvalidLeaveRangeException,
  LeaveOverlapException,
  LeaveRequestNotFoundException,
  LeaveStatusTransitionException,
  LeaveTypeCodeAlreadyUsedException,
  LeaveTypeInactiveException,
  LeaveTypeNotFoundException,
  NotTheManagerException,
} from './hr.errors';

const toNum = (value: string): number => Number(value);

export interface LeaveBalanceView {
  leaveType: LeaveTypeEntity;
  bsYear: number | null;
  entitledDays: number;
  carryoverDays: number;
  usedDays: number;
  availableDays: number;
}

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

@Injectable()
export class LeaveService {
  constructor(
    @InjectRepository(LeaveTypeEntity)
    private readonly leaveTypeRepo: Repository<LeaveTypeEntity>,
    @InjectRepository(LeaveBalanceEntity)
    private readonly balanceRepo: Repository<LeaveBalanceEntity>,
    @InjectRepository(LeaveRequestEntity)
    private readonly requestRepo: Repository<LeaveRequestEntity>,
    @InjectRepository(ApprovalEventEntity)
    private readonly eventRepo: Repository<ApprovalEventEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly nepaliDate: NepaliDateConverter,
  ) {}

  // ---- Leave types -------------------------------------------------------

  listLeaveTypes(organizationId: string): Promise<LeaveTypeEntity[]> {
    return this.leaveTypeRepo.find({
      where: { organizationId },
      order: { name: 'ASC' },
    });
  }

  async createLeaveType(
    organizationId: string,
    dto: CreateLeaveTypeDto,
    actorId: string,
  ): Promise<LeaveTypeEntity> {
    const existing = await this.leaveTypeRepo.findOne({
      where: { organizationId, code: dto.code },
    });
    if (existing) throw new LeaveTypeCodeAlreadyUsedException(dto.code);

    const entity = await this.leaveTypeRepo.save(
      this.leaveTypeRepo.create({
        organizationId,
        code: dto.code,
        name: dto.name,
        isPaid: dto.isPaid ?? true,
        daysPerYear: dto.daysPerYear ?? 0,
        carryoverLimitDays: dto.carryoverLimitDays ?? 0,
        maxConsecutiveDays: dto.maxConsecutiveDays ?? 0,
        requiresBalance: dto.requiresBalance ?? true,
        isActive: true,
      }),
    );
    await this.audit.record({
      organizationId,
      userId: actorId,
      action: 'hr.leave_type.create',
      entityType: 'leave_type',
      entityId: entity.id,
      newData: { code: entity.code, name: entity.name },
    });
    return entity;
  }

  async updateLeaveType(
    organizationId: string,
    id: string,
    dto: UpdateLeaveTypeDto,
    actorId: string,
  ): Promise<LeaveTypeEntity> {
    const entity = await this.leaveTypeRepo.findOne({
      where: { id, organizationId },
    });
    if (!entity) throw new LeaveTypeNotFoundException();
    Object.assign(entity, dto);
    const updated = await this.leaveTypeRepo.save(entity);
    await this.audit.record({
      organizationId,
      userId: actorId,
      action: 'hr.leave_type.update',
      entityType: 'leave_type',
      entityId: updated.id,
      newData: { name: updated.name, isActive: updated.isActive },
    });
    return updated;
  }

  async deleteLeaveType(
    organizationId: string,
    id: string,
    actorId: string,
  ): Promise<void> {
    const entity = await this.leaveTypeRepo.findOne({
      where: { id, organizationId },
    });
    if (!entity) throw new LeaveTypeNotFoundException();
    await this.leaveTypeRepo.softDelete({ id });
    await this.audit.record({
      organizationId,
      userId: actorId,
      action: 'hr.leave_type.delete',
      entityType: 'leave_type',
      entityId: id,
      oldData: { code: entity.code, name: entity.name },
    });
  }

  // ---- Leave balances ----------------------------------------------------

  async upsertLeaveBalance(
    organizationId: string,
    dto: CreateLeaveBalanceDto,
    actorId: string,
  ): Promise<LeaveBalanceEntity> {
    return this.dataSource.transaction(async (manager) => {
      const user = await manager.getRepository(UserEntity).findOne({
        where: { id: dto.userId, organizationId },
      });
      if (!user) throw new UserNotFoundException();
      const type = await manager.getRepository(LeaveTypeEntity).findOne({
        where: { id: dto.leaveTypeId, organizationId },
      });
      if (!type) throw new LeaveTypeNotFoundException();

      const balanceRepo = manager.getRepository(LeaveBalanceEntity);
      const existing = await balanceRepo.findOne({
        where: {
          organizationId,
          userId: dto.userId,
          leaveTypeId: dto.leaveTypeId,
          bsYear: dto.bsYear,
        },
      });

      let balance: LeaveBalanceEntity;
      if (existing) {
        existing.entitledDays = (
          dto.entitledDays ?? toNum(existing.entitledDays)
        ).toString();
        existing.carryoverDays = (
          dto.carryoverDays ?? toNum(existing.carryoverDays)
        ).toString();
        balance = await balanceRepo.save(existing);
      } else {
        balance = await balanceRepo.save(
          balanceRepo.create({
            organizationId,
            userId: dto.userId,
            leaveTypeId: dto.leaveTypeId,
            bsYear: dto.bsYear,
            entitledDays: (dto.entitledDays ?? 0).toString(),
            carryoverDays: (dto.carryoverDays ?? 0).toString(),
            usedDays: '0',
          }),
        );
      }

      await this.audit.record(
        {
          organizationId,
          userId: actorId,
          action: 'hr.leave_balance.update',
          entityType: 'leave_balance',
          entityId: balance.id,
          newData: {
            userId: balance.userId,
            leaveTypeId: balance.leaveTypeId,
            bsYear: balance.bsYear,
            entitledDays: balance.entitledDays,
            carryoverDays: balance.carryoverDays,
            usedDays: balance.usedDays,
          },
        },
        manager,
      );
      return balance;
    });
  }

  async getLeaveBalances(
    organizationId: string,
    actorId: string,
    query: { userId?: string; bsYear?: number },
  ): Promise<LeaveBalanceView[]> {
    const targetUserId = query.userId ?? actorId;
    if (targetUserId !== actorId) {
      const target = await this.userRepo.findOne({
        where: { id: targetUserId, organizationId },
      });
      if (!target || target.managerId !== actorId) {
        throw new NotTheManagerException();
      }
    }

    const types = await this.leaveTypeRepo.find({
      where: { organizationId, isActive: true },
      order: { name: 'ASC' },
    });
    const balances = await this.balanceRepo.find({
      where: {
        organizationId,
        userId: targetUserId,
        ...(query.bsYear ? { bsYear: query.bsYear } : {}),
      },
    });
    const byKey = new Map<string, LeaveBalanceEntity>();
    for (const b of balances) {
      byKey.set(`${b.leaveTypeId}:${b.bsYear}`, b);
    }

    return types.map((type) => {
      const b = query.bsYear
        ? byKey.get(`${type.id}:${query.bsYear}`)
        : [...byKey.entries()]
            .filter(([key]) => key.startsWith(`${type.id}:`))
            .sort((a, b) => b[0].localeCompare(a[0]))[0]?.[1];
      const entitled = b ? toNum(b.entitledDays) : 0;
      const carryover = b ? toNum(b.carryoverDays) : 0;
      const used = b ? toNum(b.usedDays) : 0;
      return {
        leaveType: type,
        bsYear: b?.bsYear ?? query.bsYear ?? null,
        entitledDays: entitled,
        carryoverDays: carryover,
        usedDays: used,
        availableDays: entitled + carryover - used,
      };
    });
  }

  // ---- Leave requests ----------------------------------------------------

  async applyLeave(
    organizationId: string,
    actorId: string,
    dto: CreateLeaveRequestDto,
  ): Promise<LeaveRequestEntity> {
    const type = await this.leaveTypeRepo.findOne({
      where: { id: dto.leaveTypeId, organizationId },
    });
    if (!type) throw new LeaveTypeNotFoundException();
    if (!type.isActive) throw new LeaveTypeInactiveException();

    let fromAd: ReturnType<typeof this.nepaliDate.bsToAd>;
    let toAd: ReturnType<typeof this.nepaliDate.bsToAd>;
    try {
      fromAd = this.nepaliDate.bsToAd(
        dto.from.bsYear,
        dto.from.bsMonth,
        dto.from.bsDay,
      );
      toAd = this.nepaliDate.bsToAd(
        dto.to.bsYear,
        dto.to.bsMonth,
        dto.to.bsDay,
      );
    } catch (error) {
      throw new InvalidLeaveRangeException(
        error instanceof Error ? error.message : 'Invalid BS date range',
      );
    }
    const fromBs = toBsKey(dto.from.bsYear, dto.from.bsMonth, dto.from.bsDay);
    const toBs = toBsKey(dto.to.bsYear, dto.to.bsMonth, dto.to.bsDay);

    let days: number;
    try {
      days = this.nepaliDate.daysBetweenBs(dto.from, dto.to);
    } catch (error) {
      throw new InvalidLeaveRangeException(
        error instanceof Error ? error.message : 'Invalid BS date range',
      );
    }
    if (type.maxConsecutiveDays > 0 && days > type.maxConsecutiveDays) {
      throw new InvalidLeaveRangeException(
        `Leave cannot exceed ${type.maxConsecutiveDays} consecutive days`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const requestRepo = manager.getRepository(LeaveRequestEntity);

      const overlap = await requestRepo
        .createQueryBuilder('lr')
        .where('lr.organization_id = :organizationId', { organizationId })
        .andWhere('lr.user_id = :actorId', { actorId })
        .andWhere('lr.status IN (:...statuses)', {
          statuses: ['PENDING', 'APPROVED'],
        })
        .andWhere('lr.from_bs_date <= :toBs', { toBs })
        .andWhere('lr.to_bs_date >= :fromBs', { fromBs })
        .getOne();
      if (overlap) throw new LeaveOverlapException();

      if (type.requiresBalance) {
        const balance = await this.ensureBalance(
          manager,
          organizationId,
          actorId,
          type,
          dto.from.bsYear,
        );
        const available =
          toNum(balance.entitledDays) +
          toNum(balance.carryoverDays) -
          toNum(balance.usedDays);
        if (available < days) {
          throw new InsufficientLeaveBalanceException(available, days);
        }
      }

      const request = await requestRepo.save(
        requestRepo.create({
          organizationId,
          userId: actorId,
          leaveTypeId: type.id,
          status: 'PENDING',
          fromDate: toAdKey(fromAd),
          toDate: toAdKey(toAd),
          fromBsDate: fromBs,
          toBsDate: toBs,
          days,
          reason: dto.reason ?? null,
        }),
      );

      await manager.getRepository(ApprovalEventEntity).save(
        manager.getRepository(ApprovalEventEntity).create({
          organizationId,
          entityType: 'leave_request',
          entityId: request.id,
          actorId,
          action: 'SUBMIT',
          note: dto.reason ?? null,
        }),
      );

      await this.audit.record(
        {
          organizationId,
          userId: actorId,
          action: 'hr.leave.create',
          entityType: 'leave_request',
          entityId: request.id,
          newData: {
            leaveTypeId: request.leaveTypeId,
            fromBsDate: request.fromBsDate,
            toBsDate: request.toBsDate,
            days: request.days,
          },
        },
        manager,
      );
      return request;
    });
  }

  async reviewLeave(
    organizationId: string,
    actorId: string,
    id: string,
    action: 'APPROVE' | 'REJECT',
    note?: string,
  ): Promise<LeaveRequestEntity> {
    return this.dataSource.transaction(async (manager) => {
      const requestRepo = manager.getRepository(LeaveRequestEntity);
      const request = await requestRepo.findOne({
        where: { id, organizationId },
      });
      if (!request) throw new LeaveRequestNotFoundException();
      if (request.status !== 'PENDING') {
        throw new LeaveStatusTransitionException(
          `Only pending requests can be ${action === 'APPROVE' ? 'approved' : 'rejected'}`,
        );
      }
      await this.assertActorIsManager(
        manager,
        organizationId,
        request.userId,
        actorId,
      );

      if (action === 'APPROVE') {
        const type = await manager.getRepository(LeaveTypeEntity).findOne({
          where: { id: request.leaveTypeId, organizationId },
        });
        if (!type) throw new LeaveTypeNotFoundException();
        if (type.requiresBalance) {
          const bsYear = Number(request.fromBsDate.slice(0, 4));
          const balance = await this.ensureBalance(
            manager,
            organizationId,
            request.userId,
            type,
            bsYear,
          );
          const available =
            toNum(balance.entitledDays) +
            toNum(balance.carryoverDays) -
            toNum(balance.usedDays);
          if (available < request.days) {
            throw new InsufficientLeaveBalanceException(
              available,
              request.days,
            );
          }
          balance.usedDays = (
            toNum(balance.usedDays) + request.days
          ).toString();
          await manager.getRepository(LeaveBalanceEntity).save(balance);
        }
        request.status = 'APPROVED';
      } else {
        request.status = 'REJECTED';
      }
      request.approvedBy = actorId;
      request.approvedAt = new Date();
      request.reviewerNote = note ?? request.reviewerNote;
      const updated = await requestRepo.save(request);

      await manager.getRepository(ApprovalEventEntity).save(
        manager.getRepository(ApprovalEventEntity).create({
          organizationId,
          entityType: 'leave_request',
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
          action: action === 'APPROVE' ? 'hr.leave.approve' : 'hr.leave.reject',
          entityType: 'leave_request',
          entityId: updated.id,
          newData: {
            status: updated.status,
            reviewerNote: updated.reviewerNote,
          },
        },
        manager,
      );
      return updated;
    });
  }

  async cancelLeave(
    organizationId: string,
    actorId: string,
    id: string,
  ): Promise<LeaveRequestEntity> {
    return this.dataSource.transaction(async (manager) => {
      const requestRepo = manager.getRepository(LeaveRequestEntity);
      const request = await requestRepo.findOne({
        where: { id, organizationId },
      });
      if (!request) throw new LeaveRequestNotFoundException();
      if (request.status !== 'PENDING') {
        throw new LeaveStatusTransitionException(
          'Only pending requests can be cancelled',
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
          entityType: 'leave_request',
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
          action: 'hr.leave.cancel',
          entityType: 'leave_request',
          entityId: updated.id,
          newData: { status: updated.status },
        },
        manager,
      );
      return updated;
    });
  }

  async listLeaveRequests(
    organizationId: string,
    actorId: string,
    query: LeaveListQueryDto,
    scope: 'mine' | 'team' | 'all',
  ): Promise<LeaveRequestEntity[]> {
    const qb = this.requestRepo
      .createQueryBuilder('lr')
      .leftJoinAndSelect('lr.user', 'user')
      .leftJoinAndSelect('lr.leaveType', 'leaveType')
      .where('lr.organization_id = :organizationId', { organizationId });

    if (scope === 'mine') {
      qb.andWhere('lr.user_id = :actorId', { actorId });
    } else if (scope === 'team') {
      const teamIds = await this.userRepo
        .find({ where: { organizationId, managerId: actorId } })
        .then((rows) => rows.map((r) => r.id));
      if (teamIds.length === 0) return [];
      qb.andWhere('lr.user_id IN (:...teamIds)', { teamIds });
    }
    if (query.status) {
      qb.andWhere('lr.status = :status', { status: query.status });
    }
    if (query.userId) {
      qb.andWhere('lr.user_id = :userId', { userId: query.userId });
    }
    return qb.orderBy('lr.from_date', 'DESC').getMany();
  }

  async listApprovalEvents(
    organizationId: string,
    entityType: ApprovalEntityType,
    entityId: string,
  ): Promise<ApprovalEventEntity[]> {
    return this.eventRepo.find({
      where: { organizationId, entityType, entityId },
      order: { createdAt: 'ASC' },
    });
  }

  // ---- Helpers -----------------------------------------------------------

  private async ensureBalance(
    manager: import('typeorm').EntityManager,
    organizationId: string,
    userId: string,
    type: LeaveTypeEntity,
    bsYear: number,
  ): Promise<LeaveBalanceEntity> {
    const balanceRepo = manager.getRepository(LeaveBalanceEntity);
    const existing = await balanceRepo.findOne({
      where: { organizationId, userId, leaveTypeId: type.id, bsYear },
    });
    if (existing) return existing;
    return balanceRepo.save(
      balanceRepo.create({
        organizationId,
        userId,
        leaveTypeId: type.id,
        bsYear,
        entitledDays: '0',
        carryoverDays: '0',
        usedDays: '0',
      }),
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
