import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { OutletRouteEntity } from './entities/outlet-route.entity';
import { OutletVisitEntity } from './entities/outlet-visit.entity';
import { OutletEntity } from './entities/outlet.entity';
import { RouteAssignmentEntity } from './entities/route-assignment.entity';
import { RouteEntity } from './entities/route.entity';
import { OutletController } from './outlet.controller';
import { OutletService } from './outlet.service';
import { OutletVisitService } from './outlet-visit.service';
import { RouteAssignmentController } from './route-assignment.controller';
import { RouteAssignmentService } from './route-assignment.service';
import { RouteController } from './route.controller';
import { RouteService } from './route.service';
import { VisitController } from './visit.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OutletEntity,
      RouteEntity,
      OutletRouteEntity,
      RouteAssignmentEntity,
      OutletVisitEntity,
    ]),
    AuditModule,
  ],
  controllers: [
    OutletController,
    RouteController,
    RouteAssignmentController,
    VisitController,
  ],
  providers: [
    OutletService,
    RouteService,
    RouteAssignmentService,
    OutletVisitService,
  ],
})
export class FieldModule {}
