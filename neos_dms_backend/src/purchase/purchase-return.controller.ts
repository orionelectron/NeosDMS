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
  CreatePurchaseReturnDto,
  PostPurchaseReturnDto,
  PurchaseReturnQueryDto,
  UpdatePurchaseReturnDto,
} from './dto/purchase-return.dto';
import { PurchaseReturnService } from './purchase-return.service';

@ApiBearerAuth()
@ApiTags('purchase')
@Controller()
export class PurchaseReturnController {
  constructor(private readonly purchaseReturnService: PurchaseReturnService) {}

  @RequirePermission('purchase.return.create')
  @Post('purchase/returns')
  @ApiOperation({ summary: 'Create a purchase return (debit note) draft' })
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreatePurchaseReturnDto,
  ) {
    return this.purchaseReturnService.create(tenant.id, actor.id, dto);
  }

  @RequirePermission('purchase.return.read')
  @Get('purchase/returns')
  @ApiOperation({ summary: 'List purchase returns' })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: PurchaseReturnQueryDto,
  ): Promise<Paginated<unknown>> {
    const [data, total] = await this.purchaseReturnService.list(
      tenant.id,
      query,
    );
    return paginate(data, total, query);
  }

  @RequirePermission('purchase.return.read')
  @Get('purchase/returns/:id')
  @ApiOperation({ summary: 'Get a purchase return with lines' })
  get(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.purchaseReturnService.get(tenant.id, id);
  }

  @RequirePermission('purchase.return.update')
  @Patch('purchase/returns/:id')
  @ApiOperation({ summary: 'Update a draft purchase return' })
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseReturnDto,
  ) {
    return this.purchaseReturnService.update(tenant.id, actor.id, id, dto);
  }

  @RequirePermission('purchase.return.post')
  @Post('purchase/returns/:id/post')
  @ApiOperation({
    summary:
      'Post a draft — DN- number, reverse Inventory/VAT/TDS/AP journal (bill-sourced), stock-out, returned_quantity stamps',
  })
  post(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: PostPurchaseReturnDto,
  ) {
    return this.purchaseReturnService.post(tenant.id, actor.id, id, dto);
  }

  @RequirePermission('purchase.return.void')
  @Post('purchase/returns/:id/void')
  @ApiOperation({ summary: 'Void a draft purchase return' })
  voidReturn(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.purchaseReturnService.voidReturn(tenant.id, actor.id, id);
  }
}
