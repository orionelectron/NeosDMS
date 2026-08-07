import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import type { TenantContext } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Paginated, paginate } from '../common/dto/pagination.dto';
import { RequirePermission } from '../iam/decorators/require-permission.decorator';
import {
  CreateRouteDto,
  RouteListQueryDto,
  UpdateRouteDto,
} from './dto/route.dto';
import { RouteService } from './route.service';

@ApiBearerAuth()
@ApiTags('field')
@Controller()
export class RouteController {
  constructor(private readonly routeService: RouteService) {}

  @RequirePermission('sales.route.read')
  @Get('routes')
  @ApiOperation({ summary: 'List routes (paginated)' })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: RouteListQueryDto,
  ): Promise<Paginated<unknown>> {
    const [data, total] = await this.routeService.listRoutes(tenant.id, query);
    return paginate(data, total, query);
  }

  @RequirePermission('sales.route.read')
  @Get('routes/mine')
  @ApiOperation({ summary: 'List routes assigned to the current user' })
  async listMine(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: RouteListQueryDto,
  ): Promise<Paginated<unknown>> {
    const [data, total] = await this.routeService.listMine(
      tenant.id,
      actor.id,
      query,
    );
    return paginate(data, total, query);
  }

  @RequirePermission('sales.route.read')
  @Get('routes/:id')
  @ApiOperation({ summary: 'Get a route' })
  get(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.routeService.getRoute(tenant.id, id);
  }

  @RequirePermission('sales.route.read')
  @Get('routes/:id/outlets')
  @ApiOperation({ summary: 'List outlets on a route' })
  listOutlets(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.routeService.listRouteOutlets(tenant.id, id);
  }

  @RequirePermission('sales.route.create')
  @Post('routes')
  @ApiOperation({ summary: 'Create a route' })
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateRouteDto,
  ) {
    return this.routeService.createRoute(tenant.id, dto, actor.id);
  }

  @RequirePermission('sales.route.update')
  @Patch('routes/:id')
  @ApiOperation({ summary: 'Update a route' })
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateRouteDto,
  ) {
    return this.routeService.updateRoute(tenant.id, id, dto, actor.id);
  }

  @RequirePermission('sales.route.delete')
  @Delete('routes/:id')
  @ApiOperation({ summary: 'Soft-delete a route' })
  async remove(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.routeService.deleteRoute(tenant.id, id, actor.id);
    return { deleted: true };
  }
}
