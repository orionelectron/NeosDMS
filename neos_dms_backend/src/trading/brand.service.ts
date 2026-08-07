import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { BrandEntity } from './entities/brand.entity';
import {
  BrandNameAlreadyUsedException,
  BrandNotFoundException,
} from './trading.errors';

export interface CreateBrandInput {
  name: string;
}

export interface UpdateBrandInput {
  name?: string;
  isActive?: boolean;
}

export interface ListBrandsQuery {
  page: number;
  limit: number;
  search?: string;
}

@Injectable()
export class BrandService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(BrandEntity)
    private readonly brandRepo: Repository<BrandEntity>,
    private readonly auditService: AuditService,
  ) {}

  async createBrand(
    organizationId: string,
    input: CreateBrandInput,
    actorId: string,
  ): Promise<BrandEntity> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(BrandEntity);
      const dup = await repo.findOne({
        where: { organizationId, name: input.name },
      });
      if (dup) throw new BrandNameAlreadyUsedException(input.name);

      const brand = await repo.save(
        repo.create({ organizationId, name: input.name, isActive: true }),
      );

      await this.auditService.record(
        {
          organizationId,
          userId: actorId,
          action: 'trading.brand.create',
          entityType: 'brand',
          entityId: brand.id,
          newData: { name: brand.name },
        },
        manager,
      );

      return brand;
    });
  }

  async listBrands(
    organizationId: string,
    query: ListBrandsQuery,
  ): Promise<[BrandEntity[], number]> {
    const qb = this.brandRepo
      .createQueryBuilder('brand')
      .where('brand.organizationId = :organizationId', { organizationId });

    if (query.search) {
      qb.andWhere('brand.name ILIKE :search', { search: `%${query.search}%` });
    }

    const [rows, total] = await qb
      .orderBy('brand.name', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return [rows, total];
  }

  async getBrand(organizationId: string, id: string): Promise<BrandEntity> {
    const brand = await this.brandRepo.findOne({
      where: { id, organizationId },
    });
    if (!brand) throw new BrandNotFoundException(id);
    return brand;
  }

  async updateBrand(
    organizationId: string,
    id: string,
    input: UpdateBrandInput,
    actorId: string,
  ): Promise<BrandEntity> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(BrandEntity);
      const brand = await repo.findOne({ where: { id, organizationId } });
      if (!brand) throw new BrandNotFoundException(id);

      if (input.name && input.name !== brand.name) {
        const dup = await repo.findOne({
          where: { organizationId, name: input.name },
        });
        if (dup) throw new BrandNameAlreadyUsedException(input.name);
      }

      Object.assign(brand, {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      });
      const updated = await repo.save(brand);

      await this.auditService.record(
        {
          organizationId,
          userId: actorId,
          action: 'trading.brand.update',
          entityType: 'brand',
          entityId: id,
          newData: { name: updated.name },
        },
        manager,
      );

      return updated;
    });
  }

  async deleteBrand(
    organizationId: string,
    id: string,
    actorId: string,
  ): Promise<void> {
    const brand = await this.brandRepo.findOne({
      where: { id, organizationId },
    });
    if (!brand) throw new BrandNotFoundException(id);

    await this.brandRepo.softDelete({ id, organizationId });

    await this.auditService.record({
      organizationId,
      userId: actorId,
      action: 'trading.brand.delete',
      entityType: 'brand',
      entityId: id,
      oldData: { name: brand.name },
    });
  }
}
