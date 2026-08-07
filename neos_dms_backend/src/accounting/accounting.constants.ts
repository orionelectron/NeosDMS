export const COA_TYPE = [
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'INCOME',
  'EXPENSE',
] as const;
export type CoaType = (typeof COA_TYPE)[number];

export const SYSTEM_PURPOSE = [
  'CASH',
  'BANK',
  'ACCOUNTS_RECEIVABLE',
  'ACCOUNTS_PAYABLE',
  'SALES',
  'PURCHASE',
  'COST_OF_GOODS_SOLD',
  'TAX_PAYABLE',
  'TAX_RECEIVABLE',
  'RETAINED_EARNINGS',
  'OPENING_BALANCE_EQUITY',
  'DISCOUNT_ALLOWED',
  'DISCOUNT_RECEIVED',
  'ROUNDING',
  'INVENTORY',
  'EXPENSE',
] as const;
export type SystemPurpose = (typeof SYSTEM_PURPOSE)[number];

export const JOURNAL_STATUS = ['DRAFT', 'POSTED', 'CANCELLED'] as const;
export type JournalStatus = (typeof JOURNAL_STATUS)[number];

export const PARTY_KIND = ['BUSINESS', 'INDIVIDUAL'] as const;
export type PartyKind = (typeof PARTY_KIND)[number];

export const IRD_CATEGORY = [
  'TAXABLE',
  'EXEMPT',
  'ZERO_RATED',
  'TDS_WITHHOLDING',
] as const;
export type IrdCategory = (typeof IRD_CATEGORY)[number];

export const METHOD_TYPE = [
  'CASH',
  'BANK',
  'CARD',
  'WALLET',
  'CREDIT',
  'OTHER',
] as const;
export type MethodType = (typeof METHOD_TYPE)[number];

/** Base (functional) currency code for the single-currency NPR MVP. */
export const BASE_CURRENCY_CODE = 'NPR';

/** Seed for the global NPR currency row (organization_id IS NULL). */
export const GLOBAL_NPR_CURRENCY = {
  code: BASE_CURRENCY_CODE,
  name: 'Nepalese Rupee',
  symbol: 'रू',
  precision: 2,
  isBase: true,
  isActive: true,
} as const;

/** Document types for `document_sequences` (extended by later phases). */
export const DOCUMENT_TYPES = {
  SALES_INVOICE: 'sales_invoice',
  SALES_RETURN: 'sales_return',
  CUSTOMER_RECEIPT: 'customer_receipt',
  PURCHASE_BILL: 'purchase_bill',
  PURCHASE_RETURN: 'purchase_return',
  PURCHASE_RECEIPT: 'purchase_receipt',
  SUPPLIER_PAYMENT: 'supplier_payment',
  EXPENSE: 'expense',
  JOURNAL_ENTRY: 'journal_entry',
} as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[keyof typeof DOCUMENT_TYPES];

/** Transaction types are seeded constants (system rows, organization_id NULL). */
export const TRANSACTION_TYPES: ReadonlyArray<{
  code: string;
  name: string;
  nature: string;
  affectsInventory: boolean;
  affectsTax: boolean;
}> = [
  {
    code: 'sales_invoice',
    name: 'Sales Invoice',
    nature: 'INCOME',
    affectsInventory: true,
    affectsTax: true,
  },
  {
    code: 'sales_return',
    name: 'Sales Return / Credit Note',
    nature: 'INCOME',
    affectsInventory: true,
    affectsTax: true,
  },
  {
    code: 'customer_receipt',
    name: 'Customer Receipt',
    nature: 'RECEIPT',
    affectsInventory: false,
    affectsTax: false,
  },
  {
    code: 'purchase_bill',
    name: 'Purchase Bill',
    nature: 'EXPENSE',
    affectsInventory: true,
    affectsTax: true,
  },
  {
    code: 'purchase_return',
    name: 'Purchase Return / Debit Note',
    nature: 'EXPENSE',
    affectsInventory: true,
    affectsTax: true,
  },
  {
    code: 'supplier_payment',
    name: 'Supplier Payment',
    nature: 'PAYMENT',
    affectsInventory: false,
    affectsTax: false,
  },
  {
    code: 'expense',
    name: 'Expense',
    nature: 'EXPENSE',
    affectsInventory: false,
    affectsTax: true,
  },
  {
    code: 'stock_adjustment',
    name: 'Stock Adjustment',
    nature: 'INVENTORY',
    affectsInventory: true,
    affectsTax: false,
  },
  {
    code: 'opening_balance',
    name: 'Opening Balance',
    nature: 'EQUITY',
    affectsInventory: false,
    affectsTax: false,
  },
  {
    code: 'journal',
    name: 'Manual Journal Entry',
    nature: 'GENERAL',
    affectsInventory: false,
    affectsTax: true,
  },
] as const;

/** Default payment terms seeded per organization (name → due days). */
export const DEFAULT_PAYMENT_TERMS: ReadonlyArray<{
  name: string;
  dueDays: number;
}> = [
  { name: 'Cash on Delivery', dueDays: 0 },
  { name: 'Net 7', dueDays: 7 },
  { name: 'Net 15', dueDays: 15 },
  { name: 'Net 30', dueDays: 30 },
];

/** Default payment methods seeded per organization. */
export const DEFAULT_PAYMENT_METHODS: ReadonlyArray<{
  name: string;
  methodType: MethodType;
}> = [
  { name: 'Cash', methodType: 'CASH' },
  { name: 'Bank Transfer', methodType: 'BANK' },
  { name: 'Card', methodType: 'CARD' },
];
