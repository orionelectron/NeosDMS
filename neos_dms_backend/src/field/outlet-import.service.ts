import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import * as ExcelJS from 'exceljs';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { PartyEntity } from '../accounting/entities/party.entity';
import { AuditService } from '../audit/audit.service';
import { OutletEntity } from './entities/outlet.entity';
import { OutletImportException } from './field.errors';
import {
  mapHeaders,
  normalizeOutletRow,
  OutletImportRow,
  parseSpreadsheet,
  SpreadsheetExtension,
} from './outlet-import.parser';

/** Hard cap on data rows per upload — keeps parse time and response size sane. */
export const OUTLET_IMPORT_MAX_ROWS = 10000;

const BATCH_SIZE = 200;
const DUPLICATE_CONSTRAINT_CODES = new Set(['23505']);

export type DuplicateReason = 'DUPLICATE_IN_FILE' | 'ALREADY_EXISTS';

export interface OutletImportDuplicate {
  row: number;
  name: string;
  reason: DuplicateReason;
}

export interface OutletImportRowError {
  row: number;
  name?: string;
  errors: string[];
}

export interface OutletImportReport {
  fileName: string;
  totalRows: number;
  imported: number;
  duplicateCount: number;
  errorCount: number;
  duplicates: OutletImportDuplicate[];
  errors: OutletImportRowError[];
}

interface PendingRow {
  row: number;
  value: OutletImportRow;
}

/**
 * Bulk outlet import for migrations from legacy systems.
 *
 * Strategy (robust + efficient):
 * 1. Parse the whole file into memory (validated, single pass).
 * 2. Validate + normalize every row, collecting row-level errors.
 * 3. Dedupe within the file AND against existing org outlets (name is unique
 *    per org) — duplicates are skipped and reported, not failed.
 * 4. Import valid rows inside one outer transaction, one nested savepoint per
 *    batch so a failing batch only rolls back its own rows; unexpected DB
 *    errors are isolated per row and reported. Everything valid commits
 *    together; a catastrophic failure rolls back the whole import.
 */
