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
  CreatePartyDto,
  PartyListQueryDto,
  UpdatePartyDto,
} from './dto/party.dto';
import { PartyService } from './party.service';

@ApiBearerAuth()
@ApiTags('accounting')
@Controller()
export class PartyController {
  constructor(private readonly partyService: PartyService) {}

  @RequirePermission('accounting.party.read')
  @Get('parties')
  @ApiOperation({ summary: 'List customers/suppliers (paginated)' })
  async listParties(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: PartyListQueryDto,
  ): Promise<Paginated<unknown>> {
    const [data, total] = await this.partyService.listParties(tenant.id, query);
    return paginate(data, total, query);
  }

  @RequirePermission('accounting.party.read')
  @Get('parties/:id')
  @ApiOperation({ summary: 'Get a party with addresses' })
  getParty(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.partyService.getParty(tenant.id, id);
  }

  @RequirePermission('accounting.party.create')
  @Post('parties')
  @ApiOperation({
    summary: 'Create a party (must be customer, supplier, or lead)',
  })
  createParty(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreatePartyDto,
  ) {
    return this.partyService.createParty(tenant.id, dto, actor.id);
  }

  @RequirePermission('accounting.party.update')
  @Patch('parties/:id')
  @ApiOperation({ summary: 'Update a party' })
  updateParty(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdatePartyDto,
  ) {
    return this.partyService.updateParty(tenant.id, id, dto, actor.id);
  }

  @RequirePermission('accounting.party.delete')
  @Delete('parties/:id')
  @ApiOperation({ summary: 'Soft-delete a party' })
  async deleteParty(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.partyService.deleteParty(tenant.id, id, actor.id);
    return { deleted: true };
  }
}
