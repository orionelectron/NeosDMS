import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import type { TenantContext } from '../common/decorators/current-tenant.decorator';
import { RequirePermission } from '../iam/decorators/require-permission.decorator';
import { DocumentSequenceService } from './document-sequence.service';
import { CreateDocumentSequenceDto } from './dto/document-sequence.dto';

@ApiBearerAuth()
@ApiTags('accounting')
@Controller()
export class DocumentSequenceController {
  constructor(
    private readonly documentSequenceService: DocumentSequenceService,
  ) {}

  @RequirePermission('accounting.document-sequence.read')
  @Get('document-sequences')
  @ApiOperation({ summary: 'List document numbering sequences' })
  listSequences(@CurrentTenant() tenant: TenantContext) {
    return this.documentSequenceService.list(tenant.id);
  }

  @RequirePermission('accounting.document-sequence.create')
  @Post('document-sequences')
  @ApiOperation({ summary: 'Pre-create a document sequence (optional)' })
  createSequence(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateDocumentSequenceDto,
  ) {
    return this.documentSequenceService.create(tenant.id, dto);
  }
}
