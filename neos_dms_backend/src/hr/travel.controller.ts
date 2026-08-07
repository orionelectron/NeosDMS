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
  CreateExpenseClaimDto,
  CreateExpenseItemDto,
  CreateTravelRequestDto,
  ExpenseClaimQueryDto,
  PayExpenseClaimDto,
  ReviewTravelDto,
  TravelRequestQueryDto,
  UpdateExpenseItemDto,
  UpdateTravelRequestDto,
} from './dto/travel.dto';
import { TravelService } from './travel.service';

@ApiBearerAuth()
@ApiTags('hr')
@Controller()
export class TravelController {
  constructor(private readonly travelService: TravelService) {}

  // ---- Travel requests ---------------------------------------------------

  @RequirePermission('hr.travel_request.read')
  @Get('travel/requests/mine')
  @ApiOperation({ summary: 'My travel requests' })
  myRequests(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: TravelRequestQueryDto,
  ) {
    return this.travelService.listTravelRequests(
      tenant.id,
      actor.id,
      query,
      'mine',
    );
  }

  @RequirePermission('hr.travel_request.read')
  @Get('travel/requests/team')
  @ApiOperation({ summary: 'Travel requests of my reportees (manager)' })
  teamRequests(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: TravelRequestQueryDto,
  ) {
    return this.travelService.listTravelRequests(
      tenant.id,
      actor.id,
      query,
      'team',
    );
  }

  @RequirePermission('hr.travel_request.approve')
  @Get('travel/requests/all')
  @ApiOperation({ summary: 'All travel requests in the organization' })
  allRequests(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: TravelRequestQueryDto,
  ) {
    return this.travelService.listTravelRequests(
      tenant.id,
      actor.id,
      query,
      'all',
    );
  }

