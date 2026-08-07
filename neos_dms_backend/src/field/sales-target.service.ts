import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { UserEntity } from '../iam/entities/user.entity';
import { NepaliDateConverter } from '../nepali-date/nepali-date-converter';
import { BrandEntity } from '../trading/entities/brand.entity';
import { ItemCategoryEntity } from '../trading/entities/item-category.entity';
import {
  CreateSalesTargetDto,
  SalesTargetQueryDto,
  SalesTargetReportQueryDto,
  UpdateSalesTargetDto,
} from './dto/sales-target.dto';
import { SalesTargetEntity } from './entities/sales-target.entity';
import {
  SalesTargetDuplicateException,
  SalesTargetNotFoundException,
  SalesTargetRefNotFoundException,
  SalesTargetTypeConflictException,
  SalesTargetUserNotFoundException,
} from './field.errors';
import type { SalesTargetType } from './field.constants';

@Injectable()
export class SalesTargetService {
  constructor(
    @InjectRepository(SalesTargetEntity)
    private readonly targetRepo: Repository<SalesTargetEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(ItemCategoryEntity)
    private readonly categoryRepo: Repository<ItemCategoryEntity>,
    @InjectRepository(BrandEntity)
    private readonly brandRepo: Repository<BrandEntity>,
    private readonly audit: AuditService,
    private readonly nepaliDate: NepaliDateConverter,
  ) {}

  // ---- Mutations ----------------------------------------------------------

  async createTarget(
    organizationId: string,
    actorId: string,
    dto: CreateSalesTargetDto,
  ): Promise<SalesTargetEntity> {
    const user = await this.userRepo.findOne({
      where: { id: dto.userId, organizationId },
    });
    if (!user) throw new SalesTargetUserNotFoundException();

    const { categoryId, brandId } = await this.resolveDimensions(
      organizationId,
      dto.targetType,
      dto.categoryId,
      dto.brandId,
    );

    const existing = await this.targetRepo.findOne({
      where: {
        organizationId,
        userId: dto.userId,
        bsYear: dto.bsYear,
        bsMonth: dto.bsMonth,
        targetType: dto.targetType,
        ...(categoryId ? { categoryId } : { categoryId: IsNull() }),
        ...(brandId ? { brandId } : { brandId: IsNull() }),
      },
    });
    if (existing) throw new SalesTargetDuplicateException();

    const target = await this.targetRepo.save(
      this.targetRepo.create({
        organizationId,
        userId: dto.userId,
        bsYear: dto.bsYear,
        bsMonth: dto.bsMonth,
        targetType: dto.targetType,
        categoryId: categoryId ?? null,
        brandId: brandId ?? null,
        amount: dto.amount.toFixed(2),
        isActive: true,
      }),
    );

    await this.audit.record({
      organizationId,
      userId: actorId,
      action: 'sales.target.create',
      entityType: 'sales_target',
      entityId: target.id,
      newData: {
        userId: dto.userId,
        period: `${dto.bsYear}-${dto.bsMonth}`,
        targetType: dto.targetType,
        amount: target.amount,
      },
    });
    return target;
  }

  async updateTarget(
    organizationId: string,
    actorId: string,
    id: string,
    dto: UpdateSalesTargetDto,
  ): Promise<SalesTargetEntity> {
    const target = await this.targetRepo.findOne({
      where: { id, organizationId },
    });
    if (!target) throw new SalesTargetNotFoundException();

    if (dto.amount !== undefined) target.amount = dto.amount.toFixed(2);
    if (dto.isActive !== undefined) target.isActive = dto.isActive;

    const saved = await this.targetRepo.save(target);
    await this.audit.record({
      organizationId,
      userId: actorId,
      action: 'sales.target.update',
      entityType: 'sales_target',
      entityId: saved.id,
      newData: { amount: saved.amount, isActive: saved.isActive },
    });
    return saved;
  }

  async deleteTarget(
    organizationId: string,
    actorId: string,
    id: string,
  ): Promise<void> {
    const target = await this.targetRepo.findOne({
      where: { id, organizationId },
    });
    if (!target) throw new SalesTargetNotFoundException();

    await this.targetRepo.softDelete({ id, organizationId });
    await this.audit.record({
      organizationId,
      userId: actorId,
      action: 'sales.target.delete',
      entityType: 'sales_target',
      entityId: target.id,
    });
  }

  // ---- Listing (scoped like leave/travel/attendance) ---------------------

