import * as ExcelJS from 'exceljs';
import { DataSource } from 'typeorm';
import { AuditLogEntity } from '../audit/audit-log.entity';
import { RouteEntity } from './entities/route.entity';
import { RouteImportException } from './field.errors';
import { RouteImportService } from './route-import.service';
import {
  createFieldTestingModule,
  endTestTransaction,
  beginTestTransaction,
  seedBaseline,
  SALESMAN_USER_ID,
  TEST_ORG_ID,
  type TestTransaction,
} from '../testing/field-test.harness';
import { createTestDataSource } from '../testing/test-db';

const HEADER = ['name', 'code', 'description', 'province', 'district'];

describe('RouteImportService (real DB)', () => {
  const actorId = SALESMAN_USER_ID;

  let dataSource: DataSource;
  let service: RouteImportService;
  let tx: TestTransaction;

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    await seedBaseline(dataSource);
    const module = await createFieldTestingModule(dataSource);
    service = module.get(RouteImportService);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    tx = await beginTestTransaction(dataSource);
  });

  afterEach(async () => {
    await endTestTransaction(dataSource, tx);
  });

  const routeRepo = () => dataSource.getRepository(RouteEntity);

  async function xlsxBuffer(
    rows: (string | number | null)[][],
  ): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Routes');
    rows.forEach((row) => ws.addRow(row));
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  function routeRow(name: string, code: string) {
    return [name, code, 'Daily route', 'Bagmati', 'Kathmandu'];
  }

  describe('importRoutes (xlsx)', () => {
    it('imports valid rows and audits', async () => {
      const buffer = await xlsxBuffer([
        HEADER,
        routeRow('Route A', 'RT-A'),
        routeRow('Route B', 'RT-B'),
        routeRow('Route C', 'RT-C'),
      ]);

      const report = await service.importRoutes(
        TEST_ORG_ID,
        actorId,
        'routes.xlsx',
        buffer,
        'xlsx',
      );

      expect(report).toMatchObject({
        fileName: 'routes.xlsx',
        totalRows: 3,
        imported: 3,
        duplicateCount: 0,
        errorCount: 0,
        duplicates: [],
        errors: [],
      });

      const routes = await routeRepo().find();
      expect(routes.map((r) => r.code).sort()).toEqual([
        'RT-A',
        'RT-B',
        'RT-C',
      ]);
      for (const route of routes) {
        expect(route.status).toBe('ACTIVE');
        expect(route.description).toBe('Daily route');
        expect(route.province).toBe('Bagmati');
        expect(route.district).toBe('Kathmandu');
      }

      const audits = await dataSource
        .getRepository(AuditLogEntity)
        .find({ where: { action: 'sales.route.import' } });
      expect(audits).toHaveLength(1);
      expect(audits[0].userId).toBe(actorId);
      expect(audits[0].newData).toMatchObject({ imported: 3 });
    });

    it('skips duplicate codes within the file', async () => {
      const buffer = await xlsxBuffer([
        HEADER,
        routeRow('Dup Route', 'RT-DUP'),
        routeRow('Dup Route Again', 'RT-DUP'),
        routeRow('Other Route', 'RT-OTHER'),
      ]);

      const report = await service.importRoutes(
        TEST_ORG_ID,
        actorId,
        'routes.xlsx',
        buffer,
        'xlsx',
      );

      expect(report.imported).toBe(2);
      expect(report.duplicateCount).toBe(1);
      expect(report.duplicates[0]).toEqual({
        row: 3,
        code: 'RT-DUP',
        reason: 'DUPLICATE_IN_FILE',
      });
      expect(report.errors).toEqual([]);
    });

    it('skips routes whose code already exists in the org', async () => {
      await routeRepo().save(
        routeRepo().create({
          organizationId: TEST_ORG_ID,
          name: 'Existing Route',
          code: 'RT-EXIST',
          status: 'ACTIVE',
        }),
      );

      const buffer = await xlsxBuffer([
        HEADER,
        routeRow('Existing Route', 'RT-EXIST'),
        routeRow('New Route', 'RT-NEW'),
      ]);

      const report = await service.importRoutes(
        TEST_ORG_ID,
        actorId,
        'routes.xlsx',
        buffer,
        'xlsx',
      );

      expect(report.imported).toBe(1);
      expect(report.duplicateCount).toBe(1);
      expect(report.duplicates[0]).toEqual({
        row: 2,
        code: 'RT-EXIST',
        reason: 'ALREADY_EXISTS',
      });
    });

    it('reports per-row validation errors and still imports the valid rows', async () => {
      const buffer = await xlsxBuffer([
        HEADER,
        routeRow('Good One', 'RT-GOOD1'),
        // has a non-empty cell (district) so exceljs keeps the row, but no name
        [null, 'RT-NONAME', null, null, 'Kathmandu'],
        // valid name/code but code too long
        ['Long Code', 'X'.repeat(51), null, null, null],
        routeRow('Good Two', 'RT-GOOD2'),
      ]);

      const report = await service.importRoutes(
        TEST_ORG_ID,
        actorId,
        'routes.xlsx',
        buffer,
        'xlsx',
      );

      expect(report.totalRows).toBe(4);
      expect(report.imported).toBe(2);
      expect(report.errorCount).toBe(2);
      expect(report.errors).toEqual(
        expect.arrayContaining([
          { row: 3, code: 'RT-NONAME', errors: ['name is required'] },
          {
            row: 4,
            code: 'X'.repeat(51),
            errors: ['code must be 50 characters or fewer'],
          },
        ]),
      );
    });

    it('maps spreadsheet row numbers correctly (header is row 1)', async () => {
      const buffer = await xlsxBuffer([
        HEADER,
        routeRow('Row Two', 'RT-R2'),
        [null, 'RT-BAD', null, null, null],
        routeRow('Row Four', 'RT-R4'),
      ]);
      const report = await service.importRoutes(
        TEST_ORG_ID,
        actorId,
        'routes.xlsx',
        buffer,
        'xlsx',
      );
      expect(report.imported).toBe(2);
      expect(report.errors[0].row).toBe(3);
      expect(report.errors[0].code).toBe('RT-BAD');
    });
  });

  describe('importRoutes (csv)', () => {
    it('imports valid CSV rows and skips in-file duplicates', async () => {
      const csv = [
        HEADER.join(','),
        ['CSV Route', 'RT-CSV', '', '', ''].join(','),
        ['CSV Route', 'RT-CSV', '', '', ''].join(','),
        ['CSV Route 2', 'RT-CSV2', '', '', ''].join(','),
      ].join('\n');

      const report = await service.importRoutes(
        TEST_ORG_ID,
        actorId,
        'routes.csv',
        Buffer.from(csv, 'utf8'),
        'csv',
      );

      expect(report.imported).toBe(2);
      expect(report.duplicateCount).toBe(1);
      expect(report.duplicates[0]).toEqual({
        row: 3,
        code: 'RT-CSV',
        reason: 'DUPLICATE_IN_FILE',
      });
    });

    it('auto-detects semicolon and pipe CSV delimiters', async () => {
      const semi = [
        HEADER.join(';'),
        ['Semi Route', 'RT-SEMI', '', 'Bagmati', 'Kathmandu'].join(';'),
      ].join('\n');
      const semiReport = await service.importRoutes(
        TEST_ORG_ID,
        actorId,
        'semi.csv',
        Buffer.from(semi, 'utf8'),
        'csv',
      );
      expect(semiReport.imported).toBe(1);
      expect(semiReport.errorCount).toBe(0);

      const pipe = [
        HEADER.join('|'),
        ['Pipe Route', 'RT-PIPE', '', 'Bagmati', 'Lalitpur'].join('|'),
      ].join('\n');
      const pipeReport = await service.importRoutes(
        TEST_ORG_ID,
        actorId,
        'pipe.csv',
        Buffer.from(pipe, 'utf8'),
        'csv',
      );
      expect(pipeReport.imported).toBe(1);
      expect(pipeReport.errorCount).toBe(0);
    });
  });

  describe('dryRun', () => {
    it('reports would-be counts without writing anything or auditing', async () => {
      const buffer = await xlsxBuffer([
        HEADER,
        routeRow('Dry A', 'RT-DRYA'),
        routeRow('Dry B', 'RT-DRYB'),
      ]);

      const report = await service.importRoutes(
        TEST_ORG_ID,
        actorId,
        'dry.xlsx',
        buffer,
        'xlsx',
        { dryRun: true },
      );

      expect(report.dryRun).toBe(true);
      expect(report.imported).toBe(2);
      expect(report.updated).toBe(0);
      expect(report.duplicateCount).toBe(0);
      expect(report.errorCount).toBe(0);
      expect(report.errorsCsv).not.toBe('');
      expect(await routeRepo().count()).toBe(0);

      const audits = await dataSource
        .getRepository(AuditLogEntity)
        .find({ where: { action: 'sales.route.import' } });
      expect(audits).toHaveLength(0);
    });
  });

  describe('mode=update', () => {
    it('updates existing routes and creates the rest', async () => {
      await routeRepo().save(
        routeRepo().create({
          organizationId: TEST_ORG_ID,
          name: 'Old Name',
          code: 'RT-UPD',
          status: 'ACTIVE',
        }),
      );

      const buffer = await xlsxBuffer([
        HEADER,
        ['New Name', 'RT-UPD', 'Updated description', 'Bagmati', 'Lalitpur'],
        routeRow('Brand New', 'RT-BRAND'),
      ]);

      const report = await service.importRoutes(
        TEST_ORG_ID,
        actorId,
        'upd.xlsx',
        buffer,
        'xlsx',
        { mode: 'update' },
      );

      expect(report.mode).toBe('update');
      expect(report.imported).toBe(1);
      expect(report.updated).toBe(1);
      expect(report.updates).toEqual([{ row: 2, code: 'RT-UPD' }]);
      expect(report.duplicateCount).toBe(0);
      expect(report.errorCount).toBe(0);

      const updated = await routeRepo().findOneBy({ code: 'RT-UPD' });
      expect(updated).toMatchObject({
        name: 'New Name',
        description: 'Updated description',
        province: 'Bagmati',
        district: 'Lalitpur',
        status: 'ACTIVE',
      });
    });

    it('still reports in-file duplicates as duplicates in update mode', async () => {
      await routeRepo().save(
        routeRepo().create({
          organizationId: TEST_ORG_ID,
          name: 'Dup In Update',
          code: 'RT-DUPD',
          status: 'ACTIVE',
        }),
      );

      const buffer = await xlsxBuffer([
        HEADER,
        routeRow('Dup In Update', 'RT-DUPD'),
        routeRow('Dup In Update', 'RT-DUPD'),
      ]);
      const report = await service.importRoutes(
        TEST_ORG_ID,
        actorId,
        'upd.xlsx',
        buffer,
        'xlsx',
        { mode: 'update' },
      );

      expect(report.updated).toBe(1);
      expect(report.duplicateCount).toBe(1);
      expect(report.duplicates[0]).toEqual({
        row: 3,
        code: 'RT-DUPD',
        reason: 'DUPLICATE_IN_FILE',
      });
    });
  });

  describe('errorsCsv', () => {
    it('contains the header row, failing rows with values, and the issue text', async () => {
      const buffer = await xlsxBuffer([
        HEADER,
        routeRow('Good', 'RT-GOOD'),
        [null, 'RT-BAD', null, null, 'Kathmandu'],
      ]);

      const report = await service.importRoutes(
        TEST_ORG_ID,
        actorId,
        'err.xlsx',
        buffer,
        'xlsx',
      );

      expect(report.imported).toBe(1);
      const lines = report.errorsCsv.split('\r\n');
      expect(lines[0]).toBe('name,code,description,province,district,error');
      expect(lines[1]).toContain('RT-BAD');
      expect(lines[1]).toContain('name is required');
      expect(lines).toHaveLength(2);
    });

    it('is header-only when there are no errors', async () => {
      const buffer = await xlsxBuffer([HEADER, routeRow('Clean', 'RT-CLEAN')]);
      const report = await service.importRoutes(
        TEST_ORG_ID,
        actorId,
        'clean.xlsx',
        buffer,
        'xlsx',
      );
      expect(report.errorsCsv).toBe(
        'name,code,description,province,district,error',
      );
    });
  });

  describe('structural errors', () => {
    it('rejects an empty file', async () => {
      await expect(
        service.importRoutes(
          TEST_ORG_ID,
          actorId,
          'empty.xlsx',
          Buffer.from(''),
          'xlsx',
        ),
      ).rejects.toThrow(RouteImportException);
    });

    it('rejects a file without a code column', async () => {
      const buffer = await xlsxBuffer([
        ['name', 'district'],
        ['Some Route', 'Kathmandu'],
      ]);
      await expect(
        service.importRoutes(TEST_ORG_ID, actorId, 'bad.xlsx', buffer, 'xlsx'),
      ).rejects.toThrow(/Required column 'code' not found/);
    });

    it('rejects files over the max row cap', async () => {
      const lines = [HEADER.join(',')];
      for (let i = 0; i < 5001; i += 1) {
        lines.push(`Bulk Route ${i},RT-BULK${i},,,`);
      }
      await expect(
        service.importRoutes(
          TEST_ORG_ID,
          actorId,
          'big.csv',
          Buffer.from(lines.join('\n'), 'utf8'),
          'csv',
        ),
      ).rejects.toThrow(/maximum supported/);
    });

    it('resolveExtension rejects legacy .xls and unknown types', () => {
      expect(() => service.resolveExtension('old.xls')).toThrow(
        /\.xls files are not supported/,
      );
      expect(() => service.resolveExtension('data.pdf')).toThrow(
        /Unsupported file type/,
      );
      expect(service.resolveExtension('routes.xlsx')).toBe('xlsx');
      expect(service.resolveExtension('routes.csv')).toBe('csv');
    });
  });

  describe('generateTemplate', () => {
    it('produces a valid xlsx with the expected headers', async () => {
      const { buffer, fileName } = await service.generateTemplate();
      expect(fileName).toBe('route-import-template.xlsx');

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(
        buffer as unknown as Parameters<typeof wb.xlsx.load>[0],
      );
      const sheet = wb.getWorksheet('Routes');
      expect(sheet).toBeDefined();
      const headers: (string | number | null)[] = [];
      sheet?.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
        headers[col - 1] = (cell.value as string | number | null) ?? null;
      });
      expect(headers).toEqual(HEADER);
      expect(wb.getWorksheet('Instructions')).toBeDefined();
    });
  });
});
