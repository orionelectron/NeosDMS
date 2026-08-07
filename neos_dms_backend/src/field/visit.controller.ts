import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import type { TenantContext } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Paginated, paginate } from '../common/dto/pagination.dto';
import { RequirePermission } from '../iam/decorators/require-permission.decorator';
import {
  CheckInVisitDto,
  CheckOutVisitDto,
  CreateVisitDto,
  VisitListQueryDto,
} from './dto/visit.dto';
import { OutletVisitService } from './outlet-visit.service';

@ApiBearerAuth()
@ApiTags('field')
@Controller()
export class VisitController {
  constructor(private readonly visitService: OutletVisitService) {}

  @RequirePermission('sales.visit.read')
  @Get('visits')
  @ApiOperation({ summary: 'List outlet visits (paginated)' })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: VisitListQueryDto,
  ): Promise<Paginated<unknown>> {
    const [data, total] = await this.visitService.listVisits(tenant.id, query);
    return paginate(data, total, query);
  }

  @RequirePermission('sales.visit.read')
  @Get('visits/:id')
  @ApiOperation({ summary: 'Get an outlet visit' })
  get(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.visitService.getVisit(tenant.id, id);
  }

  @RequirePermission('sales.visit.create')
  @Post('visits')
  @ApiOperation({
    summary: 'Schedule a visit to an outlet on an assigned route',
  })
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateVisitDto,
  ) {
    return this.visitService.createVisit(tenant.id, dto, actor.id);
  }

  @RequirePermission('sales.visit.update')
  @Post('visits/:id/check-in')
  @ApiOperation({
    summary: 'Check in to a scheduled visit (records GPS + off-route flag)',
  })
  checkIn(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CheckInVisitDto,
  ) {
    return this.visitService.checkIn(tenant.id, id, actor.id, dto);
  }

  @RequirePermission('sales.visit.update')
  @Post('visits/:id/check-out')
  @ApiOperation({ summary: 'Check out from a checked-in visit' })
  checkOut(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CheckOutVisitDto,
  ) {
    return this.visitService.checkOut(tenant.id, id, actor.id, dto);
  }

  @RequirePermission('sales.visit.update')
  @Post('visits/:id/cancel')
  @ApiOperation({ summary: 'Cancel a scheduled visit' })
  cancel(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.visitService.cancel(tenant.id, id, actor.id);
  }
}
