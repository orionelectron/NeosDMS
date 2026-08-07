import type { Seed } from './seed.interface';

const TAX_TYPES: ReadonlyArray<{
  name: string;
  description: string;
  mathSign: number;
}> = [
  { name: 'VAT', description: 'Value Added Tax', mathSign: 1 },
  { name: 'TDS', description: 'Tax Deducted at Source', mathSign: -1 },
  { name: 'Exempt', description: 'Exempt from tax', mathSign: 1 },
];

const TAX_TEMPLATES: ReadonlyArray<{
  taxTypeName: string;
  name: string;
  rate: string;
  irdCategory: string;
  mathSign: number;
}> = [
  {
    taxTypeName: 'VAT',
    name: 'VAT 13%',
    rate: '13',
    irdCategory: 'TAXABLE',
    mathSign: 1,
  },
  {
    taxTypeName: 'VAT',
    name: 'VAT 0%',
    rate: '0',
    irdCategory: 'ZERO_RATED',
    mathSign: 1,
  },
  {
    taxTypeName: 'VAT',
    name: 'Exempt',
    rate: '0',
    irdCategory: 'EXEMPT',
    mathSign: 1,
  },
  {
    taxTypeName: 'TDS',
    name: 'TDS 1.5%',
    rate: '1.5',
    irdCategory: 'TDS_WITHHOLDING',
    mathSign: -1,
  },
  {
    taxTypeName: 'TDS',
    name: 'TDS 15%',
    rate: '15',
    irdCategory: 'TDS_WITHHOLDING',
    mathSign: -1,
  },
];

/**
 * System tax types + templates (global rows, no organization). Tax codes per
 * organization are provisioned at onboarding/backfill.
 */
export const taxCatalogSeed: Seed = {
  version: 7,
  name: 'tax-types-and-templates',
  async run(manager) {
    await manager.query(
      `INSERT INTO tax_types (id, name, description, math_sign, is_system)
       SELECT uuid_generate_v4(), t.name, t.description, t.math_sign, true
       FROM jsonb_to_recordset($1::jsonb)
            AS t(name text, description text, math_sign integer)
       ON CONFLICT (name) DO NOTHING`,
      [
        JSON.stringify(
          TAX_TYPES.map((row) => ({
            name: row.name,
            description: row.description,
            math_sign: row.mathSign,
          })),
        ),
      ],
    );

    await manager.query(
      `INSERT INTO tax_templates
         (id, tax_type_id, name, rate, ird_category, math_sign, is_active)
       SELECT uuid_generate_v4(), tt.id, t.name, t.rate, t.ird_category,
              t.math_sign, true
       FROM jsonb_to_recordset($1::jsonb)
            AS t(tax_type_name text, name text, rate numeric, ird_category text, math_sign integer)
       JOIN tax_types tt ON tt.name = t.tax_type_name
       ON CONFLICT DO NOTHING`,
      [
        JSON.stringify(
          TAX_TEMPLATES.map((row) => ({
            tax_type_name: row.taxTypeName,
            name: row.name,
            rate: row.rate,
            ird_category: row.irdCategory,
            math_sign: row.mathSign,
          })),
        ),
      ],
    );
  },
};