@Injectable()
export class OutletImportService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(OutletEntity)
    private readonly outletRepo: Repository<OutletEntity>,
    private readonly auditService: AuditService,
  ) {}

  resolveExtension(fileName: string): SpreadsheetExtension {
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'xlsx') return 'xlsx';
    if (ext === 'csv') return 'csv';
    if (ext === 'xls') {
      throw new OutletImportException(
        'Legacy .xls files are not supported. Please re-save the file as .xlsx or .csv.',
      );
    }
    throw new OutletImportException(
      `Unsupported file type '.${ext || 'unknown'}'. Please upload an .xlsx or .csv file.`,
    );
  }

  async importOutlets(
    organizationId: string,
    actorId: string,
    fileName: string,
    buffer: Buffer,
    extension: SpreadsheetExtension,
  ): Promise<OutletImportReport> {
    const parsed = await this.parseFile(buffer, extension);
    if (parsed.rows.length > OUTLET_IMPORT_MAX_ROWS) {
      throw new OutletImportException(
        `The file contains ${parsed.rows.length} rows; the maximum supported is ${OUTLET_IMPORT_MAX_ROWS}. Split the file and try again.`,
      );
    }

    const headerIndex = this.mapHeaders(parsed.header);
    const { validationErrors, pending } = this.validateRows(
      parsed.rows,
      headerIndex,
    );
    const { duplicates, toImport } = await this.dedupe(organizationId, pending);

    const { imported, dbErrors } = await this.importRows(
      organizationId,
      actorId,
      fileName,
      parsed.rows.length,
      duplicates.length,
      validationErrors.length,
      toImport,
    );

    const errors = [...validationErrors, ...dbErrors];
    return {
      fileName,
      totalRows: parsed.rows.length,
      imported,
      duplicateCount: duplicates.length,
      errorCount: errors.length,
      duplicates,
      errors,
    };
  }

  async generateTemplate(): Promise<{ buffer: Buffer; fileName: string }> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'NEOS DMS';

    const sheet = workbook.addWorksheet('Outlets');
    sheet.columns = [
      { header: 'name', key: 'name', width: 30 },
      { header: 'owner_name', key: 'ownerName', width: 20 },
      { header: 'email', key: 'email', width: 26 },
      { header: 'phone', key: 'phone', width: 16 },
      { header: 'address', key: 'address', width: 28 },
      { header: 'province', key: 'province', width: 14 },
      { header: 'district', key: 'district', width: 16 },
      { header: 'latitude', key: 'latitude', width: 12 },
      { header: 'longitude', key: 'longitude', width: 12 },
      { header: 'channel', key: 'channel', width: 18 },
      { header: 'category', key: 'category', width: 18 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.addRow({
      name: 'Kathmandu Surya Stores',
      ownerName: 'Ramesh Shrestha',
      email: 'ramesh@example.com',
      phone: '014440001',
      address: 'Ganesh Marg, New Road',
      province: 'Bagmati',
      district: 'Kathmandu',
      latitude: 27.7172,
      longitude: 85.3136,
      channel: 'GENERAL_TRADE',
      category: 'Supermarket',
    });

    const instructions = workbook.addWorksheet('Instructions');
    const notes: [string, string][] = [
      [
        'name',
        'Required. Unique outlet name within the organization. Rows with a duplicate name (in this file or already in the system) are skipped and reported.',
      ],
      ['owner_name', 'Owner/proprietor name. Optional.'],
      ['email', 'Optional.'],
      [
        'phone',
        'Optional. Format this column as TEXT in Excel to keep leading zeros.',
      ],
      ['address', 'Optional street address.'],
      ['province', 'Optional.'],
      ['district', 'Optional.'],
      ['latitude', 'Optional decimal, -90 to 90 (max 7 decimals).'],
      ['longitude', 'Optional decimal, -180 to 180 (max 7 decimals).'],
      [
        'channel',
        'Optional. One of GENERAL_TRADE, MODERN_TRADE, HORECA, INSTITUTION. Defaults to GENERAL_TRADE.',
      ],
      ['category', 'Optional free text.'],
      ['', ''],
      [
        '',
        'Header row: keep the column headers exactly as shown on the "Outlets" sheet (case-insensitive).',
      ],
      [
        '',
        'Remove the example row before uploading. Upload the file via POST /api/v1/outlets/import.',
      ],
    ];
    instructions.addRow(['column', 'notes']);
    instructions.getRow(1).font = { bold: true };
    notes.forEach(([column, note]) => instructions.addRow([column, note]));
    instructions.getColumn(1).width = 16;
    instructions.getColumn(2).width = 90;

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    return { buffer, fileName: 'outlet-import-template.xlsx' };
  }

  private async parseFile(buffer: Buffer, extension: SpreadsheetExtension) {
    try {
      return await parseSpreadsheet(buffer, extension);
    } catch (error) {
      throw new OutletImportException(
        error instanceof Error
          ? error.message
          : 'Could not parse the spreadsheet',
      );
    }
  }

  private mapHeaders(header: string[]) {
    try {
      return mapHeaders(header);
    } catch (error) {
      throw new OutletImportException(
        error instanceof Error ? error.message : 'Invalid header row',
      );
    }
  }

  private validateRows(
    rows: (string | number | null)[][],
    headerIndex: ReturnType<typeof mapHeaders>,
  ): { validationErrors: OutletImportRowError[]; pending: PendingRow[] } {
    const validationErrors: OutletImportRowError[] = [];
    const pending: PendingRow[] = [];
    rows.forEach((cells, index) => {
      const rowNumber = index + 2;
      const name =
        headerIndex.name !== undefined
          ? String(cells[headerIndex.name] ?? '').trim()
          : undefined;
      const result = normalizeOutletRow(cells, headerIndex);
      if (result.issues.length > 0) {
        validationErrors.push({
          row: rowNumber,
          name: name || undefined,
          errors: result.issues,
        });
      } else if (result.value) {
        pending.push({ row: rowNumber, value: result.value });
      }
    });
    return { validationErrors, pending };
  }

  private async dedupe(
    organizationId: string,
    pending: PendingRow[],
  ): Promise<{ duplicates: OutletImportDuplicate[]; toImport: PendingRow[] }> {
    const existing = new Set<string>();
    const outlets = await this.outletRepo.find({
      where: { organizationId },
      select: { id: true, name: true },
    });
    for (const outlet of outlets) {
      existing.add(outlet.name.trim().toLowerCase());
    }

    const duplicates: OutletImportDuplicate[] = [];
    const seen = new Set<string>();
    const toImport: PendingRow[] = [];
    for (const item of pending) {
      const key = item.value.name.trim().toLowerCase();
      if (seen.has(key)) {
        duplicates.push({
          row: item.row,
          name: item.value.name,
          reason: 'DUPLICATE_IN_FILE',
        });
        continue;
      }
      if (existing.has(key)) {
        duplicates.push({
          row: item.row,
          name: item.value.name,
          reason: 'ALREADY_EXISTS',
        });
        continue;
      }
      seen.add(key);
      toImport.push(item);
    }
    return { duplicates, toImport };
  }

  private async importRows(
    organizationId: string,
    actorId: string,
    fileName: string,
    totalRows: number,
    duplicateCount: number,
    validationErrorCount: number,
    toImport: PendingRow[],
  ): Promise<{ imported: number; dbErrors: OutletImportRowError[] }> {
    const dbErrors: OutletImportRowError[] = [];
    let imported = 0;

    await this.dataSource.transaction(async (manager) => {
      for (let i = 0; i < toImport.length; i += BATCH_SIZE) {
        const batch = toImport.slice(i, i + BATCH_SIZE);
        try {
          // Each batch runs in its own savepoint: a failure rolls back only
          // this batch and leaves the outer transaction usable (PG aborts the
          // whole transaction on an error outside a savepoint).
          await manager.transaction(async (txn) => {
            await this.insertBatch(txn, organizationId, batch);
          });
          imported += batch.length;
        } catch {
          for (const item of batch) {
            try {
              await manager.transaction(async (txn) => {
                await this.insertBatch(txn, organizationId, [item]);
              });
              imported += 1;
            } catch (error) {
              dbErrors.push({
                row: item.row,
                name: item.value.name,
                errors: [this.describeDbError(error, item.value.name)],
              });
            }
          }
        }
      }

      await this.auditService.record(
        {
          organizationId,
          userId: actorId,
          action: 'sales.outlet.import',
          entityType: 'outlet',
          newData: {
            fileName,
            totalRows,
            imported,
            ignoredDuplicates: duplicateCount,
            failed: validationErrorCount + dbErrors.length,
          },
        },
        manager,
      );
    });

    return { imported, dbErrors };
  }

  private async insertBatch(
    manager: EntityManager,
    organizationId: string,
    batch: PendingRow[],
  ): Promise<void> {
    const partyRepo = manager.getRepository(PartyEntity);
    const outletRepo = manager.getRepository(OutletEntity);

    const parties = await partyRepo.save(
      partyRepo.create(
        batch.map((item) =>
          this.customerPartyFields(organizationId, item.value),
        ),
      ),
    );

    await outletRepo.save(
      outletRepo.create(
        batch.map((item, index) =>
          this.outletFields(organizationId, item.value, parties[index].id),
        ),
      ),
    );
  }

  private customerPartyFields(
    organizationId: string,
    row: OutletImportRow,
  ): Partial<PartyEntity> {
    return {
      organizationId,
      branchId: null,
      currencyId: null,
      paymentTermId: null,
      name: row.name,
      legalName: row.name,
      partyKind: 'BUSINESS',
      isCustomer: true,
      isSupplier: false,
      isLead: false,
      panNumber: null,
      vatNumber: null,
      email: row.email ?? null,
      phone: row.phone ?? null,
      address: row.address ?? null,
      creditLimit: '0',
      openingBalance: '0',
      isActive: true,
    };
  }

  private outletFields(
    organizationId: string,
    row: OutletImportRow,
    partyId: string,
  ): Partial<OutletEntity> {
    return {
      organizationId,
      partyId,
      name: row.name,
      ownerName: row.ownerName ?? null,
      email: row.email ?? null,
      phone: row.phone ?? null,
      address: row.address ?? null,
      province: row.province ?? null,
      district: row.district ?? null,
      latitude: row.latitude == null ? null : String(row.latitude),
      longitude: row.longitude == null ? null : String(row.longitude),
      photoKey: null,
      description: null,
      channel: row.channel,
      category: row.category ?? null,
      status: 'ACTIVE',
    };
  }

  private describeDbError(error: unknown, name: string): string {
    const code = (error as { driverError?: { code?: string } })?.driverError
      ?.code;
    if (code && DUPLICATE_CONSTRAINT_CODES.has(code)) {
      return `An outlet named '${name}' already exists`;
    }
    return 'Failed to save row (unexpected database error)';
  }
}
