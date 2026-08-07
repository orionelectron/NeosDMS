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
import { Paginated, paginate } from '../common/dto/pagination.dto';
import { RequirePermission } from '../iam/decorators/require-permission.decorator';
import { CreateUomDto, UomListQueryDto, UpdateUomDto } from './dto/uom.dto';
import { UomService } from './uom.service';

@ApiBearerAuth()
@ApiTags('trading')
@Controller()
export class UomController {
  constructor(private readonly uomService: UomService) {}

  @RequirePermission('trading.uom.read')
  @Get('uoms')
  @ApiOperation({ summary: 'List units of measure (paginated)' })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: UomListQueryDto,
  ): Promise<Paginated<unknown>> {
    const [data, total] = await this.uomService.listUoms(tenant.id, query);
    return paginate(data, total, query);
  }

  @RequirePermission('trading.uom.read')
  @Get('uoms/:id')
  @ApiOperation({ summary: 'Get a unit of measure' })
  get(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.uomService.getUom(tenant.id, id);
  }

  @RequirePermission('trading.uom.create')
  @Post('uoms')
  @ApiOperation({ summary: 'Create a unit of measure' })
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateUomDto,
  ) {
    return this.uomService.createUom(tenant.id, dto, actor.id);
  }

  @RequirePermission('trading.uom.update')
  @Patch('uoms/:id')
  @ApiOperation({ summary: 'Update a unit of measure' })
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUomDto,
  ) {
    return this.uomService.updateUom(tenant.id, id, dto, actor.id);
  }

  @RequirePermission('trading.uom.delete')
  @Delete('uoms/:id')
  @ApiOperation({ summary: 'Soft-delete a unit of measure' })
  async remove(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.uomService.deleteUom(tenant.id, id, actor.id);
    return { deleted: true };
  }
}
