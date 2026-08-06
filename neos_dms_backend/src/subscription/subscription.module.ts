import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingPeriodEntity } from './entities/billing-period.entity';
import { OrganizationUsageEntity } from './entities/organization-usage.entity';
import { PlanEntity } from './entities/plan.entity';
import { PriceMatrixEntity } from './entities/price-matrix.entity';
import { SubscriptionHistoryEntity } from './entities/subscription-history.entity';
import { SubscriptionTransactionEntity } from './entities/subscription-transaction.entity';
import { SubscriptionEntity } from './entities/subscription.entity';
import { PlanLimitInterceptor } from './plan-limits/plan-limit.interceptor';
import { PlanLimitService } from './plan-limits/plan-limit.service';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PlanEntity,
      BillingPeriodEntity,
      PriceMatrixEntity,
      SubscriptionEntity,
      OrganizationUsageEntity,
      SubscriptionTransactionEntity,
      SubscriptionHistoryEntity,
    ]),
  ],
  controllers: [SubscriptionController],
  providers: [SubscriptionService, PlanLimitService, PlanLimitInterceptor],
  exports: [SubscriptionService, PlanLimitService],
})
export class SubscriptionModule {}
