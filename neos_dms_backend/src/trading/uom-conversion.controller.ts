import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import type { TenantContext } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Paginated, paginate } from '../common/dto/pagination.dto';
import { RequirePermission } from '../iam/decorators/require-permission.decorator';
import {
  CreateUomConversionDto,
  UomConversionListQueryDto,
} from './dto/uom-conversion.dto';
import { UomConversionService } from './uom-conversion.service';

@ApiBearerAuth()
@ApiTags('trading')
@Controller()
export class UomConversionController {
  constructor(private readonly conversionService: UomConversionService) {}

  @RequirePermission('trading.uom-conversion.read')
  @Get('uom-conversions')
  @ApiOperation({ summary: 'List unit conversions (paginated)' })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: UomConversionListQueryDto,
  ): Promise<Paginated<unknown>> {
    const [data, total] = await this.conversionService.listUomConversions(
      tenant.id,
      query,
    );
    return paginate(data, total, query);
  }

  @RequirePermission('trading.uom-conversion.read')
  @Get('uom-conversions/:id')
  @ApiOperation({ summary: 'Get a unit conversion' })
  get(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.conversionService.getUomConversion(tenant.id, id);
  }

  @RequirePermission('trading.uom-conversion.create')
  @Post('uom-conversions')
  @ApiOperation({ summary: 'Create a unit conversion' })
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateUomConversionDto,
  ) {
    return this.conversionService.createUomConversion(tenant.id, dto, actor.id);
  }

  @RequirePermission('trading.uom-conversion.delete')
  @Delete('uom-conversions/:id')
  @ApiOperation({ summary: 'Soft-delete a unit conversion' })
  async remove(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.conversionService.deleteUomConversion(tenant.id, id, actor.id);
    return { deleted: true };
  }
}
