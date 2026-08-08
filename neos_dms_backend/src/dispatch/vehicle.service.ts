import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import {
  CreateVehicleDto,
  UpdateVehicleDto,
  VehicleQueryDto,
} from './dto/vehicle.dto';
import {
  VehicleNotFoundException,
  VehicleRegistrationAlreadyUsedException,
} from './dispatch.errors';
import { DispatchEntity } from './entities/dispatch.entity';
import { VehicleEntity } from './entities/vehicle.entity';

@Injectable()
export class VehicleService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(VehicleEntity)
    private readonly vehicleRepo: Repository<VehicleEntity>,
    private readonly audit: AuditService,
  ) {}

  async create(
    organizationId: string,
    actorId: string,
    dto: CreateVehicleDto,
  ): Promise<VehicleEntity> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(VehicleEntity);
      const dup = await repo.findOne({
        where: { organizationId, registrationNumber: dto.registrationNumber },
      });
      if (dup) {
        throw new VehicleRegistrationAlreadyUsedException(
          dto.registrationNumber,
        );
      }

      const vehicle = await repo.save(
        repo.create({
          organizationId,
          name: dto.name,
          registrationNumber: dto.registrationNumber,
          vehicleType: dto.vehicleType,
          capacityWeightKg: dto.capacityWeightKg?.toFixed(3) ?? null,
          capacityVolumeCbm: dto.capacityVolumeCbm?.toFixed(3) ?? null,
          isActive: dto.isActive ?? true,
          currentDriverId: dto.currentDriverId ?? null,
        }),
      );

      await this.audit.record({
        organizationId,
        userId: actorId,
        action: 'dispatch.vehicle.create',
        entityType: 'vehicle',
        entityId: vehicle.id,
        newData: {
          name: vehicle.name,
          registrationNumber: vehicle.registrationNumber,
          vehicleType: vehicle.vehicleType,
        },
      });

      return vehicle;
    });
  }

  async list(
    organizationId: string,
    query: VehicleQueryDto,
  ): Promise<[VehicleEntity[], number]> {
    const qb = this.vehicleRepo
      .createQueryBuilder('vehicle')
      .where('vehicle.organizationId = :organizationId', { organizationId });

    if (query.isActive !== undefined) {
      qb.andWhere('vehicle.isActive = :isActive', { isActive: query.isActive });
    }
    if (query.search) {
      qb.andWhere(
        '(vehicle.name ILIKE :search OR vehicle.registrationNumber ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const [rows, total] = await qb
      .orderBy('vehicle.name', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return [rows, total];
  }

  async get(organizationId: string, id: string): Promise<VehicleEntity> {
    const vehicle = await this.vehicleRepo.findOne({
      where: { id, organizationId },
    });
    if (!vehicle) throw new VehicleNotFoundException(id);
    return vehicle;
  }

  async update(
    organizationId: string,
    actorId: string,
    id: string,
    dto: UpdateVehicleDto,
  ): Promise<VehicleEntity> {
    const vehicle = await this.vehicleRepo.findOne({
      where: { id, organizationId },
    });
    if (!vehicle) throw new VehicleNotFoundException(id);

    if (
      dto.registrationNumber !== undefined &&
      dto.registrationNumber !== vehicle.registrationNumber
    ) {
      const dup = await this.vehicleRepo.findOne({
        where: {
          organizationId,
          registrationNumber: dto.registrationNumber,
        },
      });
      if (dup)
        throw new VehicleRegistrationAlreadyUsedException(
          dto.registrationNumber,
        );
    }

    if (dto.name !== undefined) vehicle.name = dto.name;
    if (dto.registrationNumber !== undefined)
      vehicle.registrationNumber = dto.registrationNumber;
    if (dto.vehicleType !== undefined) vehicle.vehicleType = dto.vehicleType;
    if (dto.capacityWeightKg !== undefined)
      vehicle.capacityWeightKg = dto.capacityWeightKg.toFixed(3);
    if (dto.capacityVolumeCbm !== undefined)
      vehicle.capacityVolumeCbm = dto.capacityVolumeCbm.toFixed(3);
    if (dto.isActive !== undefined) vehicle.isActive = dto.isActive;
    if (dto.currentDriverId !== undefined)
      vehicle.currentDriverId = dto.currentDriverId;

    const saved = await this.vehicleRepo.save(vehicle);
    await this.audit.record({
      organizationId,
      userId: actorId,
      action: 'dispatch.vehicle.update',
      entityType: 'vehicle',
      entityId: saved.id,
      newData: {
        name: saved.name,
        registrationNumber: saved.registrationNumber,
        isActive: saved.isActive,
      },
    });
    return saved;
  }

  async remove(
    organizationId: string,
    actorId: string,
    id: string,
  ): Promise<void> {
    const vehicle = await this.vehicleRepo.findOne({
      where: { id, organizationId },
    });
    if (!vehicle) throw new VehicleNotFoundException(id);

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(VehicleEntity);
      const dispatched = await manager.getRepository(DispatchEntity).count({
        where: { organizationId, vehicleId: id, status: 'IN_TRANSIT' },
      });
      if (dispatched > 0) {
        throw new VehicleNotFoundException(
          `Vehicle ${id} is still assigned to an in-transit dispatch`,
        );
      }
      await repo.softDelete({ id });
    });

    await this.audit.record({
      organizationId,
      userId: actorId,
      action: 'dispatch.vehicle.delete',
      entityType: 'vehicle',
      entityId: id,
      newData: { deleted: true },
    });
  }
}
