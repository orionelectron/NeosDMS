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
  CreateCustomerReceiptDto,
  CustomerReceiptQueryDto,
  UpdateCustomerReceiptDto,
} from './dto/customer-receipt.dto';
import { CustomerReceiptService } from './customer-receipt.service';

@ApiBearerAuth()
@ApiTags('sales')
@Controller()
export class CustomerReceiptController {
  constructor(
    private readonly customerReceiptService: CustomerReceiptService,
  ) {}

  @RequirePermission('sales.receipt.create')
  @Post('sales/receipts')
  @ApiOperation({ summary: 'Create a customer receipt draft' })
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateCustomerReceiptDto,
  ) {
    return this.customerReceiptService.create(tenant.id, actor.id, dto);
  }

  @RequirePermission('sales.receipt.read')
  @Get('sales/receipts')
  @ApiOperation({ summary: 'List customer receipts' })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: CustomerReceiptQueryDto,
  ): Promise<Paginated<unknown>> {
    const [data, total] = await this.customerReceiptService.list(
      tenant.id,
      query,
    );
    return paginate(data, total, query);
  }

  @RequirePermission('sales.receipt.read')
  @Get('sales/receipts/:id')
  @ApiOperation({ summary: 'Get a customer receipt with allocations' })
  get(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.customerReceiptService.get(tenant.id, id);
  }

  @RequirePermission('sales.receipt.update')
  @Patch('sales/receipts/:id')
  @ApiOperation({ summary: 'Update a draft customer receipt' })
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerReceiptDto,
  ) {
    return this.customerReceiptService.update(tenant.id, actor.id, id, dto);
  }

  @RequirePermission('sales.receipt.post')
  @Post('sales/receipts/:id/post')
  @ApiOperation({
    summary:
      'Post a draft — RCV- number, DR receipt account / CR AR journal, invoice paid/balance stamps',
  })
  post(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.customerReceiptService.post(tenant.id, actor.id, id);
  }

  @RequirePermission('sales.receipt.void')
  @Post('sales/receipts/:id/void')
  @ApiOperation({ summary: 'Void a draft customer receipt' })
  voidReceipt(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.customerReceiptService.voidReceipt(tenant.id, actor.id, id);
  }
}
