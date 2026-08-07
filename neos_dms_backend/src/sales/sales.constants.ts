export const SALES_ORDER_STATUSES = [
  'DRAFT',
  'CONFIRMED',
  'COMPLETED',
  'CANCELED',
] as const;
export type SalesOrderStatus = (typeof SALES_ORDER_STATUSES)[number];

/** document_sequences documentType used for sales-order numbering. */
export const SALES_ORDER_DOCUMENT_TYPE = 'sales_order';

export const SALES_ORDER_AUDIT_ACTIONS = {
  CREATE: 'sales.order.create',
  UPDATE: 'sales.order.update',
  CONFIRM: 'sales.order.confirm',
  COMPLETE: 'sales.order.complete',
  CANCEL: 'sales.order.cancel',
} as const;
