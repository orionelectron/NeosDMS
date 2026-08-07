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
  CreatePurchaseReceiptDto,
  PurchaseReceiptQueryDto,
  UpdatePurchaseReceiptDto,
} from './dto/purchase-receipt.dto';
import { PurchaseReceiptService } from './purchase-receipt.service';

@ApiBearerAuth()
@ApiTags('purchase')
@Controller()
export class PurchaseReceiptController {
  constructor(
    private readonly purchaseReceiptService: PurchaseReceiptService,
  ) {}

  @RequirePermission('purchase.receipt.create')
  @Post('purchase/receipts')
  @ApiOperation({ summary: 'Create a goods receipt note draft' })
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreatePurchaseReceiptDto,
  ) {
    return this.purchaseReceiptService.create(tenant.id, actor.id, dto);
  }

  @RequirePermission('purchase.receipt.read')
  @Get('purchase/receipts')
  @ApiOperation({ summary: 'List goods receipt notes' })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: PurchaseReceiptQueryDto,
  ): Promise<Paginated<unknown>> {
    const [data, total] = await this.purchaseReceiptService.list(
      tenant.id,
      query,
    );
    return paginate(data, total, query);
  }

  @RequirePermission('purchase.receipt.read')
  @Get('purchase/receipts/:id')
  @ApiOperation({ summary: 'Get a goods receipt note with lines' })
  get(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.purchaseReceiptService.get(tenant.id, id);
  }

  @RequirePermission('purchase.receipt.update')
  @Patch('purchase/receipts/:id')
  @ApiOperation({ summary: 'Update a draft goods receipt note' })
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseReceiptDto,
  ) {
    return this.purchaseReceiptService.update(tenant.id, actor.id, id, dto);
  }

  @RequirePermission('purchase.receipt.post')
  @Post('purchase/receipts/:id/post')
  @ApiOperation({
    summary: 'Post a draft — GRN number, stock-in inventory transaction',
  })
  post(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.purchaseReceiptService.post(tenant.id, actor.id, id);
  }

  @RequirePermission('purchase.receipt.void')
  @Post('purchase/receipts/:id/void')
  @ApiOperation({ summary: 'Void a draft goods receipt note' })
  voidReceipt(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.purchaseReceiptService.voidReceipt(tenant.id, actor.id, id);
  }
}
