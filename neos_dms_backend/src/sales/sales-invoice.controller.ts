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
  CreateSalesInvoiceDto,
  PostSalesInvoiceDto,
  SalesInvoiceQueryDto,
  UpdateSalesInvoiceDto,
} from './dto/sales-invoice.dto';
import { SalesInvoiceService } from './sales-invoice.service';
import type { OrderActor } from './sales-order.service';

@ApiBearerAuth()
@ApiTags('sales')
@Controller()
export class SalesInvoiceController {
  constructor(private readonly salesInvoiceService: SalesInvoiceService) {}

  @RequirePermission('sales.invoice.create')
  @Post('sales/invoices')
  @ApiOperation({ summary: 'Create a sales invoice draft against an order' })
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateSalesInvoiceDto,
  ) {
    return this.salesInvoiceService.create(tenant.id, this.toActor(actor), dto);
  }

  @RequirePermission('sales.invoice.read')
  @Get('sales/invoices/mine')
  @ApiOperation({ summary: 'My sales invoices' })
  async mine(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: SalesInvoiceQueryDto,
  ): Promise<Paginated<unknown>> {
    const [data, total] = await this.salesInvoiceService.list(
      tenant.id,
      this.toActor(actor),
      'mine',
      query,
    );
    return paginate(data, total, query);
  }

  @RequirePermission('sales.invoice.read')
  @Get('sales/invoices/team')
  @ApiOperation({ summary: 'Sales invoices of my reportees (manager)' })
  async team(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: SalesInvoiceQueryDto,
  ): Promise<Paginated<unknown>> {
    const [data, total] = await this.salesInvoiceService.list(
      tenant.id,
      this.toActor(actor),
      'team',
      query,
    );
    return paginate(data, total, query);
  }

  @RequirePermission('sales.invoice.read')
  @Get('sales/invoices/all')
  @ApiOperation({ summary: 'All sales invoices in the organization' })
  async all(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: SalesInvoiceQueryDto,
  ): Promise<Paginated<unknown>> {
    const [data, total] = await this.salesInvoiceService.list(
      tenant.id,
      this.toActor(actor),
      'all',
      query,
    );
    return paginate(data, total, query);
  }

  @RequirePermission('sales.invoice.read')
  @Get('sales/invoices/:id')
  @ApiOperation({ summary: 'Get a sales invoice with lines' })
  get(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.salesInvoiceService.get(tenant.id, this.toActor(actor), id);
  }

  @RequirePermission('sales.invoice.update')
  @Patch('sales/invoices/:id')
  @ApiOperation({ summary: 'Update a draft sales invoice' })
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateSalesInvoiceDto,
  ) {
    return this.salesInvoiceService.update(
      tenant.id,
      this.toActor(actor),
      id,
      dto,
    );
  }

  @RequirePermission('sales.invoice.post')
  @Post('sales/invoices/:id/post')
  @ApiOperation({
    summary: 'Post a draft — number, AR/VAT journal, stock-out, CBMS push',
  })
  post(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: PostSalesInvoiceDto,
  ) {
    return this.salesInvoiceService.post(
      tenant.id,
      this.toActor(actor),
      id,
      dto,
    );
  }

  @RequirePermission('sales.invoice.void')
  @Post('sales/invoices/:id/void')
  @ApiOperation({ summary: 'Void a draft sales invoice' })
  voidInvoice(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.salesInvoiceService.voidInvoice(
      tenant.id,
      this.toActor(actor),
      id,
    );
  }

  private toActor(actor: AuthenticatedUser): OrderActor {
    return { id: actor.id, roleCode: actor.role?.roleCode ?? null };
  }
}
