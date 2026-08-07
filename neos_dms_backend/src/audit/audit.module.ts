import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NepaliDateModule } from '../nepali-date/nepali-date.module';
import { AuditLogEntity } from './audit-log.entity';
import { AuditService } from './audit.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLogEntity]), NepaliDateModule],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
