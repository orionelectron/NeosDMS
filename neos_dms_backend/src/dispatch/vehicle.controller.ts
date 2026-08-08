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
  CreateVehicleDto,
  UpdateVehicleDto,
  VehicleQueryDto,
} from './dto/vehicle.dto';
import { VehicleService } from './vehicle.service';

@ApiBearerAuth()
@ApiTags('dispatch')
@Controller()
export class VehicleController {
  constructor(private readonly vehicleService: VehicleService) {}

  @RequirePermission('dispatch.vehicle.create')
  @Post('vehicles')
  @ApiOperation({ summary: 'Register a vehicle' })
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateVehicleDto,
  ) {
    return this.vehicleService.create(tenant.id, actor.id, dto);
  }

  @RequirePermission('dispatch.vehicle.read')
  @Get('vehicles')
  @ApiOperation({ summary: 'List vehicles (paginated)' })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: VehicleQueryDto,
  ): Promise<Paginated<unknown>> {
    const [data, total] = await this.vehicleService.list(tenant.id, query);
    return paginate(data, total, query);
  }

  @RequirePermission('dispatch.vehicle.read')
  @Get('vehicles/:id')
  @ApiOperation({ summary: 'Get a vehicle' })
  get(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.vehicleService.get(tenant.id, id);
  }

  @RequirePermission('dispatch.vehicle.update')
  @Patch('vehicles/:id')
  @ApiOperation({ summary: 'Update a vehicle' })
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateVehicleDto,
  ) {
    return this.vehicleService.update(tenant.id, actor.id, id, dto);
  }

  @RequirePermission('dispatch.vehicle.delete')
  @Delete('vehicles/:id')
  @ApiOperation({ summary: 'Soft-delete a vehicle' })
  async remove(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.vehicleService.remove(tenant.id, actor.id, id);
    return { deleted: true };
  }
}
