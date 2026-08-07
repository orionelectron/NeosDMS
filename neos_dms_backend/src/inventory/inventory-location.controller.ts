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
import {
  Paginated,
  paginate,
  PaginationQueryDto,
} from '../common/dto/pagination.dto';
import { RequirePermission } from '../iam/decorators/require-permission.decorator';
import {
  CreateInventoryLocationDto,
  UpdateInventoryLocationDto,
} from './dto/inventory.dto';
import { InventoryLocationService } from './inventory-location.service';

@ApiBearerAuth()
@ApiTags('inventory')
@Controller()
export class InventoryLocationController {
  constructor(private readonly locationService: InventoryLocationService) {}

  @RequirePermission('inventory.location.read')
  @Get('inventory/locations')
  @ApiOperation({ summary: 'List inventory locations (paginated)' })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<unknown>> {
    const [data, total] = await this.locationService.listLocations(
      tenant.id,
      query,
    );
    return paginate(data, total, query);
  }

  @RequirePermission('inventory.location.read')
  @Get('inventory/locations/:id')
  @ApiOperation({ summary: 'Get an inventory location' })
  get(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.locationService.getLocation(tenant.id, id);
  }

  @RequirePermission('inventory.location.create')
  @Post('inventory/locations')
  @ApiOperation({ summary: 'Create an inventory location' })
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateInventoryLocationDto,
  ) {
    return this.locationService.createLocation(tenant.id, dto, actor.id);
  }

  @RequirePermission('inventory.location.update')
  @Patch('inventory/locations/:id')
  @ApiOperation({ summary: 'Update an inventory location' })
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateInventoryLocationDto,
  ) {
    return this.locationService.updateLocation(tenant.id, id, dto, actor.id);
  }

  @RequirePermission('inventory.location.delete')
  @Delete('inventory/locations/:id')
  @ApiOperation({ summary: 'Soft-delete an inventory location' })
  async remove(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.locationService.deleteLocation(tenant.id, id, actor.id);
    return { deleted: true };
  }
}
