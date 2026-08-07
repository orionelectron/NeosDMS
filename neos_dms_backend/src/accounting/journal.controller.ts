import {
  Body,
  Controller,
  Get,
  HttpCode,
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
  CreateJournalEntryDto,
  JournalListQueryDto,
} from './dto/journal-entry.dto';
import { TrialBalanceQueryDto } from './dto/trial-balance.dto';
import { JournalService } from './journal.service';
import { TrialBalanceService } from './trial-balance.service';

@ApiBearerAuth()
@ApiTags('accounting')
@Controller()
export class JournalController {
  constructor(
    private readonly journalService: JournalService,
    private readonly trialBalanceService: TrialBalanceService,
  ) {}

  @RequirePermission('accounting.journal-entry.read')
  @Get('trial-balance')
  @ApiOperation({
    summary:
      'Trial balance of POSTED entries (opening, activity, closing per account)',
  })
  trialBalance(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: TrialBalanceQueryDto,
  ) {
    return this.trialBalanceService.trialBalance(tenant.id, query);
  }

  @RequirePermission('accounting.journal-entry.read')
  @Get('journal-entries')
  @ApiOperation({ summary: 'List journal entries (paginated, filterable)' })
  async listJournalEntries(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: JournalListQueryDto,
  ): Promise<Paginated<unknown>> {
    const [data, total] = await this.journalService.list(tenant.id, query);
    return paginate(data, total, query);
  }

  @RequirePermission('accounting.journal-entry.read')
  @Get('journal-entries/:id')
  @ApiOperation({ summary: 'Get a journal entry with lines' })
  getJournalEntry(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.journalService.get(tenant.id, id);
  }

  @RequirePermission('accounting.journal-entry.create')
  @Post('journal-entries')
  @ApiOperation({
    summary: 'Create a draft journal entry (validated, balanced)',
  })
  createJournalEntry(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateJournalEntryDto,
  ) {
    return this.journalService.createDraft(tenant.id, dto, actor.id);
  }

  @RequirePermission('accounting.journal-entry.post')
  @Post('journal-entries/:id/post')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Post a draft — revalidates balance, fiscal period locks, assigns JE number',
  })
  postJournalEntry(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.journalService.post(tenant.id, id, actor.id);
  }

  @RequirePermission('accounting.journal-entry.delete')
  @Post('journal-entries/:id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel a draft journal entry' })
  cancelJournalEntry(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.journalService.cancel(tenant.id, id, actor.id);
  }
}
