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
import { CreateItemDto, ItemListQueryDto, UpdateItemDto } from './dto/item.dto';
import { ItemService } from './item.service';

@ApiBearerAuth()
@ApiTags('trading')
@Controller()
export class ItemController {
  constructor(private readonly itemService: ItemService) {}

  @RequirePermission('trading.item.read')
  @Get('items')
  @ApiOperation({ summary: 'List items (paginated)' })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ItemListQueryDto,
  ): Promise<Paginated<unknown>> {
    const [data, total] = await this.itemService.listItems(tenant.id, query);
    return paginate(data, total, query);
  }

  @RequirePermission('trading.item.read')
  @Get('items/:id')
  @ApiOperation({ summary: 'Get an item' })
  get(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.itemService.getItem(tenant.id, id);
  }

  @RequirePermission('trading.item.create')
  @Post('items')
  @ApiOperation({ summary: 'Create an item' })
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateItemDto,
  ) {
    return this.itemService.createItem(tenant.id, dto, actor.id);
  }

  @RequirePermission('trading.item.update')
  @Patch('items/:id')
  @ApiOperation({ summary: 'Update an item' })
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateItemDto,
  ) {
    return this.itemService.updateItem(tenant.id, id, dto, actor.id);
  }

  @RequirePermission('trading.item.delete')
  @Delete('items/:id')
  @ApiOperation({ summary: 'Soft-delete an item' })
  async remove(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.itemService.deleteItem(tenant.id, id, actor.id);
    return { deleted: true };
  }
}
