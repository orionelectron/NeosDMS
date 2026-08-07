import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import * as ExcelJS from 'exceljs';
import {
  DataSource,
  DeepPartial,
  EntityManager,
  QueryDeepPartialEntity,
  Repository,
} from 'typeorm';
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

export type ImportMode = 'skip' | 'update';

export interface ImportOptions {
  mode?: ImportMode;
  dryRun?: boolean;
}

export interface OutletImportDuplicate {
  row: number;
  name: string;
  reason: DuplicateReason;
}

export interface OutletImportUpdate {
  row: number;
  name: string;
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
  updated: number;
  duplicateCount: number;
  errorCount: number;
  dryRun: boolean;
  mode: ImportMode;
  duplicates: OutletImportDuplicate[];
  updates: OutletImportUpdate[];
  errors: OutletImportRowError[];
  errorsCsv: string;
}

interface PendingRow {
  row: number;
  value: OutletImportRow;
  cells: (string | number | null)[];
}

interface PendingUpdate extends PendingRow {
  outletId: string;
  partyId: string | null;
}

interface RowIssue {
  row: number;
  name?: string;
  errors: string[];
  cells: (string | number | null)[];
}

type ImportOp =
  | { kind: 'create'; item: PendingRow }
  | { kind: 'update'; item: PendingUpdate };

