import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import type { RouteStatus } from './field.constants';
import {
  RouteCodeAlreadyUsedException,
  RouteNotFoundException,
  RouteStatusTransitionException,
} from './field.errors';
import { OutletEntity } from './entities/outlet.entity';
import { OutletRouteEntity } from './entities/outlet-route.entity';
import { RouteAssignmentEntity } from './entities/route-assignment.entity';
import { RouteEntity } from './entities/route.entity';

export interface CreateRouteInput {
  name: string;
  code: string;
  description?: string | null;
  province?: string | null;
  district?: string | null;
}

export interface UpdateRouteInput {
  name?: string;
  code?: string;
  description?: string | null;
  province?: string | null;
  district?: string | null;
  status?: RouteStatus;
}

export interface ListRoutesQuery {
  page: number;
  limit: number;
  search?: string;
  status?: RouteStatus;
}

@Injectable()
export class RouteService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(RouteEntity)
    private readonly routeRepo: Repository<RouteEntity>,
    private readonly auditService: AuditService,
  ) {}

  async createRoute(
    organizationId: string,
    input: CreateRouteInput,
    actorId: string,
  ): Promise<RouteEntity> {
    const dup = await this.routeRepo.findOne({
      where: { organizationId, code: input.code },
    });
    if (dup) throw new RouteCodeAlreadyUsedException(input.code);

    const route = await this.routeRepo.save(
      this.routeRepo.create({
        organizationId,
        name: input.name,
        code: input.code,
        description: input.description ?? null,
        province: input.province ?? null,
        district: input.district ?? null,
        status: 'ACTIVE',
      }),
    );

    await this.auditService.record({
      organizationId,
      userId: actorId,
      action: 'sales.route.create',
      entityType: 'route',
      entityId: route.id,
      newData: { name: route.name, code: route.code },
    });

    return route;
  }

  async listRoutes(
    organizationId: string,
    query: ListRoutesQuery,
  ): Promise<[RouteEntity[], number]> {
    const qb = this.routeRepo
      .createQueryBuilder('route')
      .where('route.organizationId = :organizationId', { organizationId });

    if (query.search) {
      qb.andWhere('(route.name ILIKE :search OR route.code ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }
    if (query.status) {
      qb.andWhere('route.status = :status', { status: query.status });
    }

    const [rows, total] = await qb
      .orderBy('route.name', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return [rows, total];
  }

  async getRoute(organizationId: string, id: string): Promise<RouteEntity> {
    const route = await this.routeRepo.findOne({
      where: { id, organizationId },
    });
    if (!route) throw new RouteNotFoundException(id);
    return route;
  }

  async updateRoute(
    organizationId: string,
    id: string,
    input: UpdateRouteInput,
    actorId: string,
  ): Promise<RouteEntity> {
    const route = await this.routeRepo.findOne({
      where: { id, organizationId },
    });
    if (!route) throw new RouteNotFoundException(id);

    if (input.code && input.code !== route.code) {
      const dup = await this.routeRepo.findOne({
        where: { organizationId, code: input.code },
      });
      if (dup) throw new RouteCodeAlreadyUsedException(input.code);
    }

    if (
      input.status &&
      route.status === 'INACTIVE' &&
      input.status !== 'INACTIVE'
    ) {
      throw new RouteStatusTransitionException(route.status, input.status);
    }

    Object.assign(route, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.code !== undefined ? { code: input.code } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.province !== undefined ? { province: input.province } : {}),
      ...(input.district !== undefined ? { district: input.district } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    });
    const updated = await this.routeRepo.save(route);

    await this.auditService.record({
      organizationId,
      userId: actorId,
      action: 'sales.route.update',
      entityType: 'route',
      entityId: id,
      newData: { name: updated.name, status: updated.status },
    });

    return updated;
  }

  async deleteRoute(
    organizationId: string,
    id: string,
    actorId: string,
  ): Promise<void> {
    const route = await this.routeRepo.findOne({
      where: { id, organizationId },
    });
    if (!route) throw new RouteNotFoundException(id);

    await this.routeRepo.softDelete({ id, organizationId });

    await this.auditService.record({
      organizationId,
      userId: actorId,
      action: 'sales.route.delete',
      entityType: 'route',
      entityId: id,
      oldData: { name: route.name, code: route.code },
    });
  }

  /** Outlets assigned to a route. */
  async listRouteOutlets(
    organizationId: string,
    routeId: string,
  ): Promise<OutletEntity[]> {
    await this.getRoute(organizationId, routeId);
    const links = await this.dataSource.getRepository(OutletRouteEntity).find({
      where: { organizationId, routeId },
    });
    const outletIds = links.map((l) => l.outletId);
    if (outletIds.length === 0) return [];
    const outlets = await this.dataSource
      .getRepository(OutletEntity)
      .find({ where: { id: In(outletIds), organizationId } });
    return outlets.sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Salesman-scoped: routes assigned to the current user. */
  async listMine(
    organizationId: string,
    userId: string,
    query: ListRoutesQuery,
  ): Promise<[RouteEntity[], number]> {
    const assignments = await this.dataSource
      .getRepository(RouteAssignmentEntity)
      .find({ where: { organizationId, userId } });
    const routeIds = assignments.map((a) => a.routeId);
    if (routeIds.length === 0) return [[], 0];

    const qb = this.routeRepo
      .createQueryBuilder('route')
      .where('route.organizationId = :organizationId', { organizationId })
      .andWhere('route.id IN (:...routeIds)', { routeIds });

    if (query.search) {
      qb.andWhere('(route.name ILIKE :search OR route.code ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }
    if (query.status) {
      qb.andWhere('route.status = :status', { status: query.status });
    }

    const [rows, total] = await qb
      .orderBy('route.name', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return [rows, total];
  }
}
