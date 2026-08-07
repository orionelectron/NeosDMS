import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { UserEntity } from '../iam/entities/user.entity';
import { NepaliDateModule } from '../nepali-date/nepali-date.module';
import { ApprovalEventEntity } from './entities/approval-event.entity';
import { LeaveBalanceEntity } from './entities/leave-balance.entity';
import { LeaveRequestEntity } from './entities/leave-request.entity';
import { LeaveTypeEntity } from './entities/leave-type.entity';
import { TravelExpenseClaimEntity } from './entities/travel-expense-claim.entity';
import { TravelExpenseItemEntity } from './entities/travel-expense-item.entity';
import { TravelRequestEntity } from './entities/travel-request.entity';
import { LeaveController } from './leave.controller';
import { LeaveService } from './leave.service';
import { TravelController } from './travel.controller';
import { TravelService } from './travel.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LeaveTypeEntity,
      LeaveBalanceEntity,
      LeaveRequestEntity,
      TravelRequestEntity,
      TravelExpenseClaimEntity,
      TravelExpenseItemEntity,
      ApprovalEventEntity,
      UserEntity,
    ]),
    AuditModule,
    NepaliDateModule,
  ],
  controllers: [LeaveController, TravelController],
  providers: [LeaveService, TravelService],
})
export class HrModule {}
