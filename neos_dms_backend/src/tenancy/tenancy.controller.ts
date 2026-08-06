import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import type { TenantContext } from '../common/decorators/current-tenant.decorator';
import { TenantHeaderGuard } from '../subscription/plan-limits/tenant-header.guard';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { TenancyService } from './tenancy.service';

@ApiTags('tenant')
@Controller()
export class TenancyController {
  constructor(private readonly tenancyService: TenancyService) {}

  @Post('organizations')
  @ApiOperation({
    summary: 'Onboard an organization (org + main branch + trial subscription)',
  })
  onboard(@Body() dto: CreateOrganizationDto) {
    return this.tenancyService.onboard(dto);
  }

  @UseGuards(TenantHeaderGuard)
  @Get('organizations/me')
  @ApiOperation({ summary: 'Organization profile for the current tenant' })
  getMe(@CurrentTenant() tenant: TenantContext) {
    return this.tenancyService.findById(tenant.id);
  }

  @UseGuards(TenantHeaderGuard)
  @Get('organizations/me/branches')
  @ApiOperation({ summary: 'Branches for the current tenant' })
  getBranches(@CurrentTenant() tenant: TenantContext) {
    return this.tenancyService.findBranches(tenant.id);
  }
}