  async listTargets(
    organizationId: string,
    actorId: string,
    query: SalesTargetQueryDto,
    scope: 'mine' | 'team' | 'all',
  ): Promise<SalesTargetEntity[]> {
    const qb = this.targetRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.user', 'user')
      .leftJoinAndSelect('t.category', 'category')
      .leftJoinAndSelect('t.brand', 'brand')
      .where('t.organization_id = :organizationId', { organizationId });

    if (scope === 'mine') {
      qb.andWhere('t.user_id = :actorId', { actorId });
    } else if (scope === 'team') {
      const teamIds = await this.userRepo
        .find({ where: { organizationId, managerId: actorId } })
        .then((rows) => rows.map((r) => r.id));
      if (teamIds.length === 0) return [];
      qb.andWhere('t.user_id IN (:...teamIds)', { teamIds });
    }
    if (query.userId) {
      qb.andWhere('t.user_id = :userId', { userId: query.userId });
    }
    if (query.targetType) {
      qb.andWhere('t.target_type = :targetType', {
        targetType: query.targetType,
      });
    }
    if (query.bsYear) {
      qb.andWhere('t.bs_year = :bsYear', { bsYear: query.bsYear });
    }
    if (query.bsMonth) {
      qb.andWhere('t.bs_month = :bsMonth', { bsMonth: query.bsMonth });
    }
    return qb
      .orderBy('t.bs_year', 'DESC')
      .addOrderBy('t.bs_month', 'DESC')
      .addOrderBy('t.createdAt', 'DESC')
      .getMany();
  }

  // ---- Reports -----------------------------------------------------------

  async monthlyReport(
    organizationId: string,
    actorId: string,
    query: SalesTargetReportQueryDto,
  ): Promise<{
    bsYear: number;
    bsMonth: number;
    rows: Array<{
      userId: string;
      fullName: string;
      personal: string | null;
      categories: Array<{ categoryId: string; name: string; amount: string }>;
      brands: Array<{ brandId: string; name: string; amount: string }>;
    }>;
  }> {
    const today = this.nepaliDate.getTodayBsDate();
    const bsYear = query.bsYear ?? today.bsYear;
    const bsMonth = query.bsMonth ?? today.bsMonth;

    const targets = await this.listTargets(
      organizationId,
      actorId,
      { bsYear, bsMonth, page: 1, limit: 10000 },
      query.scope ?? 'mine',
    );

    const rows = new Map<
      string,
      {
        fullName: string;
        personal: string | null;
        categories: Array<{ categoryId: string; name: string; amount: string }>;
        brands: Array<{ brandId: string; name: string; amount: string }>;
      }
    >();

    for (const target of targets) {
      let row = rows.get(target.userId);
      if (!row) {
        row = {
          fullName: target.user?.fullName ?? 'Unknown',
          personal: null,
          categories: [],
          brands: [],
        };
        rows.set(target.userId, row);
      }
      if (target.targetType === 'PERSONAL') {
        row.personal = target.amount;
      } else if (target.targetType === 'CATEGORY') {
        row.categories.push({
          categoryId: target.categoryId!,
          name: target.category?.name ?? 'Unknown',
          amount: target.amount,
        });
      } else if (target.targetType === 'BRAND') {
        row.brands.push({
          brandId: target.brandId!,
          name: target.brand?.name ?? 'Unknown',
          amount: target.amount,
        });
      }
    }

    return {
      bsYear,
      bsMonth,
      rows: [...rows.entries()].map(([userId, row]) => ({
        userId,
        ...row,
      })),
    };
  }

  // ---- Shared ------------------------------------------------------------

  private async resolveDimensions(
    organizationId: string,
    type: SalesTargetType,
    categoryId?: string,
    brandId?: string,
  ): Promise<{ categoryId: string | null; brandId: string | null }> {
    if (type === 'PERSONAL') {
      if (categoryId || brandId) {
        throw new SalesTargetTypeConflictException(
          'PERSONAL targets cannot reference a category or brand',
        );
      }
      return { categoryId: null, brandId: null };
    }
    if (type === 'CATEGORY') {
      if (!categoryId || brandId) {
        throw new SalesTargetTypeConflictException(
          'CATEGORY targets require a categoryId and no brandId',
        );
      }
      const category = await this.categoryRepo.findOne({
        where: { id: categoryId, organizationId },
      });
      if (!category) throw new SalesTargetRefNotFoundException('category');
      return { categoryId, brandId: null };
    }
    if (!brandId || categoryId) {
      throw new SalesTargetTypeConflictException(
        'BRAND targets require a brandId and no categoryId',
      );
    }
    const brand = await this.brandRepo.findOne({
      where: { id: brandId, organizationId },
    });
    if (!brand) throw new SalesTargetRefNotFoundException('brand');
    return { categoryId: null, brandId };
  }
}
