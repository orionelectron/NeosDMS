import * as ExcelJS from 'exceljs';
import {
  cellToValue,
  mapHeaders,
  normalizeHeaderName,
  normalizeOutletRow,
  parseCsv,
  parseSpreadsheet,
} from './outlet-import.parser';

describe('outlet-import parser (unit)', () => {
  describe('parseCsv', () => {
    it('parses a simple CSV', () => {
      expect(parseCsv('a,b,c\n1,2,3\n')).toEqual([
        ['a', 'b', 'c'],
        ['1', '2', '3'],
      ]);
    });

    it('handles quoted fields with commas and escaped quotes', () => {
      const csv =
        'name,address\n"Shrestha, Ram & Co","Ganesh ""Marg"", New Road"\n';
      expect(parseCsv(csv)).toEqual([
        ['name', 'address'],
        ['Shrestha, Ram & Co', 'Ganesh "Marg", New Road'],
      ]);
    });

    it('handles embedded newlines inside quoted fields', () => {
      const csv = 'a,b\n"line1\nline2",x\n';
      expect(parseCsv(csv)).toEqual([
        ['a', 'b'],
        ['line1\nline2', 'x'],
      ]);
    });

    it('handles CRLF line endings', () => {
      expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([
        ['a', 'b'],
        ['1', '2'],
      ]);
    });

    it('strips a UTF-8 BOM from the first field', () => {
      expect(parseCsv('\ufeffname,district\nA,B')).toEqual([
        ['name', 'district'],
        ['A', 'B'],
      ]);
    });
  });

  describe('normalizeHeaderName', () => {
    it('lowercases and normalizes whitespace/punctuation to underscores', () => {
      expect(normalizeHeaderName('  Shop Name ')).toBe('shop_name');
      expect(normalizeHeaderName('owner_name')).toBe('owner_name');
      expect(normalizeHeaderName("Owner's Name")).toBe('owner_s_name');
      expect(normalizeHeaderName('Longitude')).toBe('longitude');
    });
  });

  describe('mapHeaders', () => {
    it('maps aliases to canonical fields', () => {
      const index = mapHeaders([
        'Shop Name',
        'owner_name',
        'Lat',
        'Long',
        'phone',
        'Channel',
      ]);
      expect(index.name).toBe(0);
      expect(index.ownerName).toBe(1);
      expect(index.latitude).toBe(2);
      expect(index.longitude).toBe(3);
      expect(index.phone).toBe(4);
      expect(index.channel).toBe(5);
    });

    it('ignores unknown columns', () => {
      const index = mapHeaders(['name', 'random column', 'district']);
      expect(index.name).toBe(0);
      expect(index.district).toBe(2);
      expect(index.email).toBeUndefined();
    });

    it('throws a clear error when name is missing', () => {
      expect(() => mapHeaders(['district', 'phone'])).toThrow(
        /Required column 'name' not found/,
      );
    });
  });

  describe('normalizeOutletRow', () => {
    const index = mapHeaders([
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
    ]);

    it('normalizes a fully valid row', () => {
      const result = normalizeOutletRow(
        [
          'Surya Store',
          'Ramesh',
          'a@b.com',
          '014440001',
          'Ganesh Marg',
          'Bagmati',
          'Kathmandu',
          '27.7172',
          '85.3136',
          'General Trade',
          'Supermarket',
        ],
        index,
      );
      expect(result.issues).toEqual([]);
      expect(result.value).toEqual({
        name: 'Surya Store',
        ownerName: 'Ramesh',
        email: 'a@b.com',
        phone: '014440001',
        address: 'Ganesh Marg',
        province: 'Bagmati',
        district: 'Kathmandu',
        latitude: 27.7172,
        longitude: 85.3136,
        channel: 'GENERAL_TRADE',
        category: 'Supermarket',
      });
    });

    it('accepts numeric coordinates (excel stores numbers as numbers)', () => {
      const result = normalizeOutletRow(
        [
          'Num Store',
          null,
          null,
          null,
          null,
          null,
          null,
          27.7,
          85.3,
          null,
          null,
        ],
        index,
      );
      expect(result.issues).toEqual([]);
      expect(result.value?.latitude).toBe(27.7);
      expect(result.value?.longitude).toBe(85.3);
      expect(result.value?.channel).toBe('GENERAL_TRADE');
    });

    it('reports a missing name', () => {
      const result = normalizeOutletRow(
        ['   ', null, null, null, null, null, null, null, null, null, null],
        index,
      );
      expect(result.issues).toEqual(['name is required']);
      expect(result.value).toBeUndefined();
    });

    it('reports a non-numeric latitude', () => {
      const result = normalizeOutletRow(
        ['X', null, null, null, null, null, null, 'abc', '85.3', null, null],
        index,
      );
      expect(result.issues).toContain('latitude must be a number');
    });

    it('reports out-of-range coordinates', () => {
      const result = normalizeOutletRow(
        ['X', null, null, null, null, null, null, '91', '200', null, null],
        index,
      );
      expect(result.issues).toContain('latitude must be between -90 and 90');
      expect(result.issues).toContain('longitude must be between -180 and 180');
    });

    it('reports an invalid channel', () => {
      const result = normalizeOutletRow(
        [
          'X',
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          'RETAIL_SHOP',
          null,
        ],
        index,
      );
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.stringContaining('channel must be one of'),
        ]),
      );
    });

    it('maps empty strings to null and keeps the rest', () => {
      const result = normalizeOutletRow(
        ['Only Name', '', '', '', '', '', '', '', '', '', ''],
        index,
      );
      expect(result.issues).toEqual([]);
      expect(result.value).toEqual({
        name: 'Only Name',
        ownerName: null,
        email: null,
        phone: null,
        address: null,
        province: null,
        district: null,
        latitude: null,
        longitude: null,
        channel: 'GENERAL_TRADE',
        category: null,
      });
    });
  });

  describe('parseSpreadsheet (xlsx)', () => {
    it('parses an xlsx workbook: header + data rows, numbers preserved', async () => {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Outlets');
      ws.addRow(['name', 'district', 'latitude', 'longitude']);
      ws.addRow(['Store A', 'Kathmandu', 27.7172, 85.3136]);
      ws.addRow(['Store B', 'Lalitpur', 27.65, 85.32]);

      const parsed = await parseSpreadsheet(
        Buffer.from(await wb.xlsx.writeBuffer()),
        'xlsx',
      );
      expect(parsed.header).toEqual([
        'name',
        'district',
        'latitude',
        'longitude',
      ]);
      expect(parsed.rows).toEqual([
        ['Store A', 'Kathmandu', 27.7172, 85.3136],
        ['Store B', 'Lalitpur', 27.65, 85.32],
      ]);
    });

    it('throws a friendly error for a non-spreadsheet buffer', async () => {
      await expect(
        parseSpreadsheet(Buffer.from('this is not xlsx'), 'xlsx'),
      ).rejects.toThrow(/Could not read the file as an Excel workbook/);
    });
  });

  describe('cellToValue', () => {
    it('converts plain values and nulls', () => {
      expect(cellToValue('  ')).toBeNull();
      expect(cellToValue('abc')).toBe('abc');
      expect(cellToValue(27.7)).toBe(27.7);
      expect(cellToValue(null)).toBeNull();
      expect(cellToValue(undefined)).toBeNull();
      expect(cellToValue(true)).toBeNull();
    });

    it('unwraps formula cells to their result', () => {
      expect(cellToValue({ formula: 'A1', result: 42 })).toBe(42);
    });
  });
});
