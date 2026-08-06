import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, FindOptionsWhere, Repository } from 'typeorm';
import { NepaliDateConverter } from '../../nepali-date/nepali-date-converter';
import { AuditLogEntity } from '../entities/audit-log.entity';

export interface AuditInput {
  organizationId: string;
  branchId?: string | null;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  ipAddress?: string | null;
  occurredAt?: Date;
}

export interface AuditQuery {
  organizationId: string;
  page: number;
  limit: number;
  action?: string;
  entityType?: string;
  userId?: string;
}

/**
 * Append-only audit trail with the spec's dual AD/BS timestamps. Accepts an
 * optional transaction manager so business flows record the audit row in the
 * same transaction as the mutation they describe.
 */
@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditRepo: Repository<AuditLogEntity>,
    private readonly nepaliDate: NepaliDateConverter,
  ) {}

  async record(input: AuditInput, manager?: EntityManager): Promise<void> {
    const occurredAt = input.occurredAt ?? new Date();
    const repo = manager
      ? manager.getRepository(AuditLogEntity)
      : this.auditRepo;

    await repo.save(
      repo.create({
        organizationId: input.organizationId,
        branchId: input.branchId ?? null,
        userId: input.userId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        oldData: input.oldData ?? null,
        newData: input.newData ?? null,
        ipAddress: input.ipAddress ?? null,
        bsDate: this.toBsDate(occurredAt),
        occurredAt,
      }),
    );
  }

  async query(query: AuditQuery): Promise<[AuditLogEntity[], number]> {
    const where: FindOptionsWhere<AuditLogEntity> = {
      organizationId: query.organizationId,
      ...(query.action ? { action: query.action } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
    };

    const [rows, total] = await this.auditRepo.findAndCount({
      where,
      order: { occurredAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return [rows, total];
  }

  private toBsDate(date: Date): string {
    const bs = this.nepaliDate.adToBs(
      date.getFullYear(),
      date.getMonth() + 1,
      date.getDate(),
    );
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${bs.bsYear}-${pad(bs.bsMonth)}-${pad(bs.bsDay)}`;
  }
}
