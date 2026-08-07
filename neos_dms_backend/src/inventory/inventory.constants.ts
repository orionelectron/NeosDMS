export const INVENTORY_LOCATION_TYPES = [
  'GODOWN',
  'VAN',
  'SHOP',
  'WAREHOUSE',
] as const;
export type InventoryLocationType = (typeof INVENTORY_LOCATION_TYPES)[number];

/** MVP movement types; sales_invoice/sales_return/purchase_receipt/purchase_return are added via migration when those phases wire stock moves. */
export const INVENTORY_TXN_TYPES = [
  'opening_stock',
  'stock_adjustment',
  'stock_transfer',
] as const;
export type InventoryTransactionType = (typeof INVENTORY_TXN_TYPES)[number];

export const INVENTORY_DIRECTIONS = ['IN', 'OUT'] as const;
export type InventoryDirection = (typeof INVENTORY_DIRECTIONS)[number];

export const INVENTORY_AUDIT_ACTIONS = {
  LOCATION_CREATE: 'inventory.location.create',
  LOCATION_UPDATE: 'inventory.location.update',
  LOCATION_DELETE: 'inventory.location.delete',
  TXN_POST: 'inventory.transaction.post',
} as const;
