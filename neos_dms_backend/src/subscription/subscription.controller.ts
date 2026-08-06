import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import type { TenantContext } from '../common/decorators/current-tenant.decorator';
import {
  Paginated,
  PaginationQueryDto,
  paginate,
} from '../common/dto/pagination.dto';
import { TenantHeaderGuard } from './plan-limits/tenant-header.guard';
import { PlanLimitService } from './plan-limits/plan-limit.service';
import { SubscriptionService } from './subscription.service';
import { ChangePlanDto } from './dto/change-plan.dto';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import { GatewayWebhookDto, RecordPaymentDto } from './dto/payment.dto';

@ApiTags('subscription')
@Controller()
export class SubscriptionController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly planLimitService: PlanLimitService,
  ) {}

  @Get('subscription/plans')
  @ApiOperation({ summary: 'Public plan catalog with current pricing' })
  getPlans() {
    return this.subscriptionService.getCatalog();
  }

  @UseGuards(TenantHeaderGuard)
  @Get('subscriptions')
  @ApiOperation({ summary: 'Current subscription for the organization' })
  async getSubscription(@CurrentTenant() tenant: TenantContext) {
    return this.subscriptionService.getActive(tenant.id);
  }

  @UseGuards(TenantHeaderGuard)
  @Post('subscriptions/change-plan')
  @HttpCode(200)
  @ApiOperation({ summary: 'Upgrade or downgrade the organization plan' })
  changePlan(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: ChangePlanDto,
  ) {
    return this.subscriptionService.changePlan(
      tenant.id,
      dto.planCode,
      dto.periodName,
      null,
    );
  }

  @UseGuards(TenantHeaderGuard)
  @Post('subscriptions/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel the active subscription' })
  async cancel(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CancelSubscriptionDto,
  ) {
    await this.subscriptionService.cancel(tenant.id, dto.reason ?? null, null);
    return { canceled: true };
  }

  @UseGuards(TenantHeaderGuard)
  @Get('subscriptions/usage')
  @ApiOperation({ summary: 'Usage snapshot: current vs limit per resource' })
  getUsage(@CurrentTenant() tenant: TenantContext) {
    return this.planLimitService.usageSnapshot(tenant.id);
  }

  @UseGuards(TenantHeaderGuard)
  @Get('subscriptions/history')
  @ApiOperation({ summary: 'Subscription state timeline (paginated)' })
  async history(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<unknown>> {
    const [data, total] = await this.subscriptionService.history(
      tenant.id,
      query.page,
      query.limit,
    );
    return paginate(data, total, query);
  }

  @UseGuards(TenantHeaderGuard)
  @Get('subscriptions/transactions')
  @ApiOperation({ summary: 'Payment transactions (paginated)' })
  async transactions(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<unknown>> {
    const [data, total] = await this.subscriptionService.transactions(
      tenant.id,
      query.page,
      query.limit,
    );
    return paginate(data, total, query);
  }

  @Post('subscriptions/webhook')
  @ApiOperation({
    summary: 'Billing gateway webhook hook point (Phase 1 stub)',
  })
  async webhook(@Body() dto: GatewayWebhookDto) {
    const payload = dto.payload ?? {};
    const gatewayTransactionId =
      typeof payload.gateway_transaction_id === 'string'
        ? payload.gateway_transaction_id
        : undefined;
    const invoiceNumber =
      typeof payload.invoice_number === 'string'
        ? payload.invoice_number
        : undefined;
    const amount =
      typeof payload.amount === 'string' ? payload.amount : undefined;
    const organizationId =
      typeof payload.organization_id === 'string'
        ? payload.organization_id
        : undefined;

    if (
      dto.event === 'payment.completed' &&
      gatewayTransactionId &&
      invoiceNumber &&
      amount &&
      organizationId
    ) {
      await this.subscriptionService.recordPayment({
        organizationId,
        invoiceNumber,
        amount,
        paymentGateway: dto.gateway,
        gatewayTransactionId,
        gatewayPayload: payload,
      });
    }

    return { acknowledged: true };
  }

  /** Manual payment record (used by tests/UI until gateway adapters land). */
  @UseGuards(TenantHeaderGuard)
  @Post('subscriptions/payments')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Record a payment for the organization (Phase 1 manual)',
  })
  recordPayment(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.subscriptionService.recordPayment({
      organizationId: tenant.id,
      invoiceNumber: dto.invoiceNumber,
      amount: dto.amount,
      currency: dto.currency,
      paymentGateway: dto.paymentGateway,
      gatewayTransactionId: dto.gatewayTransactionId,
      gatewayPayload: dto.gatewayPayload,
    });
  }
}