/**
 * Bulk outlet import for migrations from legacy systems.
 *
 * Strategy (robust + efficient):
 * 1. Parse the whole file into memory (validated, single pass).
 * 2. Validate + normalize every row, collecting row-level errors.
 * 3. Dedupe within the file AND against existing org outlets (name is unique
 *    per org). In `skip` mode duplicates are skipped and reported; in `update`
 *    mode existing outlets are updated in place instead of skipped.
 * 4. Import valid rows inside one outer transaction, one nested savepoint per
 *    batch so a failing batch only rolls back its own rows; unexpected DB
 *    errors are isolated per row and reported. Everything valid commits
 *    together; a catastrophic failure rolls back the whole import.
 * 5. `dryRun` returns the full report (incl. the error CSV) without writing.
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
    options: ImportOptions = {},
  ): Promise<OutletImportReport> {
    const mode = options.mode ?? 'skip';
    const dryRun = options.dryRun ?? false;

    const parsed = await this.parseFile(buffer, extension);
    if (parsed.rows.length > OUTLET_IMPORT_MAX_ROWS) {
      throw new OutletImportException(
        `The file contains ${parsed.rows.length} rows; the maximum supported is ${OUTLET_IMPORT_MAX_ROWS}. Split the file and try again.`,
      );
    }

    const headerIndex = this.mapHeaders(parsed.header);
    const { issues, pending } = this.validateRows(parsed.rows, headerIndex);
    const { duplicates, toCreate, toUpdate } = await this.dedupe(
      organizationId,
      pending,
      mode,
    );

    const { imported, updated, dbErrors, errorsCsv } = await this.importRows(
      organizationId,
      actorId,
      fileName,
      parsed.header,
      parsed.rows.length,
      duplicates.length,
      issues,
      toCreate,
      toUpdate,
      dryRun,
    );

    const errors = [...issues, ...dbErrors].map((issue) => ({
      row: issue.row,
      name: issue.name,
      errors: issue.errors,
    }));
    return {
      fileName,
      totalRows: parsed.rows.length,
      imported,
      updated,
      duplicateCount: duplicates.length,
      errorCount: errors.length,
      dryRun,
      mode,
      duplicates,
      updates: toUpdate.map(({ row, value }) => ({ row, name: value.name })),
      errors,
      errorsCsv,
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
      [
        '',
        'Dry-run first: POST /outlets/import?dryRun=true returns the same report (incl. an error CSV) without changing any data. Re-upload without dryRun when it looks right.',
      ],
      [
        '',
        'By default rows whose name already exists are skipped. Add ?mode=update to update those existing outlets in place instead (name/status are never overwritten).',
      ],
      [
        '',
        'To download the errors as a CSV file instead of JSON, add ?format=csv to the upload request.',
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
  ): { issues: RowIssue[]; pending: PendingRow[] } {
    const issues: RowIssue[] = [];
    const pending: PendingRow[] = [];
    rows.forEach((cells, index) => {
      const rowNumber = index + 2;
      const name =
        headerIndex.name !== undefined
          ? String(cells[headerIndex.name] ?? '').trim()
          : undefined;
      const result = normalizeOutletRow(cells, headerIndex);
      if (result.issues.length > 0) {
        issues.push({
          row: rowNumber,
          name: name || undefined,
          errors: result.issues,
          cells,
        });
      } else if (result.value) {
        pending.push({ row: rowNumber, value: result.value, cells });
      }
    });
    return { issues, pending };
  }

  private async dedupe(
    organizationId: string,
    pending: PendingRow[],
    mode: ImportMode,
  ): Promise<{
    duplicates: OutletImportDuplicate[];
    toCreate: PendingRow[];
    toUpdate: PendingUpdate[];
  }> {
    const existing = new Map<string, { id: string; partyId: string | null }>();
    const outlets = await this.outletRepo.find({
      where: { organizationId },
      select: { id: true, name: true, partyId: true },
    });
    for (const outlet of outlets) {
      existing.set(outlet.name.trim().toLowerCase(), {
        id: outlet.id,
        partyId: outlet.partyId,
      });
    }

    const duplicates: OutletImportDuplicate[] = [];
    const toCreate: PendingRow[] = [];
    const toUpdate: PendingUpdate[] = [];
    const seen = new Set<string>();
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
      const existingOutlet = existing.get(key);
      if (existingOutlet) {
        if (mode === 'update') {
          seen.add(key);
          toUpdate.push({
            ...item,
            outletId: existingOutlet.id,
            partyId: existingOutlet.partyId,
          });
        } else {
          duplicates.push({
            row: item.row,
            name: item.value.name,
            reason: 'ALREADY_EXISTS',
          });
        }
        continue;
      }
      seen.add(key);
      toCreate.push(item);
    }
    return { duplicates, toCreate, toUpdate };
  }

  private async importRows(
    organizationId: string,
    actorId: string,
    fileName: string,
    header: string[],
    totalRows: number,
    duplicateCount: number,
    issues: RowIssue[],
    toCreate: PendingRow[],
    toUpdate: PendingUpdate[],
    dryRun: boolean,
  ): Promise<{
    imported: number;
    updated: number;
    dbErrors: RowIssue[];
    errorsCsv: string;
  }> {
    const dbErrors: RowIssue[] = [];
    let imported = 0;
    let updated = 0;

    if (!dryRun) {
      await this.dataSource.transaction(async (manager) => {
        const ops: ImportOp[] = [
          ...toCreate.map((item) => ({ kind: 'create' as const, item })),
          ...toUpdate.map((item) => ({ kind: 'update' as const, item })),
        ];
        for (let i = 0; i < ops.length; i += BATCH_SIZE) {
          const batch = ops.slice(i, i + BATCH_SIZE);
          try {
            // Each batch runs in its own savepoint: a failure rolls back only
            // this batch and leaves the outer transaction usable (PG aborts the
            // whole transaction on an error outside a savepoint).
            await manager.transaction(async (txn) => {
              await this.applyBatch(txn, organizationId, batch);
            });
            imported += batch.filter((op) => op.kind === 'create').length;
            updated += batch.filter((op) => op.kind === 'update').length;
          } catch {
            for (const op of batch) {
              try {
                await manager.transaction(async (txn) => {
                  await this.applyBatch(txn, organizationId, [op]);
                });
                if (op.kind === 'create') imported += 1;
                else updated += 1;
              } catch (error) {
                dbErrors.push({
                  row: op.item.row,
                  name: op.item.value.name,
                  errors: [this.describeDbError(error, op.item.value.name)],
                  cells: op.item.cells,
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
              updated,
              ignoredDuplicates: duplicateCount,
              failed: issues.length + dbErrors.length,
            },
          },
          manager,
        );
      });
    } else {
      imported = toCreate.length;
      updated = toUpdate.length;
    }

    const errorsCsv = this.buildErrorCsv(header, [...issues, ...dbErrors]);
    return { imported, updated, dbErrors, errorsCsv };
  }

  private async applyBatch(
    manager: EntityManager,
    organizationId: string,
    ops: ImportOp[],
  ): Promise<void> {
    const partyRepo = manager.getRepository(PartyEntity);
    const outletRepo = manager.getRepository(OutletEntity);

    const creates = ops.filter((op) => op.kind === 'create');
    if (creates.length > 0) {
      const parties = await partyRepo.save(
        partyRepo.create(
          creates.map((op) =>
            this.customerPartyFields(organizationId, op.item.value),
          ),
        ),
      );
      await outletRepo.save(
        outletRepo.create(
          creates.map((op, index) =>
            this.outletFields(organizationId, op.item.value, parties[index].id),
          ),
        ),
      );
    }

    for (const op of ops) {
      if (op.kind !== 'update') continue;
      if (op.item.partyId) {
        await partyRepo.update(
          op.item.partyId,
          this.customerPartyUpdateFields(op.item.value),
        );
      }
      await outletRepo.update(
        op.item.outletId,
        this.outletUpdateFields(op.item.value),
      );
    }
  }

  private buildErrorCsv(header: string[], errors: RowIssue[]): string {
    const lines = [this.toCsvLine([...header, 'error'])];
    for (const issue of errors) {
      const cells = header.map((_, i) =>
        issue.cells[i] == null ? '' : String(issue.cells[i]),
      );
      lines.push(this.toCsvLine([...cells, issue.errors.join('; ')]));
    }
    return lines.join('\r\n');
  }

  private toCsvLine(fields: (string | number | null | undefined)[]): string {
    return fields
      .map((field) => {
        const value = field == null ? '' : String(field);
        return /[",\r\n;]/.test(value) || /^[ \t]|[ \t]$/.test(value)
          ? `"${value.replace(/"/g, '""')}"`
          : value;
      })
      .join(',');
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
  ): DeepPartial<OutletEntity> {
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
      channel: row.channel,
      category: row.category ?? null,
    };
  }

  private outletUpdateFields(
    row: OutletImportRow,
  ): QueryDeepPartialEntity<OutletEntity> {
    return {
      name: row.name,
      ownerName: row.ownerName ?? null,
      email: row.email ?? null,
      phone: row.phone ?? null,
      address: row.address ?? null,
      province: row.province ?? null,
      district: row.district ?? null,
      latitude: row.latitude == null ? null : String(row.latitude),
      longitude: row.longitude == null ? null : String(row.longitude),
      channel: row.channel,
      category: row.category ?? null,
    };
  }

  private customerPartyUpdateFields(
    row: OutletImportRow,
  ): QueryDeepPartialEntity<PartyEntity> {
    return {
      email: row.email ?? null,
      phone: row.phone ?? null,
      address: row.address ?? null,
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
