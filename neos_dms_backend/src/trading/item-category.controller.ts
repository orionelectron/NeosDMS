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
  CreateItemCategoryDto,
  ItemCategoryListQueryDto,
  UpdateItemCategoryDto,
} from './dto/item-category.dto';
import { ItemCategoryService } from './item-category.service';

@ApiBearerAuth()
@ApiTags('trading')
@Controller()
export class ItemCategoryController {
  constructor(private readonly categoryService: ItemCategoryService) {}

  @RequirePermission('trading.item-category.read')
  @Get('item-categories')
  @ApiOperation({ summary: 'List item categories (paginated)' })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ItemCategoryListQueryDto,
  ): Promise<Paginated<unknown>> {
    const [data, total] = await this.categoryService.listItemCategories(
      tenant.id,
      query,
    );
    return paginate(data, total, query);
  }

  @RequirePermission('trading.item-category.read')
  @Get('item-categories/:id')
  @ApiOperation({ summary: 'Get an item category' })
  get(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.categoryService.getItemCategory(tenant.id, id);
  }

  @RequirePermission('trading.item-category.create')
  @Post('item-categories')
  @ApiOperation({ summary: 'Create an item category' })
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateItemCategoryDto,
  ) {
    return this.categoryService.createItemCategory(tenant.id, dto, actor.id);
  }

  @RequirePermission('trading.item-category.update')
  @Patch('item-categories/:id')
  @ApiOperation({ summary: 'Update an item category' })
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateItemCategoryDto,
  ) {
    return this.categoryService.updateItemCategory(
      tenant.id,
      id,
      dto,
      actor.id,
    );
  }

  @RequirePermission('trading.item-category.delete')
  @Delete('item-categories/:id')
  @ApiOperation({ summary: 'Soft-delete an item category' })
  async remove(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.categoryService.deleteItemCategory(tenant.id, id, actor.id);
    return { deleted: true };
  }
}
