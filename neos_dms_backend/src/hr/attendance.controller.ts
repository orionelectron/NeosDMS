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
import { RequirePermission } from '../iam/decorators/require-permission.decorator';
import { AttendanceService } from './attendance.service';
import {
  AdjustAttendanceDto,
  AttendanceQueryDto,
  AttendanceReportQueryDto,
  CheckInDto,
  CheckOutDto,
  ManualAttendanceDto,
} from './dto/attendance.dto';

@ApiBearerAuth()
@ApiTags('hr')
@Controller()
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @RequirePermission('hr.attendance.create')
  @Post('attendance/checkin')
  @ApiOperation({ summary: 'Check in (self-service)' })
  checkIn(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CheckInDto,
  ) {
    return this.attendanceService.checkIn(tenant.id, actor.id, dto);
  }

  @RequirePermission('hr.attendance.update')
  @Post('attendance/checkout')
  @ApiOperation({ summary: 'Check out (self-service, optional)' })
  checkOut(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CheckOutDto,
  ) {
    return this.attendanceService.checkOut(tenant.id, actor.id, dto);
  }

  @RequirePermission('hr.attendance.read')
  @Get('attendance/mine')
  @ApiOperation({ summary: 'My attendance records' })
  myAttendance(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: AttendanceQueryDto,
  ) {
    return this.attendanceService.list(tenant.id, actor.id, query, 'mine');
  }

  @RequirePermission('hr.attendance.read')
  @Get('attendance/team')
  @ApiOperation({ summary: 'Attendance of my reportees (manager)' })
  teamAttendance(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: AttendanceQueryDto,
  ) {
    return this.attendanceService.list(tenant.id, actor.id, query, 'team');
  }

  @RequirePermission('hr.attendance.adjust')
  @Get('attendance/all')
  @ApiOperation({ summary: 'All attendance records in the organization' })
  allAttendance(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: AttendanceQueryDto,
  ) {
    return this.attendanceService.list(tenant.id, actor.id, query, 'all');
  }

  @RequirePermission('hr.attendance.create')
  @Post('attendance/manual')
  @ApiOperation({ summary: 'Manager records attendance for a reportee' })
  manualEntry(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: ManualAttendanceDto,
  ) {
    return this.attendanceService.manualEntry(tenant.id, actor.id, dto);
  }

  @RequirePermission('hr.attendance.update')
  @Patch('attendance/:id')
  @ApiOperation({ summary: 'Adjust an attendance record (owner or manager)' })
  adjust(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AdjustAttendanceDto,
  ) {
    return this.attendanceService.adjust(tenant.id, actor.id, id, dto);
  }

  @RequirePermission('hr.attendance.read')
  @Get('attendance/reports/daily')
  @ApiOperation({ summary: 'Daily attendance report (BS date)' })
  dailyReport(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: AttendanceReportQueryDto,
  ) {
    return this.attendanceService.dailyReport(tenant.id, actor.id, query);
  }

  @RequirePermission('hr.attendance.read')
  @Get('attendance/reports/monthly')
  @ApiOperation({ summary: 'Monthly attendance summary (BS year/month)' })
  monthlyReport(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: AttendanceReportQueryDto,
  ) {
    return this.attendanceService.monthlyReport(tenant.id, actor.id, query);
  }
}
