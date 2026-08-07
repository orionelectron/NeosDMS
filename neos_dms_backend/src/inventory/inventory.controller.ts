import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import type { TenantContext } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import {
  Paginated,
  paginate,
  PaginationQueryDto,
} from '../common/dto/pagination.dto';
import { RequirePermission } from '../iam/decorators/require-permission.decorator';
import {
  InventoryBalanceQueryDto,
  InventoryTransactionQueryDto,
  OpeningStockDto,
  StockAdjustmentDto,
  StockTransferDto,
} from './dto/inventory.dto';
import { InventoryService } from './inventory.service';

@ApiBearerAuth()
@ApiTags('inventory')
@Controller()
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @RequirePermission('inventory.transaction.create')
  @Post('inventory/opening-stock')
  @ApiOperation({ summary: 'Post opening stock for a location' })
  opening(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: OpeningStockDto,
  ) {
    return this.inventoryService.postOpening(tenant.id, dto, actor.id);
  }

  @RequirePermission('inventory.transaction.adjust')
  @Post('inventory/adjustments')
  @ApiOperation({ summary: 'Post a stock adjustment (IN/OUT) for a location' })
  adjustment(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: StockAdjustmentDto,
  ) {
    return this.inventoryService.postAdjustment(tenant.id, dto, actor.id);
  }

  @RequirePermission('inventory.transaction.create')
  @Post('inventory/transfers')
  @ApiOperation({ summary: 'Transfer stock between two locations' })
  transfer(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: StockTransferDto,
  ) {
    return this.inventoryService.postTransfer(tenant.id, dto, actor.id);
  }

  @RequirePermission('inventory.transaction.read')
  @Get('inventory/transactions')
  @ApiOperation({ summary: 'List inventory transactions (paginated)' })
  async listTransactions(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: InventoryTransactionQueryDto,
  ): Promise<Paginated<unknown>> {
    const [data, total] = await this.inventoryService.listTransactions(
      tenant.id,
      query,
    );
    return paginate(data, total, query);
  }

  @RequirePermission('inventory.transaction.read')
  @Get('inventory/transactions/:id')
  @ApiOperation({ summary: 'Get an inventory transaction with lines' })
  getTransaction(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.inventoryService.getTransaction(tenant.id, id);
  }

  @RequirePermission('inventory.balance.read')
  @Get('inventory/balances')
  @ApiOperation({ summary: 'List on-hand balances (per location × item)' })
  async listBalances(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: InventoryBalanceQueryDto,
  ): Promise<Paginated<unknown>> {
    const [data, total] = await this.inventoryService.listBalances(
      tenant.id,
      query,
    );
    return paginate(data, total, query);
  }

  @RequirePermission('inventory.balance.read')
  @Get('inventory/balances/low-stock')
  @ApiOperation({ summary: 'Low-stock report (on-hand <= reorder level)' })
  async lowStock(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<unknown>> {
    const [data, total] = await this.inventoryService.lowStock(
      tenant.id,
      query,
    );
    return paginate(data, total, query);
  }
}
