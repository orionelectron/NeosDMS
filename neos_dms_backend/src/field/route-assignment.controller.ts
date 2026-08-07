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
  CreateRouteAssignmentDto,
  RouteAssignmentListQueryDto,
  UpdateRouteAssignmentDto,
} from './dto/route-assignment.dto';
import { RouteAssignmentService } from './route-assignment.service';

@ApiBearerAuth()
@ApiTags('field')
@Controller()
export class RouteAssignmentController {
  constructor(private readonly assignmentService: RouteAssignmentService) {}

  @RequirePermission('sales.route_assignment.read')
  @Get('route-assignments')
  @ApiOperation({ summary: 'List route assignments (paginated)' })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: RouteAssignmentListQueryDto,
  ): Promise<Paginated<unknown>> {
    const [data, total] = await this.assignmentService.listAssignments(
      tenant.id,
      query,
    );
    return paginate(data, total, query);
  }

  @RequirePermission('sales.route_assignment.create')
  @Post('route-assignments')
  @ApiOperation({ summary: 'Assign a route to a user' })
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateRouteAssignmentDto,
  ) {
    return this.assignmentService.createAssignment(tenant.id, dto, actor.id);
  }

  @RequirePermission('sales.route_assignment.update')
  @Patch('route-assignments/:id')
  @ApiOperation({ summary: 'Update a route assignment' })
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateRouteAssignmentDto,
  ) {
    return this.assignmentService.updateAssignment(
      tenant.id,
      id,
      dto,
      actor.id,
    );
  }

  @RequirePermission('sales.route_assignment.delete')
  @Delete('route-assignments/:id')
  @ApiOperation({ summary: 'Delete a route assignment' })
  async remove(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.assignmentService.deleteAssignment(tenant.id, id, actor.id);
    return { deleted: true };
  }
}
