export const SALES_ORDER_STATUSES = [
  'DRAFT',
  'CONFIRMED',
  'COMPLETED',
  'CANCELED',
] as const;
export type SalesOrderStatus = (typeof SALES_ORDER_STATUSES)[number];

export const SALES_INVOICE_STATUSES = ['DRAFT', 'POSTED', 'CANCELLED'] as const;
export type SalesInvoiceStatus = (typeof SALES_INVOICE_STATUSES)[number];

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
