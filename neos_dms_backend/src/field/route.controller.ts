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
  CreateRouteDto,
  RouteImportQueryDto,
  RouteListQueryDto,
  UpdateRouteDto,
} from './dto/route.dto';
import { RouteImportService } from './route-import.service';
import { RouteService } from './route.service';

const IMPORT_MAX_FILE_SIZE = 10 * 1024 * 1024;

@ApiBearerAuth()
@ApiTags('field')
@Controller()
export class RouteController {
  constructor(
    private readonly routeService: RouteService,
    private readonly routeImportService: RouteImportService,
  ) {}

  @RequirePermission('sales.route.read')
  @Get('routes')
  @ApiOperation({ summary: 'List routes (paginated)' })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: RouteListQueryDto,
  ): Promise<Paginated<unknown>> {
    const [data, total] = await this.routeService.listRoutes(tenant.id, query);
    return paginate(data, total, query);
  }

  @RequirePermission('sales.route.read')
  @Get('routes/mine')
  @ApiOperation({ summary: 'List routes assigned to the current user' })
  async listMine(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: RouteListQueryDto,
  ): Promise<Paginated<unknown>> {
    const [data, total] = await this.routeService.listMine(
      tenant.id,
      actor.id,
      query,
    );
    return paginate(data, total, query);
  }

  @RequirePermission('sales.route.read')
  @Get('routes/:id')
  @ApiOperation({ summary: 'Get a route' })
  get(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.routeService.getRoute(tenant.id, id);
  }

  @RequirePermission('sales.route.read')
  @Get('routes/:id/outlets')
  @ApiOperation({ summary: 'List outlets on a route' })
  listOutlets(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.routeService.listRouteOutlets(tenant.id, id);
  }

  @RequirePermission('sales.route.create')
  @Post('routes/import')
  @ApiOperation({
    summary:
      'Bulk-import routes from an .xlsx/.csv spreadsheet (migration). Skips duplicates, reports per-row errors. Query options: dryRun=true (validate only), mode=update (update existing), format=csv (download error file).',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: IMPORT_MAX_FILE_SIZE } }),
  )
  async importRoutes(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: RouteImportQueryDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException(
        'A spreadsheet file is required (multipart field "file")',
      );
    }
    const extension = this.routeImportService.resolveExtension(
      file.originalname,
    );
    const report = await this.routeImportService.importRoutes(
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

  @RequirePermission('sales.route.read')
  @Get('routes/import/template')
  @ApiOperation({ summary: 'Download a route import template (.xlsx)' })
  async importTemplate(): Promise<StreamableFile> {
    const { buffer, fileName } =
      await this.routeImportService.generateTemplate();
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="${fileName}"`,
    });
  }

  @RequirePermission('sales.route.create')
  @Post('routes')
  @ApiOperation({ summary: 'Create a route' })
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateRouteDto,
  ) {
    return this.routeService.createRoute(tenant.id, dto, actor.id);
  }

  @RequirePermission('sales.route.update')
  @Patch('routes/:id')
  @ApiOperation({ summary: 'Update a route' })
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateRouteDto,
  ) {
    return this.routeService.updateRoute(tenant.id, id, dto, actor.id);
  }

  @RequirePermission('sales.route.delete')
  @Delete('routes/:id')
  @ApiOperation({ summary: 'Soft-delete a route' })
  async remove(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.routeService.deleteRoute(tenant.id, id, actor.id);
    return { deleted: true };
  }
}
