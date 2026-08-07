import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { UserEntity } from '../iam/entities/user.entity';
import { NepaliDateModule } from '../nepali-date/nepali-date.module';
import { ApprovalEventEntity } from './entities/approval-event.entity';
import { LeaveBalanceEntity } from './entities/leave-balance.entity';
import { LeaveRequestEntity } from './entities/leave-request.entity';
import { LeaveTypeEntity } from './entities/leave-type.entity';
import { LeaveController } from './leave.controller';
import { LeaveService } from './leave.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LeaveTypeEntity,
      LeaveBalanceEntity,
      LeaveRequestEntity,
      ApprovalEventEntity,
      UserEntity,
    ]),
    AuditModule,
    NepaliDateModule,
  ],
  controllers: [LeaveController],
  providers: [LeaveService],
})
export class HrModule {}
