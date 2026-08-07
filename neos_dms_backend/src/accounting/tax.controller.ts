import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import type { TenantContext } from '../common/decorators/current-tenant.decorator';
import { RequirePermission } from '../iam/decorators/require-permission.decorator';
import { TaxService } from './tax.service';

@ApiBearerAuth()
@ApiTags('accounting')
@Controller()
export class TaxController {
  constructor(private readonly taxService: TaxService) {}

  @RequirePermission('accounting.tax.read')
  @Get('tax/types')
  @ApiOperation({ summary: 'System tax types (VAT, TDS, Exempt)' })
  listTaxTypes() {
    return this.taxService.listTaxTypes();
  }

  @RequirePermission('accounting.tax.read')
  @Get('tax/templates')
  @ApiOperation({ summary: 'System tax templates' })
  listTaxTemplates() {
    return this.taxService.listTaxTemplates();
  }

  @RequirePermission('accounting.tax.read')
  @Get('tax/codes')
  @ApiOperation({ summary: 'Organization tax codes' })
  listTaxCodes(@CurrentTenant() tenant: TenantContext) {
    return this.taxService.listTaxCodes(tenant.id);
  }

  @RequirePermission('accounting.tax.read')
  @Get('tax/codes/:id')
  @ApiOperation({ summary: 'Get a tax code by id' })
  getTaxCode(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.taxService.getTaxCode(tenant.id, id);
  }
}
