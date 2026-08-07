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
  CreatePurchaseBillDto,
  PostPurchaseBillDto,
  PurchaseBillQueryDto,
  UpdatePurchaseBillDto,
} from './dto/purchase-bill.dto';
import { PurchaseBillService } from './purchase-bill.service';

@ApiBearerAuth()
@ApiTags('purchase')
@Controller()
export class PurchaseBillController {
  constructor(private readonly purchaseBillService: PurchaseBillService) {}

  @RequirePermission('purchase.bill.create')
  @Post('purchase/bills')
  @ApiOperation({ summary: 'Create a purchase bill draft' })
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreatePurchaseBillDto,
  ) {
    return this.purchaseBillService.create(tenant.id, actor.id, dto);
  }

  @RequirePermission('purchase.bill.read')
  @Get('purchase/bills')
  @ApiOperation({ summary: 'List purchase bills' })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: PurchaseBillQueryDto,
  ): Promise<Paginated<unknown>> {
    const [data, total] = await this.purchaseBillService.list(tenant.id, query);
    return paginate(data, total, query);
  }

  @RequirePermission('purchase.bill.read')
  @Get('purchase/bills/:id')
  @ApiOperation({ summary: 'Get a purchase bill with lines' })
  get(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.purchaseBillService.get(tenant.id, id);
  }

  @RequirePermission('purchase.bill.update')
  @Patch('purchase/bills/:id')
  @ApiOperation({ summary: 'Update a draft purchase bill' })
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseBillDto,
  ) {
    return this.purchaseBillService.update(tenant.id, actor.id, id, dto);
  }

  @RequirePermission('purchase.bill.post')
  @Post('purchase/bills/:id/post')
  @ApiOperation({
    summary:
      'Post a draft — BILL- number, Inventory/VAT/TDS/AP journal, avg-cost reweight, direct lines stock in',
  })
  post(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: PostPurchaseBillDto,
  ) {
    return this.purchaseBillService.post(tenant.id, actor.id, id, dto);
  }

  @RequirePermission('purchase.bill.void')
  @Post('purchase/bills/:id/void')
  @ApiOperation({ summary: 'Void a draft purchase bill' })
  voidBill(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.purchaseBillService.voidBill(tenant.id, actor.id, id);
  }
}
