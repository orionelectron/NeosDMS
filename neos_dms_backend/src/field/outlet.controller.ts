import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import type { TenantContext } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Paginated, paginate } from '../common/dto/pagination.dto';
import { RequirePermission } from '../iam/decorators/require-permission.decorator';
import {
  CreateOutletDto,
  OutletImportQueryDto,
  OutletListQueryDto,
  UpdateOutletDto,
} from './dto/outlet.dto';
import { OutletImportService } from './outlet-import.service';
import { OutletService } from './outlet.service';

const IMPORT_MAX_FILE_SIZE = 10 * 1024 * 1024;

@ApiBearerAuth()
@ApiTags('field')
@Controller()
export class OutletController {
  constructor(
    private readonly outletService: OutletService,
    private readonly outletImportService: OutletImportService,
  ) {}

  @RequirePermission('sales.outlet.read')
  @Get('outlets')
  @ApiOperation({ summary: 'List outlets (paginated)' })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: OutletListQueryDto,
  ): Promise<Paginated<unknown>> {
    const [data, total] = await this.outletService.listOutlets(
      tenant.id,
      query,
    );
    return paginate(data, total, query);
  }

  @RequirePermission('sales.outlet.read')
  @Get('outlets/mine')
  @ApiOperation({
    summary: 'List outlets on routes assigned to the current user',
  })
  async listMine(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: OutletListQueryDto,
  ): Promise<Paginated<unknown>> {
    const [data, total] = await this.outletService.listMine(
      tenant.id,
      actor.id,
      query,
    );
    return paginate(data, total, query);
  }

  @RequirePermission('sales.outlet.create')
  @Post('outlets/import')
  @ApiOperation({
    summary:
      'Bulk-import outlets from an .xlsx/.csv spreadsheet (migration). Skips duplicates, reports per-row errors. Query options: dryRun=true (validate only), mode=update (update existing), format=csv (download error file).',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: IMPORT_MAX_FILE_SIZE } }),
  )
  async importOutlets(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: OutletImportQueryDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException(
        'A spreadsheet file is required (multipart field "file")',
      );
    }
    const extension = this.outletImportService.resolveExtension(
      file.originalname,
    );
    const report = await this.outletImportService.importOutlets(
      tenant.id,
      actor.id,
      file.originalname,
      file.buffer,
      extension,
      { mode: query.mode, dryRun: query.dryRun },
    );
    if (query.format === 'csv') {
      const baseName = file.originalname.replace(/\.[^.]+$/, '');
      return new StreamableFile(Buffer.from(report.errorsCsv, 'utf8'), {
        type: 'text/csv',
        disposition: `attachment; filename="${baseName}-errors.csv"`,
      });
    }
    return report;
  }

  @RequirePermission('sales.outlet.read')
  @Get('outlets/import/template')
  @ApiOperation({ summary: 'Download an outlet import template (.xlsx)' })
  async importTemplate(): Promise<StreamableFile> {
    const { buffer, fileName } =
      await this.outletImportService.generateTemplate();
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="${fileName}"`,
    });
  }

  @RequirePermission('sales.outlet.read')
  @Get('outlets/:id')
  @ApiOperation({ summary: 'Get an outlet' })
  get(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.outletService.getOutlet(tenant.id, id);
  }

  @RequirePermission('sales.outlet.create')
  @Post('outlets')
  @ApiOperation({
    summary: 'Create an outlet (auto-provisions a customer party)',
  })
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateOutletDto,
  ) {
    return this.outletService.createOutlet(tenant.id, dto, actor.id);
  }

  @RequirePermission('sales.outlet.update')
  @Patch('outlets/:id')
  @ApiOperation({ summary: 'Update an outlet' })
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateOutletDto,
  ) {
    return this.outletService.updateOutlet(tenant.id, id, dto, actor.id);
  }

  @RequirePermission('sales.outlet.delete')
  @Delete('outlets/:id')
  @ApiOperation({ summary: 'Soft-delete an outlet' })
  async remove(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.outletService.deleteOutlet(tenant.id, id, actor.id);
    return { deleted: true };
  }

  @RequirePermission('sales.outlet.update')
  @Post('outlets/:id/routes/:routeId')
  @ApiOperation({ summary: 'Link an outlet to a route' })
  linkRoute(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Param('routeId') routeId: string,
  ) {
    return this.outletService.linkRoute(tenant.id, id, routeId, actor.id);
  }

  @RequirePermission('sales.outlet.update')
  @Delete('outlets/:id/routes/:routeId')
  @ApiOperation({ summary: 'Unlink an outlet from a route' })
  async unlinkRoute(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Param('routeId') routeId: string,
  ) {
    await this.outletService.unlinkRoute(tenant.id, id, routeId, actor.id);
    return { unlinked: true };
  }
}
