import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import {
  EARTH_RADIUS_METERS,
  OFF_ROUTE_TOLERANCE_METERS,
} from './field.constants';
import {
  InvalidVisitStatusTransitionException,
  OutletNotFoundException,
  OutletNotOnRouteException,
  OutletVisitNotFoundException,
  RouteNotFoundException,
  SalesmanNotAssignedToRouteException,
} from './field.errors';
import { OutletRouteEntity } from './entities/outlet-route.entity';
import { OutletVisitEntity } from './entities/outlet-visit.entity';
import { OutletEntity } from './entities/outlet.entity';
import { RouteAssignmentEntity } from './entities/route-assignment.entity';
import { RouteEntity } from './entities/route.entity';
import type { VisitStatus, VisitType } from './field.constants';

export interface CreateVisitInput {
  routeId: string;
  outletId: string;
  visitType?: VisitType;
}

export interface CheckInVisitInput {
  latitude: number;
  longitude: number;
  photoKey?: string | null;
  remarks?: string | null;
}

export interface CheckOutVisitInput {
  latitude: number;
  longitude: number;
  photoKey?: string | null;
  remarks?: string | null;
}

export interface ListVisitsQuery {
  page: number;
  limit: number;
  routeId?: string;
  outletId?: string;
  userId?: string;
  status?: VisitStatus;
}

@Injectable()
export class OutletVisitService {
  constructor(
    @InjectRepository(OutletVisitEntity)
    private readonly visitRepo: Repository<OutletVisitEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
  ) {}

  async createVisit(
    organizationId: string,
    input: CreateVisitInput,
    actorId: string,
  ): Promise<OutletVisitEntity> {
    return this.dataSource.transaction(async (manager) => {
      await this.assertCanVisit(
        manager,
        organizationId,
        actorId,
        input.routeId,
        input.outletId,
      );

      const visit = await manager.getRepository(OutletVisitEntity).save(
        manager.getRepository(OutletVisitEntity).create({
          organizationId,
          userId: actorId,
          routeId: input.routeId,
          outletId: input.outletId,
          visitType: input.visitType ?? 'PLANNED',
          status: 'SCHEDULED',
        }),
      );

      await this.auditService.record(
        {
          organizationId,
          userId: actorId,
          action: 'sales.visit.create',
          entityType: 'outlet_visit',
          entityId: visit.id,
          newData: { routeId: visit.routeId, outletId: visit.outletId },
        },
        manager,
      );

      return visit;
    });
  }

  async checkIn(
    organizationId: string,
    visitId: string,
    actorId: string,
    input: CheckInVisitInput,
  ): Promise<OutletVisitEntity> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(OutletVisitEntity);
      const visit = await repo.findOne({
        where: { id: visitId, organizationId },
      });
      if (!visit) throw new OutletVisitNotFoundException(visitId);

      this.assertTransition(visit.status, 'CHECKED_IN');

      const outlet = await manager.getRepository(OutletEntity).findOne({
        where: { id: visit.outletId, organizationId },
      });
      if (!outlet) throw new OutletNotFoundException(visit.outletId);

      const distance = this.haversineDistanceMeters(
        input.latitude,
        input.longitude,
        outlet.latitude ? parseFloat(outlet.latitude) : null,
        outlet.longitude ? parseFloat(outlet.longitude) : null,
      );

      Object.assign(visit, {
        status: 'CHECKED_IN',
        checkedInAt: new Date(),
        checkInLatitude: String(input.latitude),
        checkInLongitude: String(input.longitude),
        distanceFromOutletMeters:
          distance === null ? null : String(distance.toFixed(2)),
        isOffRoute:
          distance === null ? null : distance > OFF_ROUTE_TOLERANCE_METERS,
        photoKey: input.photoKey ?? visit.photoKey,
        remarks: input.remarks ?? visit.remarks,
      });
      const updated = await repo.save(visit);

      await this.auditService.record(
        {
          organizationId,
          userId: actorId,
          action: 'sales.visit.check_in',
          entityType: 'outlet_visit',
          entityId: visitId,
          newData: { status: updated.status, isOffRoute: updated.isOffRoute },
        },
        manager,
      );

