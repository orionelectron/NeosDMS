import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { PartyEntity } from '../accounting/entities/party.entity';
import { AuditService } from '../audit/audit.service';
import type { OutletChannel, OutletStatus } from './field.constants';
import {
  OutletNameAlreadyUsedException,
  OutletNotFoundException,
  OutletNotOnRouteException,
  OutletRouteAlreadyLinkedException,
  RouteNotFoundException,
} from './field.errors';
import { OutletRouteEntity } from './entities/outlet-route.entity';
import { OutletEntity } from './entities/outlet.entity';
import { RouteAssignmentEntity } from './entities/route-assignment.entity';
import { RouteEntity } from './entities/route.entity';

export interface CreateOutletInput {
  name: string;
  partyId?: string | null;
  ownerName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  province?: string | null;
  district?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  photoKey?: string | null;
  description?: string | null;
  channel?: OutletChannel;
  category?: string | null;
}

export interface UpdateOutletInput {
  name?: string;
  partyId?: string | null;
  ownerName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  province?: string | null;
  district?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  photoKey?: string | null;
  description?: string | null;
  channel?: OutletChannel;
  category?: string | null;
  status?: OutletStatus;
}

export interface ListOutletsQuery {
  page: number;
  limit: number;
  search?: string;
  routeId?: string;
  status?: OutletStatus;
}

