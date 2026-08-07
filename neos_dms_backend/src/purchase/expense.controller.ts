import {
  Body,
  Controller,
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
  CreateExpenseDto,
  ExpenseQueryDto,
  UpdateExpenseDto,
} from './dto/expense.dto';
import { ExpenseService } from './expense.service';

@ApiBearerAuth()
@ApiTags('purchase')
@Controller()
export class ExpenseController {
  constructor(private readonly expenseService: ExpenseService) {}

  @RequirePermission('purchase.expense.create')
  @Post('purchase/expenses')
  @ApiOperation({ summary: 'Create an expense voucher draft' })
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateExpenseDto,
  ) {
    return this.expenseService.create(tenant.id, actor.id, dto);
  }

  @RequirePermission('purchase.expense.read')
  @Get('purchase/expenses')
  @ApiOperation({ summary: 'List expense vouchers' })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ExpenseQueryDto,
  ): Promise<Paginated<unknown>> {
    const [data, total] = await this.expenseService.list(tenant.id, query);
    return paginate(data, total, query);
  }

  @RequirePermission('purchase.expense.read')
  @Get('purchase/expenses/:id')
  @ApiOperation({ summary: 'Get an expense voucher with lines' })
  get(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.expenseService.get(tenant.id, id);
  }

  @RequirePermission('purchase.expense.update')
  @Patch('purchase/expenses/:id')
  @ApiOperation({ summary: 'Update a draft expense voucher' })
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.expenseService.update(tenant.id, actor.id, id, dto);
  }

  @RequirePermission('purchase.expense.post')
  @Post('purchase/expenses/:id/post')
  @ApiOperation({
    summary:
      'Post a draft — EXP- number and the DR expense accounts / VAT Receivable, CR payment or AP / TDS Payable journal',
  })
  post(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.expenseService.post(tenant.id, actor.id, id);
  }

  @RequirePermission('purchase.expense.void')
  @Post('purchase/expenses/:id/void')
  @ApiOperation({ summary: 'Void a draft expense voucher' })
  voidExpense(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.expenseService.voidExpense(tenant.id, actor.id, id);
  }
}
