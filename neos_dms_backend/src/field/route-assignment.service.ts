import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { UserEntity } from '../iam/entities/user.entity';
import { UserNotFoundException } from '../iam/iam.errors';
import {
  RouteAlreadyAssignedException,
  RouteAssignmentNotFoundException,
  RouteNotFoundException,
} from './field.errors';
import { RouteAssignmentEntity } from './entities/route-assignment.entity';
import { RouteEntity } from './entities/route.entity';

export interface CreateRouteAssignmentInput {
  userId: string;
  routeId: string;
  weekdays?: number[];
}

export interface UpdateRouteAssignmentInput {
  weekdays?: number[];
}

export interface ListRouteAssignmentsQuery {
  page: number;
  limit: number;
  routeId?: string;
  userId?: string;
}

@Injectable()
export class RouteAssignmentService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(RouteAssignmentEntity)
    private readonly assignmentRepo: Repository<RouteAssignmentEntity>,
    private readonly auditService: AuditService,
  ) {}

  async createAssignment(
    organizationId: string,
    input: CreateRouteAssignmentInput,
    actorId: string,
  ): Promise<RouteAssignmentEntity> {
    await this.assertUserAndRoute(organizationId, input.userId, input.routeId);

    const existing = await this.assignmentRepo.findOne({
      where: { organizationId, userId: input.userId, routeId: input.routeId },
    });
    if (existing) {
      throw new RouteAlreadyAssignedException(input.routeId, input.userId);
    }

    const assignment = await this.assignmentRepo.save(
      this.assignmentRepo.create({
        organizationId,
        userId: input.userId,
        routeId: input.routeId,
        weekdays: input.weekdays ?? [],
      }),
    );

    await this.auditService.record({
      organizationId,
      userId: actorId,
      action: 'sales.route_assignment.create',
      entityType: 'route_assignment',
      entityId: assignment.id,
      newData: { userId: assignment.userId, routeId: assignment.routeId },
    });

    return assignment;
  }

  async listAssignments(
    organizationId: string,
    query: ListRouteAssignmentsQuery,
  ): Promise<[RouteAssignmentEntity[], number]> {
    const qb = this.assignmentRepo
      .createQueryBuilder('assignment')
      .leftJoinAndSelect('assignment.user', 'user')
      .leftJoinAndSelect('assignment.route', 'route')
      .where('assignment.organizationId = :organizationId', { organizationId });

    if (query.routeId) {
      qb.andWhere('assignment.routeId = :routeId', { routeId: query.routeId });
    }
    if (query.userId) {
      qb.andWhere('assignment.userId = :userId', { userId: query.userId });
    }

    const [rows, total] = await qb
      .orderBy('assignment.createdAt', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return [rows, total];
  }

  async updateAssignment(
    organizationId: string,
    id: string,
    input: UpdateRouteAssignmentInput,
    actorId: string,
  ): Promise<RouteAssignmentEntity> {
    const assignment = await this.assignmentRepo.findOne({
      where: { id, organizationId },
    });
    if (!assignment) throw new RouteAssignmentNotFoundException(id);

    if (input.weekdays !== undefined) {
      assignment.weekdays = input.weekdays;
    }
    const updated = await this.assignmentRepo.save(assignment);

    await this.auditService.record({
      organizationId,
      userId: actorId,
      action: 'sales.route_assignment.update',
      entityType: 'route_assignment',
      entityId: id,
      newData: { weekdays: updated.weekdays },
    });

    return updated;
  }

  async deleteAssignment(
    organizationId: string,
    id: string,
    actorId: string,
  ): Promise<void> {
    const assignment = await this.assignmentRepo.findOne({
      where: { id, organizationId },
    });
    if (!assignment) throw new RouteAssignmentNotFoundException(id);

    await this.assignmentRepo.delete({ id, organizationId });

    await this.auditService.record({
      organizationId,
      userId: actorId,
      action: 'sales.route_assignment.delete',
      entityType: 'route_assignment',
      entityId: id,
      oldData: { userId: assignment.userId, routeId: assignment.routeId },
    });
  }

  private async assertUserAndRoute(
    organizationId: string,
    userId: string,
    routeId: string,
  ): Promise<void> {
    const user = await this.dataSource.getRepository(UserEntity).findOne({
      where: { id: userId, organizationId },
    });
    if (!user) throw new UserNotFoundException();

    const route = await this.dataSource.getRepository(RouteEntity).findOne({
      where: { id: routeId, organizationId },
    });
    if (!route) throw new RouteNotFoundException(routeId);
  }
}
