import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import type { TenantContext } from '../common/decorators/current-tenant.decorator';
import { RequirePermission } from '../iam/decorators/require-permission.decorator';
import { TenancyService } from './tenancy.service';

@ApiTags('tenant')
@Controller()
export class TenancyController {
  constructor(private readonly tenancyService: TenancyService) {}

  @RequirePermission('tenant.organization.read')
  @Get('organizations/me')
  @ApiOperation({ summary: 'Organization profile for the current tenant' })
  getMe(@CurrentTenant() tenant: TenantContext) {
    return this.tenancyService.findById(tenant.id);
  }

  @RequirePermission('tenant.branch.read')
  @Get('organizations/me/branches')
  @ApiOperation({ summary: 'Branches for the current tenant' })
  getBranches(@CurrentTenant() tenant: TenantContext) {
    return this.tenancyService.findBranches(tenant.id);
  }
}
