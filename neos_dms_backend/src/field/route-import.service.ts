import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import * as ExcelJS from 'exceljs';
import { DataSource, QueryDeepPartialEntity, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { RouteEntity } from './entities/route.entity';
import { RouteImportException } from './field.errors';
import {
  mapHeaders,
  normalizeRouteRow,
  parseSpreadsheet,
  RouteImportRow,
  SpreadsheetExtension,
} from './route-import.parser';

/** Hard cap on data rows per upload — keeps parse time and response size sane. */
export const ROUTE_IMPORT_MAX_ROWS = 5000;

const BATCH_SIZE = 200;
const DUPLICATE_CONSTRAINT_CODES = new Set(['23505']);

export type DuplicateReason = 'DUPLICATE_IN_FILE' | 'ALREADY_EXISTS';

export type ImportMode = 'skip' | 'update';

export interface ImportOptions {
  mode?: ImportMode;
  dryRun?: boolean;
}

export interface RouteImportDuplicate {
  row: number;
  code: string;
  reason: DuplicateReason;
}

export interface RouteImportUpdate {
  row: number;
  code: string;
}

export interface RouteImportRowError {
  row: number;
  code?: string;
  errors: string[];
}

export interface RouteImportReport {
  fileName: string;
  totalRows: number;
  imported: number;
  updated: number;
  duplicateCount: number;
  errorCount: number;
  dryRun: boolean;
  mode: ImportMode;
  duplicates: RouteImportDuplicate[];
  updates: RouteImportUpdate[];
  errors: RouteImportRowError[];
  errorsCsv: string;
}

interface PendingRow {
  row: number;
  value: RouteImportRow;
  cells: (string | number | null)[];
}

interface PendingUpdate extends PendingRow {
  routeId: string;
}

interface RowIssue {
  row: number;
  code?: string;
  errors: string[];
  cells: (string | number | null)[];
}

type ImportOp =
  | { kind: 'create'; item: PendingRow }
  | { kind: 'update'; item: PendingUpdate };

/**
 * Bulk route import for migrations from legacy systems.
 *
 * Same robustness strategy as the outlet import:
 * 1. Parse the whole file into memory (validated, single pass).
 * 2. Validate + normalize every row, collecting row-level errors.
 * 3. Dedupe within the file AND against existing org routes (code is unique
 *    per org). In `skip` mode duplicates are skipped and reported; in `update`
 *    mode existing routes are updated in place instead of skipped.
 * 4. Import valid rows inside one outer transaction, one nested savepoint per
 *    batch so a failing batch only rolls back its own rows; unexpected DB
 *    errors are isolated per row and reported. Everything valid commits
 *    together; a catastrophic failure rolls back the whole import.
 * 5. `dryRun` returns the full report (incl. the error CSV) without writing.
 */
@Injectable()
export class RouteImportService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(RouteEntity)
    private readonly routeRepo: Repository<RouteEntity>,
    private readonly auditService: AuditService,
  ) {}

  resolveExtension(fileName: string): SpreadsheetExtension {
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'xlsx') return 'xlsx';
    if (ext === 'csv') return 'csv';
    if (ext === 'xls') {
      throw new RouteImportException(
        'Legacy .xls files are not supported. Please re-save the file as .xlsx or .csv.',
      );
    }
    throw new RouteImportException(
      `Unsupported file type '.${ext || 'unknown'}'. Please upload an .xlsx or .csv file.`,
    );
  }

  async importRoutes(
    organizationId: string,
    actorId: string,
    fileName: string,
    buffer: Buffer,
    extension: SpreadsheetExtension,
    options: ImportOptions = {},
  ): Promise<RouteImportReport> {
    const mode = options.mode ?? 'skip';
    const dryRun = options.dryRun ?? false;

    const parsed = await this.parseFile(buffer, extension);
    if (parsed.rows.length > ROUTE_IMPORT_MAX_ROWS) {
      throw new RouteImportException(
        `The file contains ${parsed.rows.length} rows; the maximum supported is ${ROUTE_IMPORT_MAX_ROWS}. Split the file and try again.`,
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
      code: issue.code,
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
      updates: toUpdate.map(({ row, value }) => ({ row, code: value.code })),
      errors,
      errorsCsv,
    };
  }

  async generateTemplate(): Promise<{ buffer: Buffer; fileName: string }> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'NEOS DMS';

    const sheet = workbook.addWorksheet('Routes');
    sheet.columns = [
      { header: 'name', key: 'name', width: 30 },
      { header: 'code', key: 'code', width: 16 },
      { header: 'description', key: 'description', width: 30 },
      { header: 'province', key: 'province', width: 14 },
      { header: 'district', key: 'district', width: 16 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.addRow({
      name: 'Kathmandu Valley Core',
      code: 'KT-VALLEY',
      description: 'Daily coverage of the main valley routes',
      province: 'Bagmati',
      district: 'Kathmandu',
    });

    const instructions = workbook.addWorksheet('Instructions');
    const notes: [string, string][] = [
      [
        'name',
        'Required. A human-readable route name. Rows whose code already exists (in this file or already in the system) are skipped and reported.',
      ],
      [
        'code',
        'Required. A short, unique route code within the organization (e.g. KT-VALLEY). Used to identify routes in reports and visit plans.',
      ],
      ['description', 'Optional.'],
      ['province', 'Optional.'],
      ['district', 'Optional.'],
      ['', ''],
      [
        '',
        'Header row: keep the column headers exactly as shown on the "Routes" sheet (case-insensitive).',
      ],
      [
        '',
        'Remove the example row before uploading. Upload the file via POST /api/v1/routes/import.',
      ],
      [
        '',
        'Dry-run first: POST /routes/import?dryRun=true returns the same report (incl. an error CSV) without changing any data. Re-upload without dryRun when it looks right.',
      ],
      [
        '',
        'By default rows whose code already exists are skipped. Add ?mode=update to update those existing routes in place instead (code/status are never overwritten).',
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
    return { buffer, fileName: 'route-import-template.xlsx' };
  }

  private async parseFile(buffer: Buffer, extension: SpreadsheetExtension) {
    try {
      return await parseSpreadsheet(buffer, extension);
    } catch (error) {
      throw new RouteImportException(
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
      throw new RouteImportException(
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
      const code =
        headerIndex.code !== undefined
          ? String(cells[headerIndex.code] ?? '').trim()
          : undefined;
      const result = normalizeRouteRow(cells, headerIndex);
      if (result.issues.length > 0) {
        issues.push({
          row: rowNumber,
          code: code || undefined,
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
    duplicates: RouteImportDuplicate[];
    toCreate: PendingRow[];
    toUpdate: PendingUpdate[];
  }> {
    const existing = new Map<string, { id: string }>();
    const routes = await this.routeRepo.find({
      where: { organizationId },
      select: { id: true, code: true },
    });
    for (const route of routes) {
      existing.set(route.code.trim().toLowerCase(), { id: route.id });
    }

    const duplicates: RouteImportDuplicate[] = [];
    const toCreate: PendingRow[] = [];
    const toUpdate: PendingUpdate[] = [];
    const seen = new Set<string>();
    for (const item of pending) {
      const key = item.value.code.trim().toLowerCase();
      if (seen.has(key)) {
        duplicates.push({
          row: item.row,
          code: item.value.code,
          reason: 'DUPLICATE_IN_FILE',
        });
        continue;
      }
      const existingRoute = existing.get(key);
      if (existingRoute) {
        if (mode === 'update') {
          seen.add(key);
          toUpdate.push({ ...item, routeId: existingRoute.id });
        } else {
          duplicates.push({
            row: item.row,
            code: item.value.code,
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
            // this batch and leaves the outer transaction usable.
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
                  code: op.item.value.code,
                  errors: [this.describeDbError(error, op.item.value.code)],
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
            action: 'sales.route.import',
            entityType: 'route',
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
    manager: DataSource['manager'],
    organizationId: string,
    ops: ImportOp[],
  ): Promise<void> {
    const routeRepo = manager.getRepository(RouteEntity);

    const creates = ops.filter((op) => op.kind === 'create');
    if (creates.length > 0) {
      await routeRepo.save(
        routeRepo.create(
          creates.map((op) => ({
            organizationId,
            name: op.item.value.name,
            code: op.item.value.code,
            description: op.item.value.description ?? null,
            province: op.item.value.province ?? null,
            district: op.item.value.district ?? null,
            status: 'ACTIVE' as const,
          })),
        ),
      );
    }

    for (const op of ops) {
      if (op.kind !== 'update') continue;
      await routeRepo.update(
        op.item.routeId,
        this.routeUpdateFields(op.item.value),
      );
    }
  }

  private routeUpdateFields(
    row: RouteImportRow,
  ): QueryDeepPartialEntity<RouteEntity> {
    return {
      name: row.name,
      description: row.description ?? null,
      province: row.province ?? null,
      district: row.district ?? null,
    };
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

  private describeDbError(error: unknown, code: string): string {
    const dbCode = (error as { driverError?: { code?: string } })?.driverError
      ?.code;
    if (dbCode && DUPLICATE_CONSTRAINT_CODES.has(dbCode)) {
      return `A route with code '${code}' already exists`;
    }
    return 'Failed to save row (unexpected database error)';
  }
}
