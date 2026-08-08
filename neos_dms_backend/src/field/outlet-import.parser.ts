import * as ExcelJS from 'exceljs';
import { OUTLET_CHANNEL, OutletChannel } from './field.constants';

export type SpreadsheetExtension = 'xlsx' | 'csv';

/** Canonical outlet fields we accept from a spreadsheet, keyed by aliases. */
export const OUTLET_FIELD_ALIASES: Record<string, string[]> = {
  name: [
    'name',
    'outlet',
    'outlet_name',
    'outlet name',
    'shop_name',
    'shop name',
    'business_name',
    'business name',
    'store_name',
    'store name',
    'customer_name',
    'customer name',
  ],
  ownerName: ['owner_name', 'owner name', 'owner', 'proprietor'],
  email: ['email', 'email_address', 'email address'],
  phone: [
    'phone',
    'phone_number',
    'phone number',
    'contact',
    'contact_number',
    'contact number',
    'mobile',
    'mobile_number',
    'mobile number',
  ],
  address: ['address', 'location', 'street_address', 'street address'],
  province: ['province', 'state', 'region'],
  district: ['district'],
  latitude: ['latitude', 'lat'],
  longitude: ['longitude', 'long', 'lng', 'lon'],
  channel: [
    'channel',
    'outlet_channel',
    'outlet channel',
    'channel_type',
    'channel type',
    'type',
  ],
  category: [
    'category',
    'outlet_category',
    'outlet category',
    'category_type',
    'category type',
  ],
  routeName: [
    'route_name',
    'route name',
    'route',
    'routing',
    'beat',
    'beat_name',
    'beat name',
  ],
};

export interface OutletHeaderIndex {
  name: number;
  ownerName?: number;
  email?: number;
  phone?: number;
  address?: number;
  province?: number;
  district?: number;
  latitude?: number;
  longitude?: number;
  channel?: number;
  category?: number;
  routeName?: number;
}

export interface OutletImportRow {
  name: string;
  ownerName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  province?: string | null;
  district?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  channel: OutletChannel;
  category?: string | null;
  routeName?: string | null;
}

export interface NormalizedRowResult {
  issues: string[];
  value?: OutletImportRow;
}

/** A parsed spreadsheet: raw header cells + raw (unconverted) data rows. */
export interface ParsedSpreadsheet {
  header: string[];
  rows: SpreadsheetCell[][];
}

export type SpreadsheetCell = string | number | null;

/** Lowers, collapses whitespace/punctuation to `_`, strips remaining symbols. */
export function normalizeHeaderName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s\-.'’]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Maps the header row onto canonical field → column index. */
export function mapHeaders(header: string[]): OutletHeaderIndex {
  const index: OutletHeaderIndex = { name: -1 };
  const seen = new Set<string>();
  header.forEach((raw, col) => {
    const normalized = normalizeHeaderName(String(raw));
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    for (const [field, aliases] of Object.entries(OUTLET_FIELD_ALIASES)) {
      if (aliases.some((a) => normalizeHeaderName(a) === normalized)) {
        index[field as keyof OutletHeaderIndex] = col;
        return;
      }
    }
  });
  if (index.name === -1) {
    const provided = header.map((h) => String(h).trim()).filter(Boolean);
    throw new Error(
      `Required column 'name' not found. Found columns: ${provided.join(', ') || '(none)'}`,
    );
  }
  return index;
}

/** Converts one raw cell value to a plain string/number (or null). */
export function cellToValue(value: unknown): SpreadsheetCell {
  if (value == null) return null;
  if (typeof value === 'string') return value.trim() === '' ? null : value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const v = value as { result?: unknown; text?: unknown };
    if ('result' in v) return cellToValue(v.result);
    if ('text' in v) return cellToValue(v.text);
  }
  return null;
}

/** Extracts the first non-empty row (header) plus data rows from an xlsx buffer. */
async function parseXlsx(buffer: Buffer): Promise<ParsedSpreadsheet> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(
      buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
    );
  } catch {
    throw new Error('Could not read the file as an Excel workbook (.xlsx)');
  }
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('The workbook does not contain a worksheet');

  const rows: SpreadsheetCell[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const values: SpreadsheetCell[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      values[colNumber - 1] = cellToValue(cell.value);
    });
    const dense = Array.from(
      { length: values.length },
      (_, i) => values[i] ?? null,
    );
    if (dense.some((v) => v !== null)) rows.push(dense);
  });

  return splitHeader(rows);
}

const CSV_DELIMITERS = [',', ';', '\t', '|'] as const;

export type CsvDelimiter = (typeof CSV_DELIMITERS)[number];

/**
 * Guesses the CSV delimiter from a text sample by counting delimiter chars
 * that appear outside quoted regions. Handles Excel's regional CSV exports
 * (`;` in many locales) and pipe/tab separators. Ties resolve to comma.
 */
