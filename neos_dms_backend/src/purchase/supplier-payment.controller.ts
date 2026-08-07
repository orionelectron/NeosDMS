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
  CreateSupplierPaymentDto,
  SupplierPaymentQueryDto,
  UpdateSupplierPaymentDto,
} from './dto/supplier-payment.dto';
import { SupplierPaymentService } from './supplier-payment.service';

@ApiBearerAuth()
@ApiTags('purchase')
@Controller()
export class SupplierPaymentController {
  constructor(
    private readonly supplierPaymentService: SupplierPaymentService,
  ) {}

  @RequirePermission('purchase.payment.create')
  @Post('purchase/payments')
  @ApiOperation({ summary: 'Create a supplier payment draft' })
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateSupplierPaymentDto,
  ) {
    return this.supplierPaymentService.create(tenant.id, actor.id, dto);
  }

  @RequirePermission('purchase.payment.read')
  @Get('purchase/payments')
  @ApiOperation({ summary: 'List supplier payments' })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: SupplierPaymentQueryDto,
  ): Promise<Paginated<unknown>> {
    const [data, total] = await this.supplierPaymentService.list(
      tenant.id,
      query,
    );
    return paginate(data, total, query);
  }

  @RequirePermission('purchase.payment.read')
  @Get('purchase/payments/:id')
  @ApiOperation({ summary: 'Get a supplier payment with allocations' })
  get(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.supplierPaymentService.get(tenant.id, id);
  }

  @RequirePermission('purchase.payment.update')
  @Patch('purchase/payments/:id')
  @ApiOperation({ summary: 'Update a draft supplier payment' })
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateSupplierPaymentDto,
  ) {
    return this.supplierPaymentService.update(tenant.id, actor.id, id, dto);
  }

  @RequirePermission('purchase.payment.post')
  @Post('purchase/payments/:id/post')
  @ApiOperation({
    summary:
      'Post a draft — PMT- number, DR AP / CR payment-account journal, bill paid/balance stamps',
  })
  post(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.supplierPaymentService.post(tenant.id, actor.id, id);
  }

  @RequirePermission('purchase.payment.void')
  @Post('purchase/payments/:id/void')
  @ApiOperation({ summary: 'Void a draft supplier payment' })
  voidPayment(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.supplierPaymentService.voidPayment(tenant.id, actor.id, id);
  }
}
