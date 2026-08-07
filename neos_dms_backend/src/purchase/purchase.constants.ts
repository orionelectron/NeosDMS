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

export const PURCHASE_AUDIT_ACTIONS = {
  RECEIPT_CREATE: 'purchase.receipt.create',
  RECEIPT_UPDATE: 'purchase.receipt.update',
  RECEIPT_POST: 'purchase.receipt.post',
  RECEIPT_VOID: 'purchase.receipt.void',
} as const;
