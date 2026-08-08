import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import type { TenantContext } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../iam/decorators/require-permission.decorator';
import { CreatePlannedRoutesDto } from './dto/route-planner.dto';
import { RoutePlannerService } from './route-planner.service';

@ApiBearerAuth()
@ApiTags('field')
@Controller('route-planner')
export class RoutePlannerController {
  constructor(private readonly routePlannerService: RoutePlannerService) {}

  @RequirePermission('sales.route.read')
  @Get('outlets')
  @ApiOperation({
    summary:
      'Compact outlet feed (id, name, lat/lng, current route) for the route planner map',
  })
  listOutlets(@CurrentTenant() tenant: TenantContext) {
    return this.routePlannerService.listOutletsForMap(tenant.id);
  }

  @RequirePermission('sales.route.create')
  @Post('routes')
  @ApiOperation({
    summary:
      'Atomically create planned routes and link their outlets in bulk (dryRun=true previews without writing)',
  })
  createPlannedRoutes(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreatePlannedRoutesDto,
  ) {
    return this.routePlannerService.createPlannedRoutes(
      tenant.id,
      actor.id,
      dto,
    );
  }
}