export function detectCsvDelimiter(text: string): CsvDelimiter {
  const sample = text.slice(0, 64 * 1024);
  const counts: Partial<Record<CsvDelimiter, number>> = {};
  let inQuotes = false;
  for (let i = 0; i < sample.length; i += 1) {
    const ch = sample[i];
    if (ch === '"') {
      if (inQuotes && sample[i + 1] === '"') {
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && (CSV_DELIMITERS as readonly string[]).includes(ch)) {
      const delim = ch as CsvDelimiter;
      counts[delim] = (counts[delim] ?? 0) + 1;
    }
  }
  let best: CsvDelimiter = ',';
  let bestCount = 0;
  for (const delim of CSV_DELIMITERS) {
    const count = counts[delim] ?? 0;
    if (count > bestCount) {
      bestCount = count;
      best = delim;
    }
  }
  return best;
}

/**
 * RFC 4180-ish CSV parser: handles quoted fields, `""` escapes, embedded
 * commas/newlines and CRLF line endings.
 */
export function parseCsv(text: string, delimiter: string = ','): string[][] {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < source.length) {
    const char = source[i];
    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === delimiter) {
      pushField();
      i += 1;
      continue;
    }
    if (char === '\r' && source[i + 1] === '\n') {
      pushRow();
      i += 2;
      continue;
    }
    if (char === '\n') {
      pushRow();
      i += 1;
      continue;
    }
    field += char;
    i += 1;
  }
  if (field.length > 0 || row.length > 0 || source.length === 0) pushRow();
  return rows;
}

function parseCsvBuffer(buffer: Buffer): ParsedSpreadsheet {
  const text = buffer.toString('utf8');
  const delimiter = detectCsvDelimiter(text);
  const rows = parseCsv(text, delimiter).map((r) =>
    r.map((c) => (c.trim() === '' ? null : c)),
  );
  return splitHeader(rows);
}

function splitHeader(rows: SpreadsheetCell[][]): ParsedSpreadsheet {
  const data = rows.filter((r) => r.some((v) => v !== null));
  if (data.length === 0) throw new Error('The file is empty');
  const header = data[0].map((v) => String(v ?? ''));
  return { header, rows: data.slice(1) };
}

/** Parses an uploaded spreadsheet into raw header + data rows. */
export async function parseSpreadsheet(
  buffer: Buffer,
  extension: SpreadsheetExtension,
): Promise<ParsedSpreadsheet> {
  return extension === 'xlsx' ? parseXlsx(buffer) : parseCsvBuffer(buffer);
}

/** Validates + normalizes a single data row into an OutletImportRow. */
export function normalizeOutletRow(
  cells: SpreadsheetCell[],
  index: OutletHeaderIndex,
): NormalizedRowResult {
  const issues: string[] = [];
  const textAt = (col: number | undefined): string | undefined => {
    if (col === undefined) return undefined;
    const raw = cells[col];
    if (raw == null) return undefined;
    const s = String(raw).trim();
    return s === '' ? undefined : s;
  };
  const numberAt = (
    col: number | undefined,
    label: string,
  ): number | null | undefined => {
    const s = textAt(col);
    if (s === undefined) return undefined;
    const n = Number(s);
    if (!Number.isFinite(n)) {
      issues.push(`${label} must be a number`);
      return null;
    }
    return n;
  };

  const name = textAt(index.name);
  if (!name) issues.push('name is required');

  let latitude = numberAt(index.latitude, 'latitude');
  let longitude = numberAt(index.longitude, 'longitude');
  if (
    latitude !== undefined &&
    latitude !== null &&
    (latitude < -90 || latitude > 90)
  ) {
    issues.push('latitude must be between -90 and 90');
    latitude = null;
  }
  if (
    longitude !== undefined &&
    longitude !== null &&
    (longitude < -180 || longitude > 180)
  ) {
    issues.push('longitude must be between -180 and 180');
    longitude = null;
  }

  let channel: OutletChannel = 'GENERAL_TRADE';
  const channelRaw = textAt(index.channel);
  if (channelRaw) {
    const normalized = channelRaw.toUpperCase().replace(/\s+/g, '_');
    if ((OUTLET_CHANNEL as readonly string[]).includes(normalized)) {
      channel = normalized as OutletChannel;
    } else {
      issues.push(`channel must be one of ${OUTLET_CHANNEL.join(', ')}`);
    }
  }

  const optional = (col: number | undefined): string | null | undefined => {
    const s = textAt(col);
    return s === undefined ? undefined : s;
  };

  if (issues.length > 0) return { issues };

  return {
    issues: [],
    value: {
      name: name as string,
      ownerName: optional(index.ownerName) ?? null,
      email: optional(index.email) ?? null,
      phone: optional(index.phone) ?? null,
      address: optional(index.address) ?? null,
      province: optional(index.province) ?? null,
      district: optional(index.district) ?? null,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      channel,
      category: optional(index.category) ?? null,
      routeName: optional(index.routeName) ?? null,
    },
  };
}
