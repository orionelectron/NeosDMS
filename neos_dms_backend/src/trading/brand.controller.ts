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
import {
  BrandListQueryDto,
  CreateBrandDto,
  UpdateBrandDto,
} from './dto/brand.dto';
import { BrandService } from './brand.service';

@ApiBearerAuth()
@ApiTags('trading')
@Controller()
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

  @RequirePermission('trading.brand.read')
  @Get('brands')
  @ApiOperation({ summary: 'List brands (paginated)' })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: BrandListQueryDto,
  ): Promise<Paginated<unknown>> {
    const [data, total] = await this.brandService.listBrands(tenant.id, query);
    return paginate(data, total, query);
  }

  @RequirePermission('trading.brand.read')
  @Get('brands/:id')
  @ApiOperation({ summary: 'Get a brand' })
  get(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.brandService.getBrand(tenant.id, id);
  }

  @RequirePermission('trading.brand.create')
  @Post('brands')
  @ApiOperation({ summary: 'Create a brand' })
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateBrandDto,
  ) {
    return this.brandService.createBrand(tenant.id, dto, actor.id);
  }

  @RequirePermission('trading.brand.update')
  @Patch('brands/:id')
  @ApiOperation({ summary: 'Update a brand' })
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateBrandDto,
  ) {
    return this.brandService.updateBrand(tenant.id, id, dto, actor.id);
  }

  @RequirePermission('trading.brand.delete')
  @Delete('brands/:id')
  @ApiOperation({ summary: 'Soft-delete a brand' })
  async remove(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.brandService.deleteBrand(tenant.id, id, actor.id);
    return { deleted: true };
  }
}