  @RequirePermission('hr.travel_request.create')
  @Post('travel/requests')
  @ApiOperation({ summary: 'Create a travel request (BS date range)' })
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateTravelRequestDto,
  ) {
    return this.travelService.createTravelRequest(tenant.id, actor.id, dto);
  }

  @RequirePermission('hr.travel_request.update')
  @Patch('travel/requests/:id')
  @ApiOperation({ summary: 'Edit a pending travel request (requester)' })
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTravelRequestDto,
  ) {
    return this.travelService.updateTravelRequest(tenant.id, actor.id, id, dto);
  }

  @RequirePermission('hr.travel_request.approve')
  @Post('travel/requests/:id/approve')
  @ApiOperation({ summary: 'Approve a pending travel request (manager)' })
  approve(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReviewTravelDto,
  ) {
    return this.travelService.reviewTravelRequest(
      tenant.id,
      actor.id,
      id,
      'APPROVE',
      dto.note,
    );
  }

  @RequirePermission('hr.travel_request.approve')
  @Post('travel/requests/:id/reject')
  @ApiOperation({ summary: 'Reject a pending travel request (manager)' })
  reject(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReviewTravelDto,
  ) {
    return this.travelService.reviewTravelRequest(
      tenant.id,
      actor.id,
      id,
      'REJECT',
      dto.note,
    );
  }

  @RequirePermission('hr.travel_request.update')
  @Post('travel/requests/:id/cancel')
  @ApiOperation({
    summary: 'Cancel a pending travel request (requester or manager)',
  })
  cancel(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.travelService.cancelTravelRequest(tenant.id, actor.id, id);
  }

  @RequirePermission('hr.approval.read')
  @Get('travel/requests/:id/approvals')
  @ApiOperation({ summary: 'Approval trail for a travel request' })
  requestApprovals(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.travelService.listApprovalEvents(
      tenant.id,
      'travel_request',
      id,
    );
  }

  // ---- Expense claims ----------------------------------------------------

  @RequirePermission('hr.expense.read')
  @Get('expense/claims/mine')
  @ApiOperation({ summary: 'My expense claims' })
  myClaims(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ExpenseClaimQueryDto,
  ) {
    return this.travelService.listExpenseClaims(
      tenant.id,
      actor.id,
      query,
      'mine',
    );
  }

  @RequirePermission('hr.expense.read')
  @Get('expense/claims/team')
  @ApiOperation({ summary: 'Claims of my reportees (manager)' })
  teamClaims(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ExpenseClaimQueryDto,
  ) {
    return this.travelService.listExpenseClaims(
      tenant.id,
      actor.id,
      query,
      'team',
    );
  }

  @RequirePermission('hr.expense.pay')
  @Get('expense/claims/all')
  @ApiOperation({ summary: 'All claims (manager/accountant)' })
  allClaims(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ExpenseClaimQueryDto,
  ) {
    return this.travelService.listExpenseClaims(
      tenant.id,
      actor.id,
      query,
      'all',
    );
  }

  @RequirePermission('hr.expense.create')
  @Post('expense/claims')
  @ApiOperation({ summary: 'Create an expense claim (BS period)' })
  createClaim(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateExpenseClaimDto,
  ) {
    return this.travelService.createExpenseClaim(tenant.id, actor.id, dto);
  }

  @RequirePermission('hr.expense.update')
  @Post('expense/claims/:id/items')
  @ApiOperation({ summary: 'Add a line item to a pending claim' })
  addItem(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateExpenseItemDto,
  ) {
    return this.travelService.addExpenseItem(tenant.id, actor.id, id, dto);
  }

  @RequirePermission('hr.expense.update')
  @Patch('expense/claims/:id/items/:itemId')
  @ApiOperation({ summary: 'Update a line item on a pending claim' })
  updateItem(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateExpenseItemDto,
  ) {
    return this.travelService.updateExpenseItem(
      tenant.id,
      actor.id,
      id,
      itemId,
      dto,
    );
  }

  @RequirePermission('hr.expense.update')
  @Delete('expense/claims/:id/items/:itemId')
  @ApiOperation({ summary: 'Remove a line item from a pending claim' })
  async removeItem(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    await this.travelService.removeExpenseItem(tenant.id, actor.id, id, itemId);
    return { deleted: true };
  }

  @RequirePermission('hr.expense.approve')
  @Post('expense/claims/:id/approve')
  @ApiOperation({ summary: 'Approve a pending claim (manager)' })
  approveClaim(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReviewTravelDto,
  ) {
    return this.travelService.reviewExpenseClaim(
      tenant.id,
      actor.id,
      id,
      'APPROVE',
      dto.note,
    );
  }

  @RequirePermission('hr.expense.approve')
  @Post('expense/claims/:id/reject')
  @ApiOperation({ summary: 'Reject a pending claim (manager)' })
  rejectClaim(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReviewTravelDto,
  ) {
    return this.travelService.reviewExpenseClaim(
      tenant.id,
      actor.id,
      id,
      'REJECT',
      dto.note,
    );
  }

  @RequirePermission('hr.expense.pay')
  @Post('expense/claims/:id/pay')
  @ApiOperation({
    summary:
      'Pay an approved claim (accountant) — optional per-item approved amounts',
  })
  payClaim(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: PayExpenseClaimDto,
  ) {
    return this.travelService.payExpenseClaim(tenant.id, actor.id, id, dto);
  }

  @RequirePermission('hr.expense.update')
  @Post('expense/claims/:id/cancel')
  @ApiOperation({ summary: 'Cancel a pending claim (claimant or manager)' })
  cancelClaim(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.travelService.cancelExpenseClaim(tenant.id, actor.id, id);
  }

  @RequirePermission('hr.approval.read')
  @Get('expense/claims/:id/approvals')
  @ApiOperation({ summary: 'Approval trail for an expense claim' })
  claimApprovals(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.travelService.listApprovalEvents(
      tenant.id,
      'expense_claim',
      id,
    );
  }
}
