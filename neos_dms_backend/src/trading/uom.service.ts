import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { UomEntity } from './entities/uom.entity';
import {
  UomNotFoundException,
  UomShortNameAlreadyUsedException,
} from './trading.errors';

export interface CreateUomInput {
  name: string;
  shortName: string;
}

export interface UpdateUomInput {
  name?: string;
  shortName?: string;
  isActive?: boolean;
}

export interface ListUomsQuery {
  page: number;
  limit: number;
  search?: string;
}

@Injectable()
export class UomService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(UomEntity)
    private readonly uomRepo: Repository<UomEntity>,
    private readonly auditService: AuditService,
  ) {}

  async createUom(
    organizationId: string,
    input: CreateUomInput,
    actorId: string,
  ): Promise<UomEntity> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(UomEntity);
      const dup = await repo.findOne({
        where: { organizationId, shortName: input.shortName },
      });
      if (dup) throw new UomShortNameAlreadyUsedException(input.shortName);

      const uom = await repo.save(
        repo.create({
          organizationId,
          name: input.name,
          shortName: input.shortName,
          isActive: true,
        }),
      );

      await this.auditService.record(
        {
          organizationId,
          userId: actorId,
          action: 'trading.uom.create',
          entityType: 'uom',
          entityId: uom.id,
          newData: { name: uom.name, shortName: uom.shortName },
        },
        manager,
      );

      return uom;
    });
  }

  async listUoms(
    organizationId: string,
    query: ListUomsQuery,
  ): Promise<[UomEntity[], number]> {
    const qb = this.uomRepo
      .createQueryBuilder('uom')
      .where('uom.organizationId = :organizationId', { organizationId });

    if (query.search) {
      qb.andWhere('(uom.name ILIKE :search OR uom.shortName ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    const [rows, total] = await qb
      .orderBy('uom.shortName', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return [rows, total];
  }

  async getUom(organizationId: string, id: string): Promise<UomEntity> {
    const uom = await this.uomRepo.findOne({
      where: { id, organizationId },
    });
    if (!uom) throw new UomNotFoundException(id);
    return uom;
  }

  async updateUom(
    organizationId: string,
    id: string,
    input: UpdateUomInput,
    actorId: string,
  ): Promise<UomEntity> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(UomEntity);
      const uom = await repo.findOne({ where: { id, organizationId } });
      if (!uom) throw new UomNotFoundException(id);

      if (input.shortName && input.shortName !== uom.shortName) {
        const dup = await repo.findOne({
          where: { organizationId, shortName: input.shortName },
        });
        if (dup) throw new UomShortNameAlreadyUsedException(input.shortName);
      }

      Object.assign(uom, {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.shortName !== undefined
          ? { shortName: input.shortName }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      });
      const updated = await repo.save(uom);

      await this.auditService.record(
        {
          organizationId,
          userId: actorId,
          action: 'trading.uom.update',
          entityType: 'uom',
          entityId: id,
          newData: { name: updated.name, shortName: updated.shortName },
        },
        manager,
      );

      return updated;
    });
  }

  async deleteUom(
    organizationId: string,
    id: string,
    actorId: string,
  ): Promise<void> {
    const uom = await this.uomRepo.findOne({ where: { id, organizationId } });
    if (!uom) throw new UomNotFoundException(id);

    await this.uomRepo.softDelete({ id, organizationId });

    await this.auditService.record({
      organizationId,
      userId: actorId,
      action: 'trading.uom.delete',
      entityType: 'uom',
      entityId: id,
      oldData: { name: uom.name, shortName: uom.shortName },
    });
  }
}
