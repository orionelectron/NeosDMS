import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { UserEntity } from '../iam/entities/user.entity';
import { NepaliDateModule } from '../nepali-date/nepali-date.module';
import { BrandEntity } from '../trading/entities/brand.entity';
import { ItemCategoryEntity } from '../trading/entities/item-category.entity';
import { OutletRouteEntity } from './entities/outlet-route.entity';
import { OutletVisitEntity } from './entities/outlet-visit.entity';
import { OutletEntity } from './entities/outlet.entity';
import { RouteAssignmentEntity } from './entities/route-assignment.entity';
import { RouteEntity } from './entities/route.entity';
import { SalesTargetEntity } from './entities/sales-target.entity';
import { OutletController } from './outlet.controller';
import { OutletImportService } from './outlet-import.service';
import { OutletService } from './outlet.service';
import { OutletVisitService } from './outlet-visit.service';
import { RouteAssignmentController } from './route-assignment.controller';
import { RouteAssignmentService } from './route-assignment.service';
import { RouteController } from './route.controller';
import { RouteImportService } from './route-import.service';
import { RoutePlannerController } from './route-planner.controller';
import { RoutePlannerService } from './route-planner.service';
import { RouteService } from './route.service';
import { SalesTargetController } from './sales-target.controller';
import { SalesTargetService } from './sales-target.service';
import { VisitController } from './visit.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OutletEntity,
      RouteEntity,
      OutletRouteEntity,
      RouteAssignmentEntity,
      OutletVisitEntity,
      SalesTargetEntity,
      ItemCategoryEntity,
      BrandEntity,
      UserEntity,
    ]),
    AuditModule,
    NepaliDateModule,
  ],
  controllers: [
    OutletController,
    RouteController,
    RoutePlannerController,
    RouteAssignmentController,
    VisitController,
    SalesTargetController,
  ],
  providers: [
    OutletService,
    OutletImportService,
    RouteService,
    RouteImportService,
    RoutePlannerService,
    RouteAssignmentService,
    OutletVisitService,
    SalesTargetService,
  ],
})
export class FieldModule {}
