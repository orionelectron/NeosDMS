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
} as const;
