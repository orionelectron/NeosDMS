import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Body } from '@nestjs/common';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import type { TenantContext } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../iam/decorators/require-permission.decorator';
import { CreateFiscalYearDto } from './dto/fiscal-year.dto';
import { FiscalYearService } from './fiscal-year.service';

@ApiBearerAuth()
@ApiTags('accounting')
@Controller()
export class FiscalYearController {
  constructor(private readonly fiscalYearService: FiscalYearService) {}

  @RequirePermission('accounting.fiscal-year.read')
  @Get('fiscal-years')
  @ApiOperation({ summary: 'List fiscal years with their periods' })
  listFiscalYears(@CurrentTenant() tenant: TenantContext) {
    return this.fiscalYearService.listFiscalYears(tenant.id);
  }

  @RequirePermission('accounting.fiscal-year.read')
  @Get('fiscal-years/active')
  @ApiOperation({ summary: 'Get the active fiscal year' })
  getActiveFiscalYear(@CurrentTenant() tenant: TenantContext) {
    return this.fiscalYearService.getActiveFiscalYear(tenant.id);
  }

  @RequirePermission('accounting.fiscal-year.create')
  @Post('fiscal-years')
  @ApiOperation({
    summary:
      'Create a fiscal year (BS) with its 12 periods; first year is activated',
  })
  createFiscalYear(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateFiscalYearDto,
  ) {
    return this.fiscalYearService.createFiscalYear(tenant.id, dto, actor.id);
  }

  @RequirePermission('accounting.fiscal-year.read')
  @Get('fiscal-years/:id')
  @ApiOperation({ summary: 'Get a fiscal year with its periods' })
  getFiscalYear(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.fiscalYearService.getFiscalYear(tenant.id, id);
  }

  @RequirePermission('accounting.fiscal-year.update')
  @Post('fiscal-years/:id/open')
  @HttpCode(200)
  @ApiOperation({ summary: 'Activate a fiscal year (deactivates the rest)' })
  openFiscalYear(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.fiscalYearService.openFiscalYear(tenant.id, id, actor.id);
  }

  @RequirePermission('accounting.fiscal-year.close')
  @Post('fiscal-years/:id/close')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Close a fiscal year and lock all of its periods',
  })
  closeFiscalYear(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.fiscalYearService.closeFiscalYear(tenant.id, id, actor.id);
  }

  @RequirePermission('accounting.fiscal-year.read')
  @Get('fiscal-years/:id/periods')
  @ApiOperation({ summary: 'List periods of a fiscal year' })
  listPeriods(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.fiscalYearService.listPeriods(tenant.id, id);
  }
}