@Injectable()
export class OutletService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(OutletEntity)
    private readonly outletRepo: Repository<OutletEntity>,
    private readonly auditService: AuditService,
  ) {}

  async createOutlet(
    organizationId: string,
    input: CreateOutletInput,
    actorId: string,
  ): Promise<OutletEntity> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(OutletEntity);
      const dup = await repo.findOne({
        where: { organizationId, name: input.name },
      });
      if (dup) throw new OutletNameAlreadyUsedException(input.name);

      // Provision a customer party in the same txn (decision 23) unless the
      // caller already linked an accounting party.
      let partyId: string | null = input.partyId ?? null;
      if (!partyId) {
        const party = await manager.getRepository(PartyEntity).save(
          manager.getRepository(PartyEntity).create({
            organizationId,
            branchId: null,
            currencyId: null,
            paymentTermId: null,
            name: input.name,
            legalName: input.name,
            partyKind: 'BUSINESS',
            isCustomer: true,
            isSupplier: false,
            isLead: false,
            panNumber: null,
            vatNumber: null,
            email: input.email ?? null,
            phone: input.phone ?? null,
            address: input.address ?? null,
            creditLimit: '0',
            openingBalance: '0',
            isActive: true,
          }),
        );
        partyId = party.id;
      }

      const outlet = await repo.save(
        repo.create({
          organizationId,
          partyId,
          name: input.name,
          ownerName: input.ownerName ?? null,
          email: input.email ?? null,
          phone: input.phone ?? null,
          address: input.address ?? null,
          province: input.province ?? null,
          district: input.district ?? null,
          latitude:
            input.latitude === undefined ? null : String(input.latitude),
          longitude:
            input.longitude === undefined ? null : String(input.longitude),
          photoKey: input.photoKey ?? null,
          description: input.description ?? null,
          channel: input.channel ?? 'GENERAL_TRADE',
          category: input.category ?? null,
          status: 'ACTIVE',
        }),
      );

      await this.auditService.record(
        {
          organizationId,
          userId: actorId,
          action: 'sales.outlet.create',
          entityType: 'outlet',
          entityId: outlet.id,
          newData: { name: outlet.name, partyId: outlet.partyId },
        },
        manager,
      );

      return outlet;
    });
  }

  async listOutlets(
    organizationId: string,
    query: ListOutletsQuery,
  ): Promise<[OutletEntity[], number]> {
    const qb = this.outletRepo
      .createQueryBuilder('outlet')
      .leftJoinAndSelect('outlet.party', 'party')
      .where('outlet.organizationId = :organizationId', { organizationId });

    if (query.search) {
      qb.andWhere(
        '(outlet.name ILIKE :search OR outlet.ownerName ILIKE :search OR outlet.phone ILIKE :search OR outlet.district ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }
    if (query.status) {
      qb.andWhere('outlet.status = :status', { status: query.status });
    }
    if (query.routeId) {
      qb.innerJoin(
        OutletRouteEntity,
        'outletRoute',
        'outletRoute.outletId = outlet.id',
      ).andWhere(
        'outletRoute.routeId = :routeId AND outletRoute.organizationId = :organizationId',
        {
          routeId: query.routeId,
          organizationId,
        },
      );
    }

    const [rows, total] = await qb
      .orderBy('outlet.name', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return [rows, total];
  }

  async getOutlet(organizationId: string, id: string): Promise<OutletEntity> {
    const outlet = await this.outletRepo.findOne({
      where: { id, organizationId },
      relations: { party: true },
    });
    if (!outlet) throw new OutletNotFoundException(id);
    return outlet;
  }

  async updateOutlet(
    organizationId: string,
    id: string,
    input: UpdateOutletInput,
    actorId: string,
  ): Promise<OutletEntity> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(OutletEntity);
      const outlet = await repo.findOne({ where: { id, organizationId } });
      if (!outlet) throw new OutletNotFoundException(id);

      if (input.name && input.name !== outlet.name) {
        const dup = await repo.findOne({
          where: { organizationId, name: input.name },
        });
        if (dup) throw new OutletNameAlreadyUsedException(input.name);
      }

      Object.assign(outlet, {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.partyId !== undefined ? { partyId: input.partyId } : {}),
        ...(input.ownerName !== undefined
          ? { ownerName: input.ownerName }
          : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.address !== undefined ? { address: input.address } : {}),
        ...(input.province !== undefined ? { province: input.province } : {}),
        ...(input.district !== undefined ? { district: input.district } : {}),
        ...(input.latitude !== undefined
          ? {
              latitude: input.latitude === null ? null : String(input.latitude),
            }
          : {}),
        ...(input.longitude !== undefined
          ? {
              longitude:
                input.longitude === null ? null : String(input.longitude),
            }
          : {}),
        ...(input.photoKey !== undefined ? { photoKey: input.photoKey } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.channel !== undefined ? { channel: input.channel } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      });
      const updated = await repo.save(outlet);

      await this.auditService.record(
        {
          organizationId,
          userId: actorId,
          action: 'sales.outlet.update',
          entityType: 'outlet',
          entityId: id,
          newData: { name: updated.name, status: updated.status },
        },
        manager,
      );

      return updated;
    });
  }

  async deleteOutlet(
    organizationId: string,
    id: string,
    actorId: string,
  ): Promise<void> {
    const outlet = await this.outletRepo.findOne({
      where: { id, organizationId },
    });
    if (!outlet) throw new OutletNotFoundException(id);

    await this.outletRepo.softDelete({ id, organizationId });

    await this.auditService.record({
      organizationId,
      userId: actorId,
      action: 'sales.outlet.delete',
      entityType: 'outlet',
      entityId: id,
      oldData: { name: outlet.name },
    });
  }

  /** Links an outlet to a route (junction row). */
  async linkRoute(
    organizationId: string,
    outletId: string,
    routeId: string,
    actorId: string,
  ): Promise<void> {
    await this.assertOutletAndRoute(organizationId, outletId, routeId);
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(OutletRouteEntity);
      const existing = await repo.findOne({
        where: { organizationId, outletId, routeId },
      });
      if (existing) {
        throw new OutletRouteAlreadyLinkedException(outletId, routeId);
      }
      await repo.save(repo.create({ organizationId, outletId, routeId }));
      await this.auditService.record(
        {
          organizationId,
          userId: actorId,
          action: 'sales.outlet.update',
          entityType: 'outlet-route',
          entityId: outletId,
          newData: { outletId, routeId, linked: true },
        },
        manager,
      );
    });
  }

  /** Removes an outlet from a route (junction row). */
  async unlinkRoute(
    organizationId: string,
    outletId: string,
    routeId: string,
    actorId: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(OutletRouteEntity);
      const link = await repo.findOne({
        where: { organizationId, outletId, routeId },
      });
      if (!link) throw new OutletNotOnRouteException(outletId, routeId);
      await repo.delete({ id: link.id });
      await this.auditService.record(
        {
          organizationId,
          userId: actorId,
          action: 'sales.outlet.update',
          entityType: 'outlet-route',
          entityId: outletId,
          newData: { outletId, routeId, linked: false },
        },
        manager,
      );
    });
  }

  /** Salesman-scoped: outlets on routes the user is assigned to. */
  async listMine(
    organizationId: string,
    userId: string,
    query: ListOutletsQuery,
  ): Promise<[OutletEntity[], number]> {
    const assignments = await this.dataSource
      .getRepository(RouteAssignmentEntity)
      .find({ where: { organizationId, userId } });
    const routeIds = assignments.map((a) => a.routeId);
    if (routeIds.length === 0) return [[], 0];

    const links = await this.dataSource
      .getRepository(OutletRouteEntity)
      .find({ where: { organizationId, routeId: In(routeIds) } });
    const outletIds = [...new Set(links.map((l) => l.outletId))];
    if (outletIds.length === 0) return [[], 0];

    const qb = this.outletRepo
      .createQueryBuilder('outlet')
      .leftJoinAndSelect('outlet.party', 'party')
      .where('outlet.organizationId = :organizationId', { organizationId })
      .andWhere('outlet.id IN (:...outletIds)', { outletIds });

    if (query.search) {
      qb.andWhere(
        '(outlet.name ILIKE :search OR outlet.ownerName ILIKE :search OR outlet.phone ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }
    if (query.status) {
      qb.andWhere('outlet.status = :status', { status: query.status });
    }

    const [rows, total] = await qb
      .orderBy('outlet.name', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return [rows, total];
  }

  private async assertOutletAndRoute(
    organizationId: string,
    outletId: string,
    routeId: string,
  ): Promise<void> {
    const outlet = await this.outletRepo.findOne({
      where: { id: outletId, organizationId },
    });
    if (!outlet) throw new OutletNotFoundException(outletId);
    const route = await this.dataSource
      .getRepository(RouteEntity)
      .findOne({ where: { id: routeId, organizationId } });
    if (!route) throw new RouteNotFoundException(routeId);
  }
}
