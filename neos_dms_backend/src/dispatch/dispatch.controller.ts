import {
  Body,
  Controller,
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
import { OrderActor } from '../sales/sales-order.service';
import { DispatchService } from './dispatch.service';
import {
  CreateDispatchDto,
  DeliverStopDto,
  DispatchQueryDto,
  FailStopDto,
  UpdateDispatchDto,
} from './dto/dispatch.dto';

@ApiBearerAuth()
@ApiTags('dispatch')
@Controller()
export class DispatchController {
  constructor(private readonly dispatchService: DispatchService) {}

  @RequirePermission('dispatch.dispatch.create')
  @Post('dispatches')
  @ApiOperation({
    summary:
      'Create a dispatch — allocate eligible CONFIRMED/COMPLETED orders (one stop each) and reserve the DSP- number',
  })
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateDispatchDto,
  ) {
    return this.dispatchService.create(tenant.id, this.toActor(actor), dto);
  }

  @RequirePermission('dispatch.dispatch.read')
  @Get('dispatches')
  @ApiOperation({
    summary: 'List dispatches (drivers see only their own run)',
  })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: DispatchQueryDto,
  ): Promise<Paginated<unknown>> {
    const [data, total] = await this.dispatchService.list(
      tenant.id,
      this.toActor(actor),
      query,
    );
    return paginate(data, total, query);
  }

  @RequirePermission('dispatch.dispatch.read')
  @Get('dispatches/:id')
  @ApiOperation({ summary: 'Get a dispatch with stops and lines' })
  get(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.dispatchService.get(tenant.id, this.toActor(actor), id);
  }

  @RequirePermission('dispatch.dispatch.update')
  @Patch('dispatches/:id')
  @ApiOperation({
    summary: 'Reassign vehicle/driver or update an ALLOCATED dispatch',
  })
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateDispatchDto,
  ) {
    return this.dispatchService.update(tenant.id, this.toActor(actor), id, dto);
  }

  @RequirePermission('dispatch.dispatch.update')
  @Post('dispatches/:id/load')
  @ApiOperation({ summary: 'Mark an ALLOCATED dispatch as loaded' })
  load(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.dispatchService.load(tenant.id, this.toActor(actor), id);
  }

  @RequirePermission('dispatch.dispatch.update')
  @Post('dispatches/:id/depart')
  @ApiOperation({
    summary:
      'Validate stock, post one sales invoice per stop (stamped with the dispatch), and move the run to IN_TRANSIT',
  })
  depart(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.dispatchService.depart(tenant.id, this.toActor(actor), id);
  }

  @RequirePermission('dispatch.dispatch.update')
  @Post('dispatches/:id/complete')
  @ApiOperation({
    summary: 'Complete an IN_TRANSIT dispatch (all stops resolved)',
  })
  complete(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.dispatchService.complete(tenant.id, this.toActor(actor), id);
  }

  @RequirePermission('dispatch.dispatch.update')
  @Post('dispatches/:id/cancel')
  @ApiOperation({
    summary:
      'Cancel an ALLOCATED dispatch and free its orders for reallocation',
  })
  cancel(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.dispatchService.cancel(tenant.id, this.toActor(actor), id);
  }

  @RequirePermission('dispatch.dispatch.read')
  @Get('dispatches/:id/pick-list')
  @ApiOperation({
    summary: 'Per-item base quantities to draw from the source location',
  })
  pickList(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.dispatchService.pickList(tenant.id, this.toActor(actor), id);
  }

  @RequirePermission('dispatch.dispatch.read')
  @Get('dispatches/:id/loading-sheet')
  @ApiOperation({
    summary:
      'Per-stop loading sheet (party, order, lines) with per-item totals for the loaders',
  })
  loadingSheet(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.dispatchService.loadingSheet(
      tenant.id,
      this.toActor(actor),
      id,
    );
  }

  @RequirePermission('dispatch.dispatch.update')
  @Post('dispatches/:dispatchId/stops/:stopId/deliver')
  @ApiOperation({
    summary:
      'Record delivery actuals (delivered and/or short-returned); shortall → PARTIAL automatically',
  })
  deliver(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('dispatchId') dispatchId: string,
    @Param('stopId') stopId: string,
    @Body() dto: DeliverStopDto,
  ) {
    return this.dispatchService.deliver(
      tenant.id,
      this.toActor(actor),
      dispatchId,
      stopId,
      dto,
    );
  }

  @RequirePermission('dispatch.dispatch.update')
  @Post('dispatches/:dispatchId/stops/:stopId/fail')
  @ApiOperation({
    summary:
      'Mark a stop FAILED; the shortfall draft credit note is created at complete',
  })
  fail(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('dispatchId') dispatchId: string,
    @Param('stopId') stopId: string,
    @Body() dto: FailStopDto,
  ) {
    return this.dispatchService.fail(
      tenant.id,
      this.toActor(actor),
      dispatchId,
      stopId,
      dto,
    );
  }

  private toActor(actor: AuthenticatedUser): OrderActor {
    return { id: actor.id, roleCode: actor.role?.roleCode ?? null };
  }
}
