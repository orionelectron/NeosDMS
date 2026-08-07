import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { BrandController } from './brand.controller';
import { BrandService } from './brand.service';
import { BrandEntity } from './entities/brand.entity';
import { ItemCategoryEntity } from './entities/item-category.entity';
import { ItemEntity } from './entities/item.entity';
import { UomConversionEntity } from './entities/uom-conversion.entity';
import { UomEntity } from './entities/uom.entity';
import { ItemCategoryController } from './item-category.controller';
import { ItemCategoryService } from './item-category.service';
import { ItemController } from './item.controller';
import { ItemService } from './item.service';
import { UomConversionController } from './uom-conversion.controller';
import { UomConversionService } from './uom-conversion.service';
import { UomController } from './uom.controller';
import { UomService } from './uom.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ItemEntity,
      ItemCategoryEntity,
      UomEntity,
      BrandEntity,
      UomConversionEntity,
    ]),
    AuditModule,
    SubscriptionModule,
  ],
  controllers: [
    ItemController,
    ItemCategoryController,
    BrandController,
    UomController,
    UomConversionController,
  ],
  providers: [
    ItemService,
    ItemCategoryService,
    BrandService,
    UomService,
    UomConversionService,
  ],
})
export class TradingModule {}
