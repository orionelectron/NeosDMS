import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AccountEntity } from '../accounting/entities/account.entity';
import { TaxCodeEntity } from '../accounting/entities/tax-code.entity';
import { AuditService } from '../audit/audit.service';
import { PlanLimitService } from '../subscription/plan-limits/plan-limit.service';
import { BrandEntity } from './entities/brand.entity';
import { ItemCategoryEntity } from './entities/item-category.entity';
import { ItemEntity } from './entities/item.entity';
import { UomEntity } from './entities/uom.entity';
import type {
  InventoryTracking,
  ItemType,
  ValuationMethod,
} from './trading.constants';
import {
  AccountNotFoundInOrgException,
  BrandNotFoundException,
  ItemCategoryNotFoundException,
  ItemCodeAlreadyUsedException,
  ItemNotFoundException,
  TaxCodeNotFoundInOrgException,
  UomNotFoundException,
} from './trading.errors';

export interface CreateItemInput {
  name: string;
  code?: string | null;
  sku?: string | null;
  barcode?: string | null;
  description?: string | null;
  type?: ItemType;
  categoryId?: string | null;
  brandId?: string | null;
  baseUomId: string;
  hsnCode?: string | null;
  valuationMethod?: ValuationMethod;
  taxCodeId?: string | null;
  mrp?: string | number;
  salePrice?: string | number;
  standardCost?: string | number;
  reorderLevel?: number;
  inventoryTracking?: InventoryTracking;
  trackExpiry?: boolean;
  allowNegativeStock?: boolean;
  salesAccountId?: string | null;
  purchaseAccountId?: string | null;
  salesReturnAccountId?: string | null;
  purchaseReturnAccountId?: string | null;
}

export interface UpdateItemInput {
  name?: string;
  code?: string | null;
  sku?: string | null;
  barcode?: string | null;
  description?: string | null;
  type?: ItemType;
  categoryId?: string | null;
  brandId?: string | null;
  baseUomId?: string;
  hsnCode?: string | null;
  valuationMethod?: ValuationMethod;
  taxCodeId?: string | null;
  mrp?: string | number;
  salePrice?: string | number;
  standardCost?: string | number;
  reorderLevel?: number;
  inventoryTracking?: InventoryTracking;
  trackExpiry?: boolean;
  allowNegativeStock?: boolean;
  salesAccountId?: string | null;
  purchaseAccountId?: string | null;
  salesReturnAccountId?: string | null;
  purchaseReturnAccountId?: string | null;
  isActive?: boolean;
}

export interface ListItemsQuery {
  page: number;
  limit: number;
  search?: string;
  categoryId?: string;
  brandId?: string;
  isActive?: boolean;
}

