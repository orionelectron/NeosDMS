import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import {
  ItemCategoryCodeAlreadyUsedException,
  ItemCategoryNotFoundException,
} from './trading.errors';
import { ItemCategoryEntity } from './entities/item-category.entity';

export interface CreateItemCategoryInput {
  name: string;
  code?: string | null;
  parentCategoryId?: string | null;
}

export interface UpdateItemCategoryInput {
  name?: string;
  code?: string | null;
  parentCategoryId?: string | null;
  isActive?: boolean;
}

export interface ListItemCategoriesQuery {
  page: number;
  limit: number;
  search?: string;
}

@Injectable()
export class ItemCategoryService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(ItemCategoryEntity)
    private readonly categoryRepo: Repository<ItemCategoryEntity>,
    private readonly auditService: AuditService,
  ) {}

  async createItemCategory(
    organizationId: string,
    input: CreateItemCategoryInput,
    actorId: string,
  ): Promise<ItemCategoryEntity> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(ItemCategoryEntity);

      if (input.code) {
        const dup = await repo.findOne({
          where: { organizationId, code: input.code },
        });
        if (dup) throw new ItemCategoryCodeAlreadyUsedException(input.code);
      }
      if (input.parentCategoryId) {
        await this.requireCategoryInOrg(
          manager.getRepository(ItemCategoryEntity),
          organizationId,
          input.parentCategoryId,
        );
      }

      const category = await repo.save(
        repo.create({
          organizationId,
          name: input.name,
          code: input.code ?? null,
          parentCategoryId: input.parentCategoryId ?? null,
          isActive: true,
        }),
      );

      await this.auditService.record(
        {
          organizationId,
          userId: actorId,
          action: 'trading.item-category.create',
          entityType: 'item_category',
          entityId: category.id,
          newData: { name: category.name, code: category.code },
        },
        manager,
      );

      return category;
    });
  }

  async listItemCategories(
    organizationId: string,
    query: ListItemCategoriesQuery,
  ): Promise<[ItemCategoryEntity[], number]> {
    const qb = this.categoryRepo
      .createQueryBuilder('category')
      .leftJoinAndSelect('category.parentCategory', 'parentCategory')
      .where('category.organizationId = :organizationId', { organizationId });

    if (query.search) {
      qb.andWhere(
        '(category.name ILIKE :search OR category.code ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const [rows, total] = await qb
      .orderBy('category.name', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return [rows, total];
  }

  async getItemCategory(
    organizationId: string,
    id: string,
  ): Promise<ItemCategoryEntity> {
    const category = await this.categoryRepo.findOne({
      where: { id, organizationId },
      relations: { parentCategory: true },
    });
    if (!category) throw new ItemCategoryNotFoundException(id);
    return category;
  }

  async updateItemCategory(
    organizationId: string,
    id: string,
    input: UpdateItemCategoryInput,
    actorId: string,
  ): Promise<ItemCategoryEntity> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(ItemCategoryEntity);
      const category = await repo.findOne({
        where: { id, organizationId },
      });
      if (!category) throw new ItemCategoryNotFoundException(id);

      if (input.code && input.code !== category.code) {
        const dup = await repo.findOne({
          where: { organizationId, code: input.code },
        });
        if (dup) throw new ItemCategoryCodeAlreadyUsedException(input.code);
      }
      if (input.parentCategoryId !== undefined && input.parentCategoryId) {
        if (input.parentCategoryId === id) {
          throw new ItemCategoryNotFoundException(
            'a category cannot be its own parent',
          );
        }
        await this.requireCategoryInOrg(
          repo,
          organizationId,
          input.parentCategoryId,
        );
      }

      Object.assign(category, {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.parentCategoryId !== undefined
          ? { parentCategoryId: input.parentCategoryId }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      });
      const updated = await repo.save(category);

      await this.auditService.record(
        {
          organizationId,
          userId: actorId,
          action: 'trading.item-category.update',
          entityType: 'item_category',
          entityId: id,
          newData: { name: updated.name, code: updated.code },
        },
        manager,
      );

      return updated;
    });
  }

  async deleteItemCategory(
    organizationId: string,
    id: string,
    actorId: string,
  ): Promise<void> {
    const category = await this.categoryRepo.findOne({
      where: { id, organizationId },
    });
    if (!category) throw new ItemCategoryNotFoundException(id);

    await this.categoryRepo.softDelete({ id, organizationId });

    await this.auditService.record({
      organizationId,
      userId: actorId,
      action: 'trading.item-category.delete',
      entityType: 'item_category',
      entityId: id,
      oldData: { name: category.name },
    });
  }

  private async requireCategoryInOrg(
    repo: Repository<ItemCategoryEntity>,
    organizationId: string,
    id: string,
  ): Promise<void> {
    const found = await repo.findOne({ where: { id, organizationId } });
    if (!found) throw new ItemCategoryNotFoundException(id);
  }
}
