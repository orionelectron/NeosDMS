import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import type { CreatePlannedRoutesDto } from './dto/route-planner.dto';
import { OutletRouteEntity } from './entities/outlet-route.entity';
import { OutletEntity } from './entities/outlet.entity';
import { RouteEntity } from './entities/route.entity';
import { generateRouteCode } from './route-code.util';

const LINK_BATCH_SIZE = 500;

export interface PlannerOutlet {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  routeId: string | null;
}

export interface PlannedRouteResult {
  routeId: string;
  name: string;
  code: string;
  created: boolean;
  outlets: number;
  linked: number;
  skipped: number;
}

export interface PlannedRoutesReport {
  dryRun: boolean;
  routesCreated: number;
  linksInserted: number;
  linksSkipped: number;
  routes: PlannedRouteResult[];
}

interface PlannedRouteInput {
  name: string;
  outletIds: string[];
}

interface LinkRow {
  organizationId: string;
  outletId: string;
  routeId: string;
}

@Injectable()
export class RoutePlannerService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Compact feed for the route-planner map: every outlet that has coordinates
   * plus its currently assigned route. Kept intentionally slim (id, name,
   * lat/lng, routeId) so a ~50k-outlet org loads in a single ~2-3 MB request.
   */
  async listOutletsForMap(organizationId: string): Promise<PlannerOutlet[]> {
    const rows = await this.dataSource
      .getRepository(OutletEntity)
      .createQueryBuilder('outlet')
      .leftJoin(
        OutletRouteEntity,
        'link',
        'link.outletId = outlet.id AND link.organizationId = :organizationId',
      )
      .where('outlet.organizationId = :organizationId', { organizationId })
      .andWhere('outlet.latitude IS NOT NULL')
      .andWhere('outlet.longitude IS NOT NULL')
      .select('outlet.id', 'id')
      .addSelect('outlet.name', 'name')
      .addSelect('outlet.latitude', 'latitude')
      .addSelect('outlet.longitude', 'longitude')
      .addSelect('link.routeId', 'routeId')
      .getRawMany<PlannerOutlet>();

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      routeId: row.routeId ?? null,
    }));
  }

  /**
   * Creates planned routes and their outlet-route links atomically: either the
   * whole payload (routes + links + audit row) commits, or nothing does.
   * Routes whose name already exists are reused (import parity); links that
   * already exist are skipped via orIgnore.
   */
  async createPlannedRoutes(
    organizationId: string,
    actorId: string,
    dto: CreatePlannedRoutesDto,
  ): Promise<PlannedRoutesReport> {
    const dryRun = dto.dryRun ?? false;
    const planned = this.normalize(dto.routes ?? []);

    this.assertNoCrossRouteDuplicates(planned);
    const outletIds = this.collectOutletIds(planned);
    await this.assertOutletsExist(organizationId, outletIds);

    if (dryRun) {
      return this.plan(this.dataSource.manager, organizationId, planned, false);
    }

    return this.dataSource.transaction(async (manager) => {
      const result = await this.plan(manager, organizationId, planned, true);
      await this.auditService.record(
        {
          organizationId,
          userId: actorId,
          action: 'sales.route.planner.create',
          entityType: 'route',
          newData: {
            routes: result.routes.map((route) => ({
              name: route.name,
              code: route.code,
              outlets: route.outlets,
            })),
            routesCreated: result.routesCreated,
            linksInserted: result.linksInserted,
            linksSkipped: result.linksSkipped,
          },
        },
        manager,
      );
      return result;
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private normalize(
    routes: CreatePlannedRoutesDto['routes'],
  ): PlannedRouteInput[] {
    return routes
      .map((route) => ({
        name: route.name.trim(),
        outletIds: [...new Set(route.outletIds)],
      }))
      .filter((route) => route.name.length > 0 && route.outletIds.length > 0);
  }

  private collectOutletIds(routes: PlannedRouteInput[]): string[] {
    return [...new Set(routes.flatMap((route) => route.outletIds))];
  }

  private assertNoCrossRouteDuplicates(routes: PlannedRouteInput[]): void {
    const seen = new Map<string, string>();
    for (const route of routes) {
      for (const outletId of route.outletIds) {
        const previous = seen.get(outletId);
        if (previous) {
          throw new BadRequestException(
            `Outlet '${outletId}' is assigned to both route '${previous}' and route '${route.name}'. An outlet can belong to only one planned route.`,
          );
        }
        seen.set(outletId, route.name);
      }
    }
  }

  private async assertOutletsExist(
    organizationId: string,
    outletIds: string[],
  ): Promise<void> {
    if (outletIds.length === 0) return;
    const found = await this.dataSource.getRepository(OutletEntity).find({
      where: { organizationId, id: In(outletIds) },
      select: { id: true },
    });
    const foundIds = new Set(found.map((outlet) => outlet.id));
    const missing = outletIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(
        `These outlets do not exist in this organization: ${missing.join(', ')}`,
      );
    }
  }

  /**
   * Resolves existing-or-new routes, computes exactly which links would be
   * inserted vs skipped, and (when `persist`) writes routes + links. Used for
   * both the dry-run preview and the real atomic commit.
   */
  private async plan(
    manager: EntityManager,
    organizationId: string,
    planned: PlannedRouteInput[],
    persist: boolean,
  ): Promise<PlannedRoutesReport> {
    const routeRepo = manager.getRepository(RouteEntity);
    const linkRepo = manager.getRepository(OutletRouteEntity);

    const existingRoutes = await routeRepo.find({
      where: { organizationId },
      select: { id: true, name: true, code: true },
    });
    const routeIdByName = new Map(
      existingRoutes.map((route) => [
        route.name.trim().toLowerCase(),
        route.id,
      ]),
    );
    const usedCodes = new Set(
      existingRoutes.map((route) => route.code.toUpperCase()),
    );

    const outletIds = this.collectOutletIds(planned);
    const existingLinks = outletIds.length
      ? await linkRepo.find({
          where: { organizationId, outletId: In(outletIds) },
          select: { outletId: true, routeId: true },
        })
      : [];
    const routeIdsByOutlet = new Map<string, Set<string>>();
    for (const link of existingLinks) {
      const set = routeIdsByOutlet.get(link.outletId) ?? new Set<string>();
      set.add(link.routeId);
      routeIdsByOutlet.set(link.outletId, set);
    }

    const routes: PlannedRouteResult[] = [];
    const rows: LinkRow[] = [];
    let routesCreated = 0;
    let pendingSequence = 0;

    for (const route of planned) {
      const key = route.name.toLowerCase();
      let routeId = routeIdByName.get(key);
      let created = false;
      let code = '';

      if (routeId) {
        code =
          existingRoutes.find((existing) => existing.id === routeId)?.code ??
          '';
      } else {
        code = generateRouteCode(route.name, usedCodes);
        usedCodes.add(code.toUpperCase());
        created = true;
        routesCreated += 1;
        if (persist) {
          const saved = await routeRepo.save(
            routeRepo.create({
              organizationId,
              name: route.name,
              code,
              description: null,
              province: null,
              district: null,
              status: 'ACTIVE',
            }),
          );
          routeId = saved.id;
        } else {
          routeId = `pending-${(pendingSequence += 1)}`;
        }
        routeIdByName.set(key, routeId);
      }

      let linked = 0;
      let skipped = 0;
      for (const outletId of route.outletIds) {
        const existingRouteIds = routeIdsByOutlet.get(outletId);
        if (existingRouteIds && existingRouteIds.size > 0) {
          skipped += 1;
          continue;
        }
        linked += 1;
        rows.push({ organizationId, outletId, routeId });
      }

      routes.push({
        routeId,
        name: route.name,
        code,
        created,
        outlets: route.outletIds.length,
        linked,
        skipped,
      });
    }

    let linksInserted = 0;
    if (persist && rows.length > 0) {
      for (let i = 0; i < rows.length; i += LINK_BATCH_SIZE) {
        const batch = rows.slice(i, i + LINK_BATCH_SIZE);
        await linkRepo
          .createQueryBuilder()
          .insert()
          .values(batch)
          .orIgnore()
          .execute();
        linksInserted += batch.length;
      }
    } else {
      linksInserted = rows.length;
    }

    const linksSkipped = routes.reduce((sum, route) => sum + route.skipped, 0);
    return {
      dryRun: !persist,
      routesCreated,
      linksInserted,
      linksSkipped,
      routes,
    };
  }
}
