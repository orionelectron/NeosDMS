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
import { AccountService } from './account.service';
import {
  AccountListQueryDto,
  CreateAccountDto,
  UpdateAccountDto,
} from './dto/account.dto';

@ApiBearerAuth()
@ApiTags('accounting')
@Controller()
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @RequirePermission('accounting.account.read')
  @Get('accounts')
  @ApiOperation({ summary: 'List chart of accounts (filterable)' })
  async listAccounts(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: AccountListQueryDto,
  ): Promise<Paginated<unknown>> {
    const data = await this.accountService.listAccounts(tenant.id, query);
    return paginate(data, data.length, query);
  }

  @RequirePermission('accounting.account.read')
  @Get('accounts/:id')
  @ApiOperation({ summary: 'Get an account by id' })
  getAccount(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.accountService.getAccount(tenant.id, id);
  }

  @RequirePermission('accounting.account.create')
  @Post('accounts')
  @ApiOperation({ summary: 'Create an account (code unique per org)' })
  createAccount(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateAccountDto,
  ) {
    return this.accountService.createAccount(tenant.id, dto, actor.id);
  }

  @RequirePermission('accounting.account.update')
  @Patch('accounts/:id')
  @ApiOperation({
    summary: 'Update an account (system accounts are protected)',
  })
  updateAccount(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
  ) {
    return this.accountService.updateAccount(tenant.id, id, dto, actor.id);
  }

  @RequirePermission('accounting.account.delete')
  @Delete('accounts/:id')
  @ApiOperation({ summary: 'Soft-delete an unused account' })
  async deleteAccount(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.accountService.deleteAccount(tenant.id, id, actor.id);
    return { deleted: true };
  }
}
