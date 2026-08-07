export const SALES_ORDER_STATUSES = [
  'DRAFT',
  'CONFIRMED',
  'COMPLETED',
  'CANCELED',
] as const;
export type SalesOrderStatus = (typeof SALES_ORDER_STATUSES)[number];

export const SALES_INVOICE_STATUSES = ['DRAFT', 'POSTED', 'CANCELLED'] as const;
export type SalesInvoiceStatus = (typeof SALES_INVOICE_STATUSES)[number];

export const SALES_RETURN_STATUSES = ['DRAFT', 'POSTED', 'CANCELLED'] as const;
export type SalesReturnStatus = (typeof SALES_RETURN_STATUSES)[number];

export const CUSTOMER_RECEIPT_STATUSES = [
  'DRAFT',
  'POSTED',
  'CANCELLED',
] as const;
export type CustomerReceiptStatus = (typeof CUSTOMER_RECEIPT_STATUSES)[number];

export const CBMS_PUSH_STATUSES = [
  'NOT_REQUIRED',
  'PENDING',
  'PUSHED',
  'FAILED',
] as const;
export type CbmsPushStatus = (typeof CBMS_PUSH_STATUSES)[number];

/** document_sequences documentType used for sales-order numbering. */
export const SALES_ORDER_DOCUMENT_TYPE = 'sales_order';

/** document_sequences documentType used for sales-invoice numbering. */
export const SALES_INVOICE_DOCUMENT_TYPE = 'sales_invoice';

/** document_sequences documentType used for credit-note numbering. */
export const SALES_RETURN_DOCUMENT_TYPE = 'sales_return';

/** Credit note prefix — reserved at POST, drafts stay numberless. */
export const SALES_RETURN_NUMBER_PREFIX = 'CN-';

/** document_sequences documentType used for customer-receipt numbering. */
export const CUSTOMER_RECEIPT_DOCUMENT_TYPE = 'customer_receipt';

/** Receipt prefix — reserved at POST, drafts stay numberless. */
export const CUSTOMER_RECEIPT_NUMBER_PREFIX = 'RCV-';

export const SALES_ORDER_AUDIT_ACTIONS = {
  CREATE: 'sales.order.create',
  UPDATE: 'sales.order.update',
  CONFIRM: 'sales.order.confirm',
  COMPLETE: 'sales.order.complete',
  CANCEL: 'sales.order.cancel',
} as const;

export const SALES_INVOICE_AUDIT_ACTIONS = {
  CREATE: 'sales.invoice.create',
  UPDATE: 'sales.invoice.update',
  POST: 'sales.invoice.post',
  VOID: 'sales.invoice.void',
} as const;

export const SALES_AUDIT_ACTIONS = {
  RETURN_CREATE: 'sales.return.create',
  RETURN_UPDATE: 'sales.return.update',
  RETURN_POST: 'sales.return.post',
  RETURN_VOID: 'sales.return.void',
  RECEIPT_CREATE: 'sales.receipt.create',
  RECEIPT_UPDATE: 'sales.receipt.update',
  RECEIPT_POST: 'sales.receipt.post',
  RECEIPT_VOID: 'sales.receipt.void',
} as const;
