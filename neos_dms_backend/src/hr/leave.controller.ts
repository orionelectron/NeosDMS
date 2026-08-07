import {
  Body,
  Controller,
  Delete,
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
import {
  CreateLeaveBalanceDto,
  CreateLeaveTypeDto,
  UpdateLeaveTypeDto,
} from './dto/leave-type.dto';
import {
  CreateLeaveRequestDto,
  LeaveBalanceQueryDto,
  LeaveListQueryDto,
  ReviewLeaveDto,
} from './dto/leave.dto';
import { LeaveService } from './leave.service';

@ApiBearerAuth()
@ApiTags('hr')
@Controller()
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  // ---- Leave types -------------------------------------------------------

  @RequirePermission('hr.leave.read')
  @Get('leave/types')
  @ApiOperation({ summary: 'List active leave types for the organization' })
  listTypes(@CurrentTenant() tenant: TenantContext) {
    return this.leaveService.listLeaveTypes(tenant.id);
  }

  @RequirePermission('hr.leave_type.create')
  @Post('leave/types')
  @ApiOperation({ summary: 'Create a leave type (admin)' })
  createType(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateLeaveTypeDto,
  ) {
    return this.leaveService.createLeaveType(tenant.id, dto, actor.id);
  }

  @RequirePermission('hr.leave_type.update')
  @Patch('leave/types/:id')
  @ApiOperation({ summary: 'Update a leave type (admin)' })
  updateType(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateLeaveTypeDto,
  ) {
    return this.leaveService.updateLeaveType(tenant.id, id, dto, actor.id);
  }

  @RequirePermission('hr.leave_type.delete')
  @Delete('leave/types/:id')
  @ApiOperation({ summary: 'Soft-delete a leave type (admin)' })
  async deleteType(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.leaveService.deleteLeaveType(tenant.id, id, actor.id);
    return { deleted: true };
  }

  // ---- Leave balances ----------------------------------------------------

  @RequirePermission('hr.leave_balance.read')
  @Get('leave/balances')
  @ApiOperation({
    summary:
      'Leave balances (own by default, or a reportee via ?userId=; ?bsYear= filters)',
  })
  balances(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: LeaveBalanceQueryDto,
  ) {
    return this.leaveService.getLeaveBalances(tenant.id, actor.id, query);
  }

  @RequirePermission('hr.leave_balance.update')
  @Post('leave/balances')
  @ApiOperation({ summary: 'Grant or adjust a leave balance (admin)' })
  grantBalance(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateLeaveBalanceDto,
  ) {
    return this.leaveService.upsertLeaveBalance(tenant.id, dto, actor.id);
  }

  // ---- Leave requests ----------------------------------------------------

  @RequirePermission('hr.leave.read')
  @Get('leave/requests/mine')
  @ApiOperation({ summary: 'My leave requests' })
  myRequests(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: LeaveListQueryDto,
  ) {
    return this.leaveService.listLeaveRequests(
      tenant.id,
      actor.id,
      query,
      'mine',
    );
  }

  @RequirePermission('hr.leave.read')
  @Get('leave/requests/team')
  @ApiOperation({ summary: 'Leave requests of my reportees (manager)' })
  teamRequests(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: LeaveListQueryDto,
  ) {
    return this.leaveService.listLeaveRequests(
      tenant.id,
      actor.id,
      query,
      'team',
    );
  }

  @RequirePermission('hr.leave.approve')
  @Get('leave/requests/all')
  @ApiOperation({ summary: 'All leave requests in the organization' })
  allRequests(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: LeaveListQueryDto,
  ) {
    return this.leaveService.listLeaveRequests(
      tenant.id,
      actor.id,
      query,
      'all',
    );
  }

  @RequirePermission('hr.leave.create')
  @Post('leave/requests')
  @ApiOperation({ summary: 'Apply for leave (BS date range)' })
  apply(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateLeaveRequestDto,
  ) {
    return this.leaveService.applyLeave(tenant.id, actor.id, dto);
  }

  @RequirePermission('hr.leave.approve')
  @Post('leave/requests/:id/approve')
  @ApiOperation({ summary: 'Approve a pending request (consumes balance)' })
  approve(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReviewLeaveDto,
  ) {
    return this.leaveService.reviewLeave(
      tenant.id,
      actor.id,
      id,
      'APPROVE',
      dto.note,
    );
  }

  @RequirePermission('hr.leave.approve')
  @Post('leave/requests/:id/reject')
  @ApiOperation({ summary: 'Reject a pending request' })
  reject(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReviewLeaveDto,
  ) {
    return this.leaveService.reviewLeave(
      tenant.id,
      actor.id,
      id,
      'REJECT',
      dto.note,
    );
  }

  @RequirePermission('hr.leave.update')
  @Post('leave/requests/:id/cancel')
  @ApiOperation({ summary: 'Cancel a pending request (requester or manager)' })
  cancel(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.leaveService.cancelLeave(tenant.id, actor.id, id);
  }

  @RequirePermission('hr.approval.read')
  @Get('leave/requests/:id/approvals')
  @ApiOperation({ summary: 'Approval trail for a leave request' })
  approvals(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.leaveService.listApprovalEvents(tenant.id, 'leave_request', id);
  }
}
