import * as ExcelJS from 'exceljs';
import { DataSource } from 'typeorm';
import { AuditLogEntity } from '../audit/audit-log.entity';
import { PartyEntity } from '../accounting/entities/party.entity';
import { OutletRouteEntity } from './entities/outlet-route.entity';
import { OutletEntity } from './entities/outlet.entity';
import { RouteEntity } from './entities/route.entity';
import { OutletImportException } from './field.errors';
import { OutletImportService } from './outlet-import.service';
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

const HEADER = [
  'name',
  'owner_name',
  'email',
  'phone',
  'address',
  'province',
  'district',
  'latitude',
  'longitude',
  'channel',
  'category',
];

describe('OutletImportService (real DB)', () => {
  const actorId = SALESMAN_USER_ID;

  let dataSource: DataSource;
  let service: OutletImportService;
  let tx: TestTransaction;

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    await seedBaseline(dataSource);
    const module = await createFieldTestingModule(dataSource);
    service = module.get(OutletImportService);
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

  const outletRepo = () => dataSource.getRepository(OutletEntity);

  async function xlsxBuffer(
    rows: (string | number | null)[][],
  ): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Outlets');
    rows.forEach((row) => ws.addRow(row));
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  function outletRow(name: string, channel = 'GENERAL_TRADE') {
    return [
      name,
      'Ramesh',
      `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}@example.com`,
      '014440001',
      'Ganesh Marg',
      'Bagmati',
      'Kathmandu',
      27.7172,
      85.3136,
      channel,
      'Supermarket',
    ];
  }

  describe('importOutlets (xlsx)', () => {
    it('imports valid rows, provisions customer parties, and audits', async () => {
      const buffer = await xlsxBuffer([
        HEADER,
        outletRow('Import A'),
        outletRow('Import B'),
        outletRow('Import C'),
      ]);

      const report = await service.importOutlets(
        TEST_ORG_ID,
        actorId,
        'outlets.xlsx',
        buffer,
        'xlsx',
      );

      expect(report).toMatchObject({
        fileName: 'outlets.xlsx',
        totalRows: 3,
        imported: 3,
        duplicateCount: 0,
        errorCount: 0,
        duplicates: [],
        errors: [],
      });

      const outlets = await outletRepo().find({ relations: { party: true } });
      const names = outlets.map((o) => o.name).sort();
      expect(names).toEqual(['Import A', 'Import B', 'Import C']);
      for (const outlet of outlets) {
        expect(outlet.partyId).not.toBeNull();
        expect(outlet.party?.isCustomer).toBe(true);
        expect(outlet.party?.name).toBe(outlet.name);
        expect(Number(outlet.latitude)).toBeCloseTo(27.7172, 4);
        expect(outlet.status).toBe('ACTIVE');
      }

      const audits = await dataSource
        .getRepository(AuditLogEntity)
        .find({ where: { action: 'sales.outlet.import' } });
      expect(audits).toHaveLength(1);
      expect(audits[0].userId).toBe(actorId);
      expect(audits[0].newData).toMatchObject({ imported: 3 });
    });

    it('creates a route from route_name and links each outlet to it', async () => {
      const buffer = await xlsxBuffer([
        [...HEADER, 'route_name'],
        [...outletRow('Routed A'), 'Kathmandu Valley Core'],
        [...outletRow('Routed B'), 'Kathmandu Valley Core'],
        [...outletRow('Routed C'), 'Pokhara Loop'],
      ]);

      const report = await service.importOutlets(
        TEST_ORG_ID,
        actorId,
        'routed.xlsx',
        buffer,
        'xlsx',
      );

      expect(report.imported).toBe(3);
      expect(report.errorCount).toBe(0);
      expect(report.routesCreated).toBe(2);

      const routes = await dataSource
        .getRepository(RouteEntity)
        .find({ where: { organizationId: TEST_ORG_ID } });
      expect(routes).toHaveLength(2);
      const byName = new Map(routes.map((r) => [r.name, r]));
      expect(byName.get('Kathmandu Valley Core')).toBeDefined();
      expect(byName.get('Pokhara Loop')).toBeDefined();
      for (const route of routes) {
        expect(route.status).toBe('ACTIVE');
        expect(route.code).toBeTruthy();
      }

      const linkRepo = dataSource.getRepository(OutletRouteEntity);
      const links = await linkRepo.find({
        where: { organizationId: TEST_ORG_ID },
      });
      expect(links).toHaveLength(3);
      const outlets = await outletRepo().find();
      const valley = byName.get('Kathmandu Valley Core')!;
      const valleyOutlets = links
        .filter((l) => l.routeId === valley.id)
        .map((l) => outlets.find((o) => o.id === l.outletId)?.name)
        .sort();
      expect(valleyOutlets).toEqual(['Routed A', 'Routed B']);
    });

    it('reuses an existing route by name instead of creating a duplicate', async () => {
      const routeRepo = dataSource.getRepository(RouteEntity);
      const existing = await routeRepo.save(
        routeRepo.create({
          organizationId: TEST_ORG_ID,
          name: 'Shared Route',
          code: 'SHARED',
          status: 'ACTIVE',
        }),
      );

      const buffer = await xlsxBuffer([
        [...HEADER, 'route_name'],
        [...outletRow('On Shared'), 'Shared Route'],
      ]);

      const report = await service.importOutlets(
        TEST_ORG_ID,
        actorId,
        'shared.xlsx',
        buffer,
        'xlsx',
      );

      expect(report.routesCreated).toBe(0);
      const routes = await routeRepo.find({
        where: { organizationId: TEST_ORG_ID },
      });
      expect(routes).toHaveLength(1);
      expect(routes[0].id).toBe(existing.id);

      const link = await dataSource
        .getRepository(OutletRouteEntity)
        .findOneBy({ organizationId: TEST_ORG_ID });
      expect(link?.routeId).toBe(existing.id);
    });

    it('does not create routes when route_name is blank', async () => {
      const buffer = await xlsxBuffer([
        [...HEADER, 'route_name'],
        [...outletRow('No Route'), '   '],
      ]);

      const report = await service.importOutlets(
        TEST_ORG_ID,
        actorId,
        'noroute.xlsx',
        buffer,
        'xlsx',
      );

      expect(report.imported).toBe(1);
      expect(report.routesCreated).toBe(0);
      expect(
        await dataSource.getRepository(RouteEntity).count({
          where: { organizationId: TEST_ORG_ID },
        }),
      ).toBe(0);
      expect(
        await dataSource.getRepository(OutletRouteEntity).count(),
      ).toBe(0);
    });

    it('skips duplicate rows within the file', async () => {
      const buffer = await xlsxBuffer([
        HEADER,
        outletRow('Dup Store'),
        outletRow('Dup Store'),
        outletRow('Other Store'),
      ]);

      const report = await service.importOutlets(
        TEST_ORG_ID,
        actorId,
        'outlets.xlsx',
        buffer,
        'xlsx',
      );

      expect(report.imported).toBe(2);
      expect(report.duplicateCount).toBe(1);
      expect(report.duplicates[0]).toEqual({
        row: 3,
        name: 'Dup Store',
        reason: 'DUPLICATE_IN_FILE',
      });
      expect(report.errors).toEqual([]);
    });

    it('skips outlets that already exist in the org', async () => {
      await outletRepo().save(
        outletRepo().create({
          organizationId: TEST_ORG_ID,
          name: 'Existing Outlet',
          partyId: null,
          channel: 'GENERAL_TRADE',
          status: 'ACTIVE',
        }),
      );

      const buffer = await xlsxBuffer([
        HEADER,
        outletRow('Existing Outlet'),
        outletRow('New Outlet'),
      ]);

      const report = await service.importOutlets(
        TEST_ORG_ID,
        actorId,
        'outlets.xlsx',
        buffer,
        'xlsx',
      );

      expect(report.imported).toBe(1);
      expect(report.duplicateCount).toBe(1);
      expect(report.duplicates[0]).toEqual({
        row: 2,
        name: 'Existing Outlet',
        reason: 'ALREADY_EXISTS',
      });
    });

    it('reports per-row validation errors and still imports the valid rows', async () => {
      const buffer = await xlsxBuffer([
        HEADER,
        outletRow('Good One'),
        // has a non-empty cell (district) so exceljs keeps the row, but no name
        ['', null, null, null, null, null, 'Kathmandu', null, null, null, null],
        [
          'Broken',
          null,
          null,
          null,
          null,
          null,
          null,
          'not-a-number',
          null,
          null,
          null,
        ],
        outletRow('Good Two'),
      ]);

      const report = await service.importOutlets(
        TEST_ORG_ID,
        actorId,
        'outlets.xlsx',
        buffer,
        'xlsx',
      );

      expect(report.totalRows).toBe(4);
      expect(report.imported).toBe(2);
      expect(report.errorCount).toBe(2);
      expect(report.errors).toEqual(
        expect.arrayContaining([
          { row: 3, name: undefined, errors: ['name is required'] },
          {
            row: 4,
            name: 'Broken',
            errors: ['latitude must be a number'],
          },
        ]),
      );
    });

    it('reports an invalid channel value', async () => {
      const buffer = await xlsxBuffer([
        HEADER,
        outletRow('Channel Store', 'RETAIL'),
      ]);
      const report = await service.importOutlets(
        TEST_ORG_ID,
        actorId,
        'outlets.xlsx',
        buffer,
        'xlsx',
      );
      expect(report.imported).toBe(0);
      expect(report.errorCount).toBe(1);
      expect(report.errors[0].errors[0]).toContain('channel must be one of');
    });

    it('maps spreadsheet row numbers correctly (header is row 1)', async () => {
      const buffer = await xlsxBuffer([
        HEADER,
        outletRow('Row Two'),
        ['Bad', null, null, null, null, null, null, 'oops', null, null, null],
        outletRow('Row Four'),
      ]);
      const report = await service.importOutlets(
        TEST_ORG_ID,
        actorId,
        'outlets.xlsx',
        buffer,
        'xlsx',
      );
      expect(report.imported).toBe(2);
      expect(report.errors[0].row).toBe(3);
      expect(report.errors[0].name).toBe('Bad');
    });
  });

  describe('importOutlets (csv)', () => {
    it('imports valid CSV rows and skips in-file duplicates', async () => {
      const csv = [
        HEADER.join(','),
        ['CSV Store', '', '', '', '', '', '', '27.7', '85.3', '', ''].join(','),
        ['CSV Store', '', '', '', '', '', '', '27.7', '85.3', '', ''].join(','),
        [
          'CSV Store 2',
          '',
          '',
          '',
          '',
          '',
          '',
          '27.7',
          '85.3',
          'General Trade',
          '',
        ].join(','),
      ].join('\n');

      const report = await service.importOutlets(
        TEST_ORG_ID,
        actorId,
        'outlets.csv',
        Buffer.from(csv, 'utf8'),
        'csv',
      );

      expect(report.imported).toBe(2);
      expect(report.duplicateCount).toBe(1);
      expect(report.duplicates[0]).toEqual({
        row: 3,
        name: 'CSV Store',
        reason: 'DUPLICATE_IN_FILE',
      });
    });

    it('auto-detects semicolon and pipe CSV delimiters', async () => {
      const semi = [
        HEADER.join(';'),
        [
          'Semi Store',
          '',
          '',
          '',
          '',
          'Bagmati',
          'Kathmandu',
          '27.7',
          '85.3',
          '',
          '',
        ].join(';'),
      ].join('\n');
      const semiReport = await service.importOutlets(
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
        [
          'Pipe Store',
          '',
          '',
          '',
          '',
          'Bagmati',
          'Lalitpur',
          '27.65',
          '85.32',
          '',
          '',
        ].join('|'),
      ].join('\n');
      const pipeReport = await service.importOutlets(
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
        outletRow('Dry A'),
        outletRow('Dry B'),
      ]);

      const report = await service.importOutlets(
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
      expect(await outletRepo().count()).toBe(0);

      const audits = await dataSource
        .getRepository(AuditLogEntity)
        .find({ where: { action: 'sales.outlet.import' } });
      expect(audits).toHaveLength(0);
    });

    it('reports duplicates and errors in preview mode without inserting', async () => {
      const buffer = await xlsxBuffer([
        HEADER,
        outletRow('Dry Dup'),
        outletRow('Dry Dup'),
        ['Bad', null, null, null, null, null, null, 'oops', null, null, null],
      ]);

      const report = await service.importOutlets(
        TEST_ORG_ID,
        actorId,
        'dry.xlsx',
        buffer,
        'xlsx',
        { dryRun: true },
      );

      expect(report.dryRun).toBe(true);
      expect(report.imported).toBe(1);
      expect(report.duplicateCount).toBe(1);
      expect(report.errorCount).toBe(1);
      expect(await outletRepo().count()).toBe(0);
    });

    it('previews routesCreated without writing routes or links', async () => {
      const buffer = await xlsxBuffer([
        [...HEADER, 'route_name'],
        [...outletRow('Dry Routed'), 'Dry Route'],
      ]);

      const report = await service.importOutlets(
        TEST_ORG_ID,
        actorId,
        'dry.xlsx',
        buffer,
        'xlsx',
        { dryRun: true },
      );

      expect(report.dryRun).toBe(true);
      expect(report.routesCreated).toBe(1);
      expect(
        await dataSource.getRepository(RouteEntity).count({
          where: { organizationId: TEST_ORG_ID },
        }),
      ).toBe(0);
      expect(
        await dataSource.getRepository(OutletRouteEntity).count(),
      ).toBe(0);
    });
  });

  describe('mode=update', () => {
    it('updates existing outlets (and their customer party), creates the rest', async () => {
      const partyRepo = dataSource.getRepository(PartyEntity);
      const party = await partyRepo.save(
        partyRepo.create({
          organizationId: TEST_ORG_ID,
          name: 'Update Me',
          legalName: 'Update Me',
          partyKind: 'BUSINESS',
          isCustomer: true,
          email: 'old@example.com',
          phone: '000',
          address: 'Old Address',
          creditLimit: '0',
          openingBalance: '0',
        }),
      );
      await outletRepo().save(
        outletRepo().create({
          organizationId: TEST_ORG_ID,
          partyId: party.id,
          name: 'Update Me',
          channel: 'GENERAL_TRADE',
          status: 'ACTIVE',
          email: 'old-outlet@example.com',
        }),
      );

      const buffer = await xlsxBuffer([
        HEADER,
        [
          'Update Me',
          'New Owner',
          'new@example.com',
          '014440001',
          'New Address',
          'Bagmati',
          'Kathmandu',
          27.71,
          85.31,
          'MODERN_TRADE',
          'Mega Store',
        ],
        outletRow('Brand New'),
      ]);

      const report = await service.importOutlets(
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
      expect(report.updates).toEqual([{ row: 2, name: 'Update Me' }]);
      expect(report.duplicateCount).toBe(0);
      expect(report.errorCount).toBe(0);

      const updated = await outletRepo().findOneBy({ name: 'Update Me' });
      expect(updated).toMatchObject({
        ownerName: 'New Owner',
        email: 'new@example.com',
        phone: '014440001',
        address: 'New Address',
        channel: 'MODERN_TRADE',
        category: 'Mega Store',
        status: 'ACTIVE',
      });
      expect(Number(updated?.latitude)).toBeCloseTo(27.71, 4);

      const partyAfter = await partyRepo.findOneBy({ id: party.id });
      expect(partyAfter).toMatchObject({
        name: 'Update Me',
        email: 'new@example.com',
        phone: '014440001',
        address: 'New Address',
      });

      expect(
        await outletRepo().findOneBy({ name: 'Brand New' }),
      ).not.toBeNull();
    });

    it('still reports in-file duplicates as duplicates in update mode', async () => {
      await outletRepo().save(
        outletRepo().create({
          organizationId: TEST_ORG_ID,
          name: 'Dup In Update',
          partyId: null,
          channel: 'GENERAL_TRADE',
          status: 'ACTIVE',
        }),
      );

      const buffer = await xlsxBuffer([
        HEADER,
        outletRow('Dup In Update'),
        outletRow('Dup In Update'),
      ]);
      const report = await service.importOutlets(
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
        name: 'Dup In Update',
        reason: 'DUPLICATE_IN_FILE',
      });
    });
  });

  describe('errorsCsv', () => {
    it('contains the header row, failing rows with values, and the issue text', async () => {
      const buffer = await xlsxBuffer([
        HEADER,
        outletRow('Good'),
        [
          'Bad, Co',
          null,
          null,
          null,
          null,
          null,
          'Kathmandu',
          'oops',
          null,
          null,
          null,
        ],
      ]);

      const report = await service.importOutlets(
        TEST_ORG_ID,
        actorId,
        'err.xlsx',
        buffer,
        'xlsx',
      );

      expect(report.imported).toBe(1);
      const lines = report.errorsCsv.split('\r\n');
      expect(lines[0]).toBe(
        'name,owner_name,email,phone,address,province,district,latitude,longitude,channel,category,error',
      );
      expect(lines[1]).toContain('"Bad, Co"');
      expect(lines[1]).toContain('latitude must be a number');
      expect(lines).toHaveLength(2);
    });

    it('is header-only when there are no errors', async () => {
      const buffer = await xlsxBuffer([HEADER, outletRow('Clean Store')]);
      const report = await service.importOutlets(
        TEST_ORG_ID,
        actorId,
        'clean.xlsx',
        buffer,
        'xlsx',
      );
      expect(report.errorsCsv).toBe(
        'name,owner_name,email,phone,address,province,district,latitude,longitude,channel,category,error',
      );
    });
  });

  describe('structural errors', () => {
    it('rejects an empty file', async () => {
      await expect(
        service.importOutlets(
          TEST_ORG_ID,
          actorId,
          'empty.xlsx',
          Buffer.from(''),
          'xlsx',
        ),
      ).rejects.toThrow(OutletImportException);
    });

    it('rejects a file without a name column', async () => {
      const buffer = await xlsxBuffer([
        ['district', 'phone'],
        ['Kathmandu', '014440001'],
      ]);
      await expect(
        service.importOutlets(TEST_ORG_ID, actorId, 'bad.xlsx', buffer, 'xlsx'),
      ).rejects.toThrow(/Required column 'name' not found/);
    });

    it('rejects files over the max row cap', async () => {
      const lines = [HEADER.join(',')];
      for (let i = 0; i < 10001; i += 1) {
        lines.push(`Bulk Row ${i},,,,,,,,,,`);
      }
      await expect(
        service.importOutlets(
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
      expect(service.resolveExtension('outlets.xlsx')).toBe('xlsx');
      expect(service.resolveExtension('outlets.csv')).toBe('csv');
    });
  });

  describe('generateTemplate', () => {
    it('produces a valid xlsx with the expected headers', async () => {
      const { buffer, fileName } = await service.generateTemplate();
      expect(fileName).toBe('outlet-import-template.xlsx');

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);
      const sheet = wb.getWorksheet('Outlets');
      expect(sheet).toBeDefined();
      const headers: (string | number | null)[] = [];
      sheet?.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
        headers[col - 1] = (cell.value as string | number | null) ?? null;
      });
      expect(headers).toEqual([...HEADER, 'route_name']);
      expect(wb.getWorksheet('Instructions')).toBeDefined();
    });
  });
});
