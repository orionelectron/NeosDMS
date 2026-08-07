export const ITEM_TYPE = ['GOODS', 'SERVICE', 'RAW', 'ASSET'] as const;
export type ItemType = (typeof ITEM_TYPE)[number];

export const VALUATION_METHOD = ['FIFO', 'WEIGHTED_AVERAGE'] as const;
export type ValuationMethod = (typeof VALUATION_METHOD)[number];

/**
 * Inventory tracking mode. MVP only ships `QUANTITY` (no batches/serials);
 * the enum keeps the full FMCG-later surface (batches P1, serials dropped)
 * so a future column upgrade doesn't need a CHECK migration.
 */
export const INVENTORY_TRACKING = [
  'NONE',
  'QUANTITY',
  'BATCH',
  'SERIAL',
] as const;
export type InventoryTracking = (typeof INVENTORY_TRACKING)[number];

/** `-1` = unlimited, mirroring `UNLIMITED` in the subscription module. */
export const UNLIMITED_REORDER = -1;
