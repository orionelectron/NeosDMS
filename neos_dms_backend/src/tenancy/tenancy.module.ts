import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionModule } from '../subscription/subscription.module';
import { BranchEntity } from './entities/branch.entity';
import { ModuleEntity } from './entities/module.entity';
import { OrganizationEntity } from './entities/organization.entity';
import { TenancyController } from './tenancy.controller';
import { TenancyService } from './tenancy.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([OrganizationEntity, BranchEntity, ModuleEntity]),
    SubscriptionModule,
  ],
  controllers: [TenancyController],
  providers: [TenancyService],
  exports: [TenancyService],
})
export class TenancyModule {}
