export const PURCHASE_RECEIPT_STATUSES = [
  'DRAFT',
  'POSTED',
  'CANCELLED',
] as const;
export type PurchaseReceiptStatus = (typeof PURCHASE_RECEIPT_STATUSES)[number];

/** document_sequences documentType used for GRN numbering. */
export const PURCHASE_RECEIPT_DOCUMENT_TYPE = 'purchase_receipt';

/** GRN number prefix — the number is reserved at POST, drafts stay numberless. */
export const PURCHASE_RECEIPT_NUMBER_PREFIX = 'GRN-';

export const PURCHASE_BILL_STATUSES = ['DRAFT', 'POSTED', 'CANCELLED'] as const;
export type PurchaseBillStatus = (typeof PURCHASE_BILL_STATUSES)[number];

/** document_sequences documentType used for purchase bill numbering. */
export const PURCHASE_BILL_DOCUMENT_TYPE = 'purchase_bill';

/** Bill number prefix — reserved at POST, drafts stay numberless. */
export const PURCHASE_BILL_NUMBER_PREFIX = 'BILL-';

export const PURCHASE_RETURN_STATUSES = [
  'DRAFT',
  'POSTED',
  'CANCELLED',
] as const;
export type PurchaseReturnStatus = (typeof PURCHASE_RETURN_STATUSES)[number];

/** document_sequences documentType used for debit note numbering. */
export const PURCHASE_RETURN_DOCUMENT_TYPE = 'purchase_return';

/** Debit note prefix — reserved at POST, drafts stay numberless. */
export const PURCHASE_RETURN_NUMBER_PREFIX = 'DN-';

export const SUPPLIER_PAYMENT_STATUSES = [
  'DRAFT',
  'POSTED',
  'CANCELLED',
] as const;
export type SupplierPaymentStatus = (typeof SUPPLIER_PAYMENT_STATUSES)[number];

/** document_sequences documentType used for payment voucher numbering. */
export const SUPPLIER_PAYMENT_DOCUMENT_TYPE = 'supplier_payment';

/** Payment voucher prefix — reserved at POST, drafts stay numberless. */
export const SUPPLIER_PAYMENT_NUMBER_PREFIX = 'PMT-';

export const EXPENSE_STATUSES = ['DRAFT', 'POSTED', 'CANCELLED'] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

/** Expense settlement modes — `CASH` (CR the payment account) or `CREDIT` (CR AP 2101 with the vendor party). */
export const EXPENSE_MODES = ['CASH', 'CREDIT'] as const;
export type ExpenseMode = (typeof EXPENSE_MODES)[number];

/** document_sequences documentType used for expense voucher numbering. */
export const EXPENSE_DOCUMENT_TYPE = 'expense';

/** Expense voucher prefix — reserved at POST, drafts stay numberless. */
export const EXPENSE_NUMBER_PREFIX = 'EXP-';

/** Account purposes resolved at POST (mirror the purchase-bill journal). */
export const EXPENSE_JOURNAL_PURPOSES = {
  VAT_RECEIVABLE: 'vat_receivable',
  ACCOUNT_PAYABLE: 'account_payable',
  TDS_PAYABLE: 'tds_payable',
} as const;

export const EXPENSE_AUDIT_ACTIONS = {
  CREATE: 'purchase.expense.create',
  UPDATE: 'purchase.expense.update',
  POST: 'purchase.expense.post',
  VOID: 'purchase.expense.void',
} as const;

export const PURCHASE_AUDIT_ACTIONS = {
  RECEIPT_CREATE: 'purchase.receipt.create',
  RECEIPT_UPDATE: 'purchase.receipt.update',
  RECEIPT_POST: 'purchase.receipt.post',
  RECEIPT_VOID: 'purchase.receipt.void',
  BILL_CREATE: 'purchase.bill.create',
  BILL_UPDATE: 'purchase.bill.update',
  BILL_POST: 'purchase.bill.post',
  BILL_VOID: 'purchase.bill.void',
  RETURN_CREATE: 'purchase.return.create',
  RETURN_UPDATE: 'purchase.return.update',
  RETURN_POST: 'purchase.return.post',
  RETURN_VOID: 'purchase.return.void',
  PAYMENT_CREATE: 'purchase.payment.create',
  PAYMENT_UPDATE: 'purchase.payment.update',
  PAYMENT_POST: 'purchase.payment.post',
  PAYMENT_VOID: 'purchase.payment.void',
} as const;
