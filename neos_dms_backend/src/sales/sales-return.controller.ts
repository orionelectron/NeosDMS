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
  CreateSalesReturnDto,
  PostSalesReturnDto,
  SalesReturnQueryDto,
  UpdateSalesReturnDto,
} from './dto/sales-return.dto';
import { SalesReturnService } from './sales-return.service';

@ApiBearerAuth()
@ApiTags('sales')
@Controller()
export class SalesReturnController {
  constructor(private readonly salesReturnService: SalesReturnService) {}

  @RequirePermission('sales.return.create')
  @Post('sales/returns')
  @ApiOperation({ summary: 'Create a sales return (credit note) draft' })
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateSalesReturnDto,
  ) {
    return this.salesReturnService.create(tenant.id, actor.id, dto);
  }

  @RequirePermission('sales.return.read')
  @Get('sales/returns')
  @ApiOperation({ summary: 'List sales returns' })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: SalesReturnQueryDto,
  ): Promise<Paginated<unknown>> {
    const [data, total] = await this.salesReturnService.list(tenant.id, query);
    return paginate(data, total, query);
  }

  @RequirePermission('sales.return.read')
  @Get('sales/returns/:id')
  @ApiOperation({ summary: 'Get a sales return with lines' })
  get(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.salesReturnService.get(tenant.id, id);
  }

  @RequirePermission('sales.return.update')
  @Patch('sales/returns/:id')
  @ApiOperation({ summary: 'Update a draft sales return' })
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateSalesReturnDto,
  ) {
    return this.salesReturnService.update(tenant.id, actor.id, id, dto);
  }

  @RequirePermission('sales.return.post')
  @Post('sales/returns/:id/post')
  @ApiOperation({
    summary:
      'Post a draft — CN- number, reverse Sales/VAT/AR journal + Inventory/COGS restoration, stock-in, returned_quantity stamps',
  })
  post(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: PostSalesReturnDto,
  ) {
    return this.salesReturnService.post(tenant.id, actor.id, id, dto);
  }

  @RequirePermission('sales.return.void')
  @Post('sales/returns/:id/void')
  @ApiOperation({ summary: 'Void a draft sales return' })
  voidReturn(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.salesReturnService.voidReturn(tenant.id, actor.id, id);
  }
}
