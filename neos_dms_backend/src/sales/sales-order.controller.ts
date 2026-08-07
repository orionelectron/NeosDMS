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
import {
  CreateSalesOrderDto,
  SalesOrderQueryDto,
  UpdateSalesOrderDto,
} from './dto/sales-order.dto';
import { OrderActor, SalesOrderService } from './sales-order.service';

@ApiBearerAuth()
@ApiTags('sales')
@Controller()
export class SalesOrderController {
  constructor(private readonly salesOrderService: SalesOrderService) {}

  @RequirePermission('sales.order.create')
  @Post('sales/orders')
  @ApiOperation({ summary: 'Create a sales order (draft)' })
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateSalesOrderDto,
  ) {
    return this.salesOrderService.create(tenant.id, this.toActor(actor), dto);
  }

  @RequirePermission('sales.order.read')
  @Get('sales/orders/mine')
  @ApiOperation({ summary: 'My sales orders' })
  async mine(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: SalesOrderQueryDto,
  ): Promise<Paginated<unknown>> {
    const [data, total] = await this.salesOrderService.list(
      tenant.id,
      this.toActor(actor),
      'mine',
      query,
    );
    return paginate(data, total, query);
  }

  @RequirePermission('sales.order.read')
  @Get('sales/orders/team')
  @ApiOperation({ summary: 'Sales orders of my reportees (manager)' })
  async team(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: SalesOrderQueryDto,
  ): Promise<Paginated<unknown>> {
    const [data, total] = await this.salesOrderService.list(
      tenant.id,
      this.toActor(actor),
      'team',
      query,
    );
    return paginate(data, total, query);
  }

  @RequirePermission('sales.order.complete')
  @Get('sales/orders/all')
  @ApiOperation({ summary: 'All sales orders in the organization' })
  async all(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: SalesOrderQueryDto,
  ): Promise<Paginated<unknown>> {
    const [data, total] = await this.salesOrderService.list(
      tenant.id,
      this.toActor(actor),
      'all',
      query,
    );
    return paginate(data, total, query);
  }

  @RequirePermission('sales.order.read')
  @Get('sales/orders/:id')
  @ApiOperation({ summary: 'Get a sales order with lines' })
  get(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.salesOrderService.get(tenant.id, this.toActor(actor), id);
  }

  @RequirePermission('sales.order.update')
  @Patch('sales/orders/:id')
  @ApiOperation({ summary: 'Update a draft sales order' })
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateSalesOrderDto,
  ) {
    return this.salesOrderService.update(
      tenant.id,
      this.toActor(actor),
      id,
      dto,
    );
  }

  @RequirePermission('sales.order.confirm')
  @Post('sales/orders/:id/confirm')
  @ApiOperation({
    summary: 'Confirm a draft sales order (returns stock warnings)',
  })
  confirm(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.salesOrderService.confirm(tenant.id, this.toActor(actor), id);
  }

  @RequirePermission('sales.order.complete')
  @Post('sales/orders/:id/complete')
  @ApiOperation({ summary: 'Complete a confirmed sales order (manager)' })
  complete(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.salesOrderService.complete(tenant.id, this.toActor(actor), id);
  }

  @RequirePermission('sales.order.cancel')
  @Post('sales/orders/:id/cancel')
  @ApiOperation({ summary: 'Cancel a draft or confirmed sales order' })
  cancel(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.salesOrderService.cancel(tenant.id, this.toActor(actor), id);
  }

  private toActor(actor: AuthenticatedUser): OrderActor {
    return { id: actor.id, roleCode: actor.role?.roleCode ?? null };
  }
}
