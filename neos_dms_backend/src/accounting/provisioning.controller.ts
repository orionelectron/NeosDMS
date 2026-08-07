import { Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import type { TenantContext } from '../common/decorators/current-tenant.decorator';
import { RequirePermission } from '../iam/decorators/require-permission.decorator';
import { AccountingProvisioningService } from './provisioning.service';

@ApiBearerAuth()
@ApiTags('accounting')
@Controller()
export class ProvisioningController {
  constructor(
    private readonly provisioningService: AccountingProvisioningService,
  ) {}

  @RequirePermission('accounting.fiscal-year.create')
  @Post('accounting/provision')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Idempotently (re)provision accounting setup for the organization',
  })
  async provision(@CurrentTenant() tenant: TenantContext) {
    await this.provisioningService.provision(tenant.id);
    return { provisioned: true };
  }
}
