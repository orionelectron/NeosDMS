import type { CoaType, SystemPurpose } from './accounting.constants';

export interface DefaultAccount {
  code: string;
  name: string;
  coaType: CoaType;
  parentCode: string | null;
  isGroup?: boolean;
  systemPurpose?: SystemPurpose;
}

/**
 * Default NPR chart of accounts for an FMCG distributor. Codes are
 * org-unique; leaf accounts with a `systemPurpose` are created as locked
 * system accounts that the posting engine resolves by purpose.
 */
export const DEFAULT_COA: readonly DefaultAccount[] = [
  // ── Assets ──────────────────────────────────────────────
  {
    code: '1000',
    name: 'Assets',
    coaType: 'ASSET',
    parentCode: null,
    isGroup: true,
  },
  {
    code: '1100',
    name: 'Current Assets',
    coaType: 'ASSET',
    parentCode: '1000',
    isGroup: true,
  },
  {
    code: '1101',
    name: 'Cash',
    coaType: 'ASSET',
    parentCode: '1100',
    systemPurpose: 'CASH',
  },
  {
    code: '1102',
    name: 'Bank Accounts',
    coaType: 'ASSET',
    parentCode: '1100',
    systemPurpose: 'BANK',
  },
  {
    code: '1103',
    name: 'Accounts Receivable',
    coaType: 'ASSET',
    parentCode: '1100',
    systemPurpose: 'ACCOUNTS_RECEIVABLE',
  },
  {
    code: '1104',
    name: 'Inventory',
    coaType: 'ASSET',
    parentCode: '1100',
    systemPurpose: 'INVENTORY',
  },
  {
    code: '1105',
    name: 'VAT Receivable',
    coaType: 'ASSET',
    parentCode: '1100',
    systemPurpose: 'TAX_RECEIVABLE',
  },
  {
    code: '1200',
    name: 'Non-current Assets',
    coaType: 'ASSET',
    parentCode: '1000',
    isGroup: true,
  },
  {
    code: '1201',
    name: 'Property, Plant & Equipment',
    coaType: 'ASSET',
    parentCode: '1200',
    isGroup: true,
  },
  {
    code: '1202',
    name: 'Equipment & Vehicles',
    coaType: 'ASSET',
    parentCode: '1201',
  },

  // ── Liabilities ─────────────────────────────────────────
  {
    code: '2000',
    name: 'Liabilities',
    coaType: 'LIABILITY',
    parentCode: null,
    isGroup: true,
  },
  {
    code: '2100',
    name: 'Current Liabilities',
    coaType: 'LIABILITY',
    parentCode: '2000',
    isGroup: true,
  },
  {
    code: '2101',
    name: 'Accounts Payable',
    coaType: 'LIABILITY',
    parentCode: '2100',
    systemPurpose: 'ACCOUNTS_PAYABLE',
  },
  {
    code: '2102',
    name: 'VAT Payable',
    coaType: 'LIABILITY',
    parentCode: '2100',
    systemPurpose: 'TAX_PAYABLE',
  },
  {
    code: '2103',
    name: 'TDS Payable',
    coaType: 'LIABILITY',
    parentCode: '2100',
    systemPurpose: 'TDS_PAYABLE',
  },
  {
    code: '2200',
    name: 'Long-term Liabilities',
    coaType: 'LIABILITY',
    parentCode: '2000',
    isGroup: true,
  },
  {
    code: '2201',
    name: 'Loans Payable',
    coaType: 'LIABILITY',
    parentCode: '2200',
  },

  // ── Equity ──────────────────────────────────────────────
  {
    code: '3000',
    name: 'Equity',
    coaType: 'EQUITY',
    parentCode: null,
    isGroup: true,
  },
  {
    code: '3101',
    name: 'Retained Earnings',
    coaType: 'EQUITY',
    parentCode: '3000',
    systemPurpose: 'RETAINED_EARNINGS',
  },
  {
    code: '3102',
    name: 'Opening Balance Equity',
    coaType: 'EQUITY',
    parentCode: '3000',
    systemPurpose: 'OPENING_BALANCE_EQUITY',
  },
  {
    code: '3103',
    name: "Owner's Capital",
    coaType: 'EQUITY',
    parentCode: '3000',
  },

  // ── Income ──────────────────────────────────────────────
  {
    code: '4000',
    name: 'Income',
    coaType: 'INCOME',
    parentCode: null,
    isGroup: true,
  },
  {
    code: '4101',
    name: 'Sales Revenue',
    coaType: 'INCOME',
    parentCode: '4000',
    systemPurpose: 'SALES',
  },
  {
    code: '4102',
    name: 'Sales Discounts',
    coaType: 'INCOME',
    parentCode: '4000',
    systemPurpose: 'DISCOUNT_ALLOWED',
  },
  { code: '4103', name: 'Other Income', coaType: 'INCOME', parentCode: '4000' },

  // ── Expenses ────────────────────────────────────────────
  {
    code: '5000',
    name: 'Expenses',
    coaType: 'EXPENSE',
    parentCode: null,
    isGroup: true,
  },
  {
    code: '5101',
    name: 'Cost of Goods Sold',
    coaType: 'EXPENSE',
    parentCode: '5000',
    systemPurpose: 'COST_OF_GOODS_SOLD',
  },
  {
    code: '5102',
    name: 'Purchases',
    coaType: 'EXPENSE',
    parentCode: '5000',
    systemPurpose: 'PURCHASE',
  },
  {
    code: '5103',
    name: 'General Expenses',
    coaType: 'EXPENSE',
    parentCode: '5000',
    systemPurpose: 'EXPENSE',
  },
  {
    code: '5104',
    name: 'Discounts Received',
    coaType: 'EXPENSE',
    parentCode: '5000',
    systemPurpose: 'DISCOUNT_RECEIVED',
  },
  {
    code: '5105',
    name: 'Rounding',
    coaType: 'EXPENSE',
    parentCode: '5000',
    systemPurpose: 'ROUNDING',
  },
];