      return updated;
    });
  }

  async checkOut(
    organizationId: string,
    visitId: string,
    actorId: string,
    input: CheckOutVisitInput,
  ): Promise<OutletVisitEntity> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(OutletVisitEntity);
      const visit = await repo.findOne({
        where: { id: visitId, organizationId },
      });
      if (!visit) throw new OutletVisitNotFoundException(visitId);

      this.assertTransition(visit.status, 'CHECKED_OUT');

      Object.assign(visit, {
        status: 'CHECKED_OUT',
        checkedOutAt: new Date(),
        checkOutLatitude: String(input.latitude),
        checkOutLongitude: String(input.longitude),
        photoKey: input.photoKey ?? visit.photoKey,
        remarks: input.remarks ?? visit.remarks,
      });
      const updated = await repo.save(visit);

      await this.auditService.record(
        {
          organizationId,
          userId: actorId,
          action: 'sales.visit.check_out',
          entityType: 'outlet_visit',
          entityId: visitId,
          newData: { status: updated.status },
        },
        manager,
      );

      return updated;
    });
  }

  async cancel(
    organizationId: string,
    visitId: string,
    actorId: string,
  ): Promise<OutletVisitEntity> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(OutletVisitEntity);
      const visit = await repo.findOne({
        where: { id: visitId, organizationId },
      });
      if (!visit) throw new OutletVisitNotFoundException(visitId);

      this.assertTransition(visit.status, 'CANCELLED');

      visit.status = 'CANCELLED';
      const updated = await repo.save(visit);

      await this.auditService.record(
        {
          organizationId,
          userId: actorId,
          action: 'sales.visit.cancel',
          entityType: 'outlet_visit',
          entityId: visitId,
          newData: { status: updated.status },
        },
        manager,
      );

      return updated;
    });
  }

  async listVisits(
    organizationId: string,
    query: ListVisitsQuery,
  ): Promise<[OutletVisitEntity[], number]> {
    const qb = this.visitRepo
      .createQueryBuilder('visit')
      .leftJoinAndSelect('visit.outlet', 'outlet')
      .leftJoinAndSelect('visit.route', 'route')
      .leftJoinAndSelect('visit.user', 'user')
      .where('visit.organizationId = :organizationId', { organizationId });

    if (query.routeId) {
      qb.andWhere('visit.routeId = :routeId', { routeId: query.routeId });
    }
    if (query.outletId) {
      qb.andWhere('visit.outletId = :outletId', { outletId: query.outletId });
    }
    if (query.userId) {
      qb.andWhere('visit.userId = :userId', { userId: query.userId });
    }
    if (query.status) {
      qb.andWhere('visit.status = :status', { status: query.status });
    }

    const [rows, total] = await qb
      .orderBy('visit.createdAt', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return [rows, total];
  }

  async getVisit(
    organizationId: string,
    id: string,
  ): Promise<OutletVisitEntity> {
    const visit = await this.visitRepo.findOne({
      where: { id, organizationId },
      relations: { outlet: true, route: true, user: true },
    });
    if (!visit) throw new OutletVisitNotFoundException(id);
    return visit;
  }

  private async assertCanVisit(
    manager: EntityManager,
    organizationId: string,
    userId: string,
    routeId: string,
    outletId: string,
  ): Promise<void> {
    const route = await manager.getRepository(RouteEntity).findOne({
      where: { id: routeId, organizationId },
    });
    if (!route) throw new RouteNotFoundException(routeId);

    const assignment = await manager
      .getRepository(RouteAssignmentEntity)
      .findOne({
        where: { organizationId, userId, routeId },
      });
    if (!assignment) {
      throw new SalesmanNotAssignedToRouteException(userId, routeId);
    }

    const link = await manager.getRepository(OutletRouteEntity).findOne({
      where: { organizationId, outletId, routeId },
    });
    if (!link) throw new OutletNotOnRouteException(outletId, routeId);
  }

  private assertTransition(from: VisitStatus, to: VisitStatus): void {
    const allowed: Record<string, VisitStatus[]> = {
      SCHEDULED: ['CHECKED_IN', 'CANCELLED'],
      CHECKED_IN: ['CHECKED_OUT', 'COMPLETED'],
      CHECKED_OUT: [],
      COMPLETED: [],
      CANCELLED: [],
    };
    if (!allowed[from].includes(to)) {
      throw new InvalidVisitStatusTransitionException(from, to);
    }
  }

  /** Great-circle distance between two coordinates, in meters. */
  private haversineDistanceMeters(
    lat1: number,
    lon1: number,
    lat2: number | null,
    lon2: number | null,
  ): number | null {
    if (lat2 === null || lon2 === null) return null;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a));
  }
}
