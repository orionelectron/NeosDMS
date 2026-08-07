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
  CreateSalesTargetDto,
  SalesTargetQueryDto,
  SalesTargetReportQueryDto,
  UpdateSalesTargetDto,
} from './dto/sales-target.dto';
import { SalesTargetService } from './sales-target.service';

@ApiBearerAuth()
@ApiTags('sales')
@Controller()
export class SalesTargetController {
  constructor(private readonly salesTargetService: SalesTargetService) {}

  @RequirePermission('sales.target.create')
  @Post('sales-targets')
  @ApiOperation({ summary: 'Set a monthly sales target (manager/admin)' })
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateSalesTargetDto,
  ) {
    return this.salesTargetService.createTarget(tenant.id, actor.id, dto);
  }

  @RequirePermission('sales.target.read')
  @Get('sales-targets/mine')
  @ApiOperation({ summary: 'My sales targets' })
  mine(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: SalesTargetQueryDto,
  ) {
    return this.salesTargetService.listTargets(
      tenant.id,
      actor.id,
      query,
      'mine',
    );
  }

  @RequirePermission('sales.target.read')
  @Get('sales-targets/team')
  @ApiOperation({ summary: 'Sales targets of my reportees (manager)' })
  team(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: SalesTargetQueryDto,
  ) {
    return this.salesTargetService.listTargets(
      tenant.id,
      actor.id,
      query,
      'team',
    );
  }

  @RequirePermission('sales.target.update')
  @Get('sales-targets/all')
  @ApiOperation({ summary: 'All sales targets in the organization' })
  all(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: SalesTargetQueryDto,
  ) {
    return this.salesTargetService.listTargets(
      tenant.id,
      actor.id,
      query,
      'all',
    );
  }

  @RequirePermission('sales.target.update')
  @Patch('sales-targets/:id')
  @ApiOperation({ summary: 'Update a sales target' })
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateSalesTargetDto,
  ) {
    return this.salesTargetService.updateTarget(tenant.id, actor.id, id, dto);
  }

  @RequirePermission('sales.target.delete')
  @Delete('sales-targets/:id')
  @ApiOperation({ summary: 'Delete a sales target (soft)' })
  remove(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.salesTargetService.deleteTarget(tenant.id, actor.id, id);
  }

  @RequirePermission('sales.target.read')
  @Get('sales-targets/report/monthly')
  @ApiOperation({ summary: 'Monthly sales-target summary (BS year/month)' })
  monthlyReport(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: SalesTargetReportQueryDto,
  ) {
    return this.salesTargetService.monthlyReport(tenant.id, actor.id, query);
  }
}
