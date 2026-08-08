import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { ItemEntity } from './entities/item.entity';
import { UomConversionEntity } from './entities/uom-conversion.entity';
import { UomEntity } from './entities/uom.entity';
import {
  InvalidConversionFactorException,
  ItemNotFoundException,
  SameUomConversionException,
  UomConversionAlreadyExistsException,
  UomConversionNotFoundException,
  UomNotFoundException,
} from './trading.errors';

export interface CreateUomConversionInput {
  itemId?: string | null;
  fromUomId: string;
  toUomId: string;
  conversionFactor: string | number;
}

export interface ListUomConversionsQuery {
  page: number;
  limit: number;
  itemId?: string;
}

@Injectable()
export class UomConversionService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(UomConversionEntity)
    private readonly conversionRepo: Repository<UomConversionEntity>,
    private readonly auditService: AuditService,
  ) {}

  async createUomConversion(
    organizationId: string,
    input: CreateUomConversionInput,
    actorId: string,
  ): Promise<UomConversionEntity> {
    const factor = Number(input.conversionFactor);
    if (!(factor > 0)) throw new InvalidConversionFactorException();
    if (input.fromUomId === input.toUomId)
      throw new SameUomConversionException();

    return this.dataSource.transaction(async (manager) => {
      const conversionRepo = manager.getRepository(UomConversionEntity);

      await this.requireUomInOrg(
        manager.getRepository(UomEntity),
        organizationId,
        input.fromUomId,
      );
      await this.requireUomInOrg(
        manager.getRepository(UomEntity),
        organizationId,
        input.toUomId,
      );
      if (input.itemId) {
        const item = await manager
          .getRepository(ItemEntity)
          .findOne({ where: { id: input.itemId, organizationId } });
        if (!item) throw new ItemNotFoundException(input.itemId);
      }

      const duplicate = await conversionRepo.findOne({
        where: {
          organizationId,
          itemId: input.itemId ? input.itemId : IsNull(),
          fromUomId: input.fromUomId,
          toUomId: input.toUomId,
        },
        withDeleted: true,
      });
      if (duplicate) {
        throw new UomConversionAlreadyExistsException(
          input.fromUomId,
          input.toUomId,
          input.itemId ?? null,
        );
      }

      const conversion = await conversionRepo.save(
        conversionRepo.create({
          organizationId,
          itemId: input.itemId ?? null,
          fromUomId: input.fromUomId,
          toUomId: input.toUomId,
          conversionFactor: factor.toFixed(6),
        }),
      );

      await this.auditService.record(
        {
          organizationId,
          userId: actorId,
          action: 'trading.uom-conversion.create',
          entityType: 'uom_conversion',
          entityId: conversion.id,
          newData: {
            itemId: conversion.itemId,
            fromUomId: conversion.fromUomId,
            toUomId: conversion.toUomId,
            conversionFactor: conversion.conversionFactor,
          },
        },
        manager,
      );

      return conversion;
    });
  }

  async listUomConversions(
    organizationId: string,
    query: ListUomConversionsQuery,
  ): Promise<[UomConversionEntity[], number]> {
    const qb = this.conversionRepo
      .createQueryBuilder('conversion')
      .leftJoinAndSelect('conversion.fromUom', 'fromUom')
      .leftJoinAndSelect('conversion.toUom', 'toUom')
      .leftJoinAndSelect('conversion.item', 'item')
      .where('conversion.organizationId = :organizationId', { organizationId });

    if (query.itemId) {
      qb.andWhere('conversion.itemId = :itemId', { itemId: query.itemId });
    }

    const [rows, total] = await qb
      .orderBy('conversion.fromUomId', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return [rows, total];
  }

  async getUomConversion(
    organizationId: string,
    id: string,
  ): Promise<UomConversionEntity> {
    const conversion = await this.conversionRepo.findOne({
      where: { id, organizationId },
      relations: { fromUom: true, toUom: true, item: true },
    });
    if (!conversion) throw new UomConversionNotFoundException(id);
    return conversion;
  }

  async deleteUomConversion(
    organizationId: string,
    id: string,
    actorId: string,
  ): Promise<void> {
    const conversion = await this.conversionRepo.findOne({
      where: { id, organizationId },
    });
    if (!conversion) throw new UomConversionNotFoundException(id);

    await this.conversionRepo.softDelete({ id, organizationId });

    await this.auditService.record({
      organizationId,
      userId: actorId,
      action: 'trading.uom-conversion.delete',
      entityType: 'uom_conversion',
      entityId: id,
      oldData: {
        itemId: conversion.itemId,
        fromUomId: conversion.fromUomId,
        toUomId: conversion.toUomId,
      },
    });
  }

  private async requireUomInOrg(
    repo: Repository<UomEntity>,
    organizationId: string,
    id: string,
  ): Promise<void> {
    const found = await repo.findOne({ where: { id, organizationId } });
    if (!found) throw new UomNotFoundException(id);
  }
}