@Injectable()
export class ItemService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(ItemEntity)
    private readonly itemRepo: Repository<ItemEntity>,
    private readonly planLimitService: PlanLimitService,
    private readonly auditService: AuditService,
  ) {}

  async createItem(
    organizationId: string,
    input: CreateItemInput,
    actorId: string,
  ): Promise<ItemEntity> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(ItemEntity);

      if (input.code) {
        const dup = await repo.findOne({
          where: { organizationId, code: input.code },
          withDeleted: true,
        });
        if (dup) throw new ItemCodeAlreadyUsedException('code', input.code);
      }
      if (input.sku) {
        const dup = await repo.findOne({
          where: { organizationId, sku: input.sku },
          withDeleted: true,
        });
        if (dup) throw new ItemCodeAlreadyUsedException('SKU', input.sku);
      }

      await this.validateReferences(manager, organizationId, input);

      const currentCount = await repo.count({
        where: { organizationId },
      });
      await this.planLimitService.assertSeat(
        organizationId,
        'items',
        currentCount,
        manager,
      );

      const item = await repo.save(
        repo.create({
          organizationId,
          parentItemId: null,
          name: input.name,
          code: input.code ?? null,
          sku: input.sku ?? null,
          barcode: input.barcode ?? null,
          description: input.description ?? null,
          type: input.type ?? 'GOODS',
          categoryId: input.categoryId ?? null,
          brandId: input.brandId ?? null,
          baseUomId: input.baseUomId,
          hsnCode: input.hsnCode ?? null,
          valuationMethod: input.valuationMethod ?? 'FIFO',
          taxCodeId: input.taxCodeId ?? null,
          mrp: input.mrp === undefined ? '0' : String(input.mrp),
          salePrice:
            input.salePrice === undefined ? '0' : String(input.salePrice),
          standardCost:
            input.standardCost === undefined ? '0' : String(input.standardCost),
          reorderLevel: input.reorderLevel ?? 0,
          inventoryTracking: input.inventoryTracking ?? 'QUANTITY',
          trackExpiry: input.trackExpiry ?? false,
          allowNegativeStock: input.allowNegativeStock ?? false,
          isActive: true,
          salesAccountId: input.salesAccountId ?? null,
          purchaseAccountId: input.purchaseAccountId ?? null,
          salesReturnAccountId: input.salesReturnAccountId ?? null,
          purchaseReturnAccountId: input.purchaseReturnAccountId ?? null,
        }),
      );

      await this.auditService.record(
        {
          organizationId,
          userId: actorId,
          action: 'trading.item.create',
          entityType: 'item',
          entityId: item.id,
          newData: { name: item.name, code: item.code, sku: item.sku },
        },
        manager,
      );

      return item;
    });
  }

  async listItems(
    organizationId: string,
    query: ListItemsQuery,
  ): Promise<[ItemEntity[], number]> {
    const qb = this.itemRepo
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.category', 'category')
      .leftJoinAndSelect('item.brand', 'brand')
      .leftJoinAndSelect('item.baseUom', 'baseUom')
      .leftJoinAndSelect('item.taxCode', 'taxCode')
      .where('item.organizationId = :organizationId', { organizationId });

    if (query.search) {
      qb.andWhere(
        '(item.name ILIKE :search OR item.code ILIKE :search OR item.sku ILIKE :search OR item.barcode ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }
    if (query.categoryId) {
      qb.andWhere('item.categoryId = :categoryId', {
        categoryId: query.categoryId,
      });
    }
    if (query.brandId) {
      qb.andWhere('item.brandId = :brandId', { brandId: query.brandId });
    }
    if (query.isActive !== undefined) {
      qb.andWhere('item.isActive = :isActive', { isActive: query.isActive });
    }

    const [rows, total] = await qb
      .orderBy('item.name', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return [rows, total];
  }

  async getItem(organizationId: string, id: string): Promise<ItemEntity> {
    const item = await this.itemRepo.findOne({
      where: { id, organizationId },
      relations: {
        category: true,
        brand: true,
        baseUom: true,
        taxCode: true,
      },
    });
    if (!item) throw new ItemNotFoundException(id);
    return item;
  }

  async updateItem(
    organizationId: string,
    id: string,
    input: UpdateItemInput,
    actorId: string,
  ): Promise<ItemEntity> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(ItemEntity);
      const item = await repo.findOne({ where: { id, organizationId } });
      if (!item) throw new ItemNotFoundException(id);

      if (input.code && input.code !== item.code) {
        const dup = await repo.findOne({
          where: { organizationId, code: input.code },
          withDeleted: true,
        });
        if (dup) throw new ItemCodeAlreadyUsedException('code', input.code);
      }
      if (input.sku && input.sku !== item.sku) {
        const dup = await repo.findOne({
          where: { organizationId, sku: input.sku },
          withDeleted: true,
        });
        if (dup) throw new ItemCodeAlreadyUsedException('SKU', input.sku);
      }

      await this.validateReferences(manager, organizationId, {
        baseUomId: input.baseUomId ?? item.baseUomId,
        categoryId:
          input.categoryId !== undefined ? input.categoryId : item.categoryId,
        brandId: input.brandId !== undefined ? input.brandId : item.brandId,
        taxCodeId:
          input.taxCodeId !== undefined ? input.taxCodeId : item.taxCodeId,
        salesAccountId:
          input.salesAccountId !== undefined
            ? input.salesAccountId
            : item.salesAccountId,
        purchaseAccountId:
          input.purchaseAccountId !== undefined
            ? input.purchaseAccountId
            : item.purchaseAccountId,
        salesReturnAccountId:
          input.salesReturnAccountId !== undefined
            ? input.salesReturnAccountId
            : item.salesReturnAccountId,
        purchaseReturnAccountId:
          input.purchaseReturnAccountId !== undefined
            ? input.purchaseReturnAccountId
            : item.purchaseReturnAccountId,
      });

      Object.assign(item, {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.sku !== undefined ? { sku: input.sku } : {}),
        ...(input.barcode !== undefined ? { barcode: input.barcode } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.categoryId !== undefined
          ? { categoryId: input.categoryId }
          : {}),
        ...(input.brandId !== undefined ? { brandId: input.brandId } : {}),
        ...(input.baseUomId !== undefined
          ? { baseUomId: input.baseUomId }
          : {}),
        ...(input.hsnCode !== undefined ? { hsnCode: input.hsnCode } : {}),
        ...(input.valuationMethod !== undefined
          ? { valuationMethod: input.valuationMethod }
          : {}),
        ...(input.taxCodeId !== undefined
          ? { taxCodeId: input.taxCodeId }
          : {}),
        ...(input.mrp !== undefined ? { mrp: String(input.mrp) } : {}),
        ...(input.salePrice !== undefined
          ? { salePrice: String(input.salePrice) }
          : {}),
        ...(input.standardCost !== undefined
          ? { standardCost: String(input.standardCost) }
          : {}),
        ...(input.reorderLevel !== undefined
          ? { reorderLevel: input.reorderLevel }
          : {}),
        ...(input.inventoryTracking !== undefined
          ? { inventoryTracking: input.inventoryTracking }
          : {}),
        ...(input.trackExpiry !== undefined
          ? { trackExpiry: input.trackExpiry }
          : {}),
        ...(input.allowNegativeStock !== undefined
          ? { allowNegativeStock: input.allowNegativeStock }
          : {}),
        ...(input.salesAccountId !== undefined
          ? { salesAccountId: input.salesAccountId }
          : {}),
        ...(input.purchaseAccountId !== undefined
          ? { purchaseAccountId: input.purchaseAccountId }
          : {}),
        ...(input.salesReturnAccountId !== undefined
          ? { salesReturnAccountId: input.salesReturnAccountId }
          : {}),
        ...(input.purchaseReturnAccountId !== undefined
          ? { purchaseReturnAccountId: input.purchaseReturnAccountId }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      });
      const updated = await repo.save(item);

      await this.auditService.record(
        {
          organizationId,
          userId: actorId,
          action: 'trading.item.update',
          entityType: 'item',
          entityId: id,
          newData: { name: updated.name, code: updated.code, sku: updated.sku },
        },
        manager,
      );

      return updated;
    });
  }

  async deleteItem(
    organizationId: string,
    id: string,
    actorId: string,
  ): Promise<void> {
    const item = await this.itemRepo.findOne({
      where: { id, organizationId },
    });
    if (!item) throw new ItemNotFoundException(id);

    await this.itemRepo.softDelete({ id, organizationId });

    await this.auditService.record({
      organizationId,
      userId: actorId,
      action: 'trading.item.delete',
      entityType: 'item',
      entityId: id,
      oldData: { name: item.name, code: item.code, sku: item.sku },
    });
  }

  /** Validates that every referenced master belongs to the organization. */
  private async validateReferences(
    manager: EntityManager,
    organizationId: string,
    refs: {
      categoryId?: string | null;
      brandId?: string | null;
      baseUomId?: string;
      taxCodeId?: string | null;
      salesAccountId?: string | null;
      purchaseAccountId?: string | null;
      salesReturnAccountId?: string | null;
      purchaseReturnAccountId?: string | null;
    },
  ): Promise<void> {
    if (refs.categoryId) {
      const found = await manager
        .getRepository(ItemCategoryEntity)
        .findOne({ where: { id: refs.categoryId, organizationId } });
      if (!found) throw new ItemCategoryNotFoundException(refs.categoryId);
    }
    if (refs.brandId) {
      const found = await manager
        .getRepository(BrandEntity)
        .findOne({ where: { id: refs.brandId, organizationId } });
      if (!found) throw new BrandNotFoundException(refs.brandId);
    }
    if (refs.baseUomId) {
      const found = await manager
        .getRepository(UomEntity)
        .findOne({ where: { id: refs.baseUomId, organizationId } });
      if (!found) throw new UomNotFoundException(refs.baseUomId);
    }
    if (refs.taxCodeId) {
      const found = await manager
        .getRepository(TaxCodeEntity)
        .findOne({ where: { id: refs.taxCodeId, organizationId } });
      if (!found) throw new TaxCodeNotFoundInOrgException(refs.taxCodeId);
    }
    for (const [label, accountId] of [
      ['sales account', refs.salesAccountId],
      ['purchase account', refs.purchaseAccountId],
      ['sales return account', refs.salesReturnAccountId],
      ['purchase return account', refs.purchaseReturnAccountId],
    ] as const) {
      if (accountId) {
        const found = await manager
          .getRepository(AccountEntity)
          .findOne({ where: { id: accountId, organizationId } });
        if (!found) throw new AccountNotFoundInOrgException(accountId, label);
      }
    }
  }
}
