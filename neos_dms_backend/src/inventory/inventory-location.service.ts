import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import {
  CreateInventoryLocationDto,
  UpdateInventoryLocationDto,
} from './dto/inventory.dto';
import { InventoryLocationEntity } from './entities/inventory-location.entity';
import { INVENTORY_AUDIT_ACTIONS } from './inventory.constants';
import {
  InventoryLocationCodeAlreadyUsedException,
  InventoryLocationNotFoundException,
} from './inventory.errors';

export interface ListInventoryLocationsQuery {
  page: number;
  limit: number;
}

@Injectable()
export class InventoryLocationService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(InventoryLocationEntity)
    private readonly locationRepo: Repository<InventoryLocationEntity>,
    private readonly auditService: AuditService,
  ) {}

  async createLocation(
    organizationId: string,
    dto: CreateInventoryLocationDto,
    actorId: string,
  ): Promise<InventoryLocationEntity> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(InventoryLocationEntity);

      const existing = await repo.findOne({
        where: { organizationId, code: dto.code },
        withDeleted: true,
      });
      if (existing)
        throw new InventoryLocationCodeAlreadyUsedException(dto.code);

      if (dto.isDefault) {
        await repo.update(
          { organizationId, isDefault: true },
          { isDefault: false },
        );
      }

      const location = await repo.save(
        repo.create({
          organizationId,
          branchId: dto.branchId ?? null,
          name: dto.name,
          code: dto.code,
          locationType: dto.locationType,
          address: dto.address ?? null,
          notes: dto.notes ?? null,
          isDefault: dto.isDefault ?? false,
          isActive: dto.isActive ?? true,
        }),
      );

      await this.auditService.record(
        {
          organizationId,
          userId: actorId,
          action: INVENTORY_AUDIT_ACTIONS.LOCATION_CREATE,
          entityType: 'inventory_location',
          entityId: location.id,
          newData: {
            name: location.name,
            code: location.code,
            locationType: location.locationType,
            isDefault: location.isDefault,
          },
        },
        manager,
      );

      return location;
    });
  }

  async listLocations(
    organizationId: string,
    query: ListInventoryLocationsQuery,
  ): Promise<[InventoryLocationEntity[], number]> {
    const [rows, total] = await this.locationRepo
      .createQueryBuilder('location')
      .where('location.organizationId = :organizationId', { organizationId })
      .orderBy('location.isDefault', 'DESC')
      .addOrderBy('location.name', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return [rows, total];
  }

  async getLocation(
    organizationId: string,
    id: string,
  ): Promise<InventoryLocationEntity> {
    const location = await this.locationRepo.findOne({
      where: { id, organizationId },
    });
    if (!location) throw new InventoryLocationNotFoundException(id);
    return location;
  }

  async updateLocation(
    organizationId: string,
    id: string,
    dto: UpdateInventoryLocationDto,
    actorId: string,
  ): Promise<InventoryLocationEntity> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(InventoryLocationEntity);

      const location = await repo.findOne({ where: { id, organizationId } });
      if (!location) throw new InventoryLocationNotFoundException(id);

      if (dto.isDefault) {
        await repo.update(
          { organizationId, isDefault: true },
          { isDefault: false },
        );
      }

      const updated = await repo.save(
        repo.merge(location, {
          name: dto.name ?? location.name,
          locationType: dto.locationType ?? location.locationType,
          branchId: dto.branchId ?? location.branchId,
          address: dto.address ?? location.address,
          notes: dto.notes ?? location.notes,
          isDefault: dto.isDefault ?? location.isDefault,
          isActive: dto.isActive ?? location.isActive,
        }),
      );

      await this.auditService.record(
        {
          organizationId,
          userId: actorId,
          action: INVENTORY_AUDIT_ACTIONS.LOCATION_UPDATE,
          entityType: 'inventory_location',
          entityId: updated.id,
          newData: {
            name: updated.name,
            locationType: updated.locationType,
            isDefault: updated.isDefault,
            isActive: updated.isActive,
          },
        },
        manager,
      );

      return updated;
    });
  }

  async deleteLocation(
    organizationId: string,
    id: string,
    actorId: string,
  ): Promise<void> {
    const location = await this.locationRepo.findOne({
      where: { id, organizationId },
    });
    if (!location) throw new InventoryLocationNotFoundException(id);

    await this.locationRepo.softDelete({ id, organizationId });

    await this.auditService.record({
      organizationId,
      userId: actorId,
      action: INVENTORY_AUDIT_ACTIONS.LOCATION_DELETE,
      entityType: 'inventory_location',
      entityId: id,
      oldData: { name: location.name, code: location.code },
    });
  }
}
