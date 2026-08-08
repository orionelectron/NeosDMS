import { apiFetch, apiFetchPaginated } from "@/lib/api/http";
import type { Item, Uom } from "@/lib/api/trading";
import type { ListQuery } from "@/lib/api/trading";
import { toQuery } from "@/lib/api/trading";

// ---------------------------------------------------------------------------
// Shared enums (mirrors backend `inventory.constants.ts`)
// ---------------------------------------------------------------------------

export const INVENTORY_LOCATION_TYPES = [
  "GODOWN",
  "VAN",
  "SHOP",
  "WAREHOUSE",
] as const;
export type InventoryLocationType = (typeof INVENTORY_LOCATION_TYPES)[number];

export const INVENTORY_TXN_TYPES = [
  "opening_stock",
  "stock_adjustment",
  "stock_transfer",
  "sales_invoice",
  "sales_return",
  "purchase_receipt",
  "purchase_bill",
  "purchase_return",
] as const;
export type InventoryTxnType = (typeof INVENTORY_TXN_TYPES)[number];

export const INVENTORY_DIRECTIONS = ["IN", "OUT"] as const;
export type InventoryDirection = (typeof INVENTORY_DIRECTIONS)[number];

export const INVENTORY_TXN_TYPE_LABELS: Record<InventoryTxnType, string> = {
  opening_stock: "Opening stock",
  stock_adjustment: "Adjustment",
  stock_transfer: "Transfer",
  sales_invoice: "Sales invoice",
  sales_return: "Sales return",
  purchase_receipt: "Purchase receipt",
  purchase_bill: "Purchase bill",
  purchase_return: "Purchase return",
};

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------

export interface InventoryLocation {
  id: string;
  organizationId: string;
  branchId: string | null;
  name: string;
  code: string;
  locationType: InventoryLocationType;
  address: string | null;
  notes: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInventoryLocationDto {
  name: string;
  code: string;
  locationType: InventoryLocationType;
  branchId?: string;
  address?: string;
  notes?: string;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface UpdateInventoryLocationDto {
  name?: string;
  locationType?: InventoryLocationType;
  branchId?: string;
  address?: string;
  notes?: string;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface LocationListQuery extends ListQuery {
  locationType?: InventoryLocationType;
}

export const locationApi = {
  list: (query: LocationListQuery = {}) => {
    const { page, limit, search, locationType } = query;
    return apiFetchPaginated<InventoryLocation>(
      `/inventory/locations?${toQuery({ page, limit, search, locationType })}`,
    );
  },
  get: (id: string) =>
    apiFetch<InventoryLocation>(`/inventory/locations/${id}`),
  create: (dto: CreateInventoryLocationDto) =>
    apiFetch<InventoryLocation>("/inventory/locations", {
      method: "POST",
      body: dto,
    }),
  update: (id: string, dto: UpdateInventoryLocationDto) =>
    apiFetch<InventoryLocation>(`/inventory/locations/${id}`, {
      method: "PATCH",
      body: dto,
    }),
  remove: (id: string) =>
    apiFetch<{ deleted: boolean }>(`/inventory/locations/${id}`, {
      method: "DELETE",
    }),
};

// ---------------------------------------------------------------------------
// Balances (read-only; quantity/avgCost arrive as decimal strings)
// ---------------------------------------------------------------------------

export interface InventoryBalance {
  id: string;
  organizationId: string;
  locationId: string;
  location?: InventoryLocation | null;
  itemId: string;
  item?: Item | null;
  /** On-hand quantity in the item's base UOM (decimal string). */
  quantity: string;
  /** Moving-average cost per base UOM (decimal string). */
  avgCost: string;
  createdAt: string;
  updatedAt: string;
}

export interface BalanceListQuery extends ListQuery {
  locationId?: string;
  itemId?: string;
  includeZero?: boolean;
}

export const balanceApi = {
  list: (query: BalanceListQuery = {}) => {
    const { page, limit, locationId, itemId, includeZero } = query;
    return apiFetchPaginated<InventoryBalance>(
      `/inventory/balances?${toQuery({ page, limit, locationId, itemId, includeZero })}`,
    );
  },
};

export interface InventoryLowStockRow {
  itemId: string;
  itemName: string;
  itemCode: string | null;
  locationId: string | null;
  locationName: string | null;
  onHand: number;
  reorderLevel: number;
}

export interface LowStockQuery extends ListQuery {
  locationId?: string;
}

export const lowStockApi = {
  list: (query: LowStockQuery = {}) => {
    const { page, limit, locationId } = query;
    return apiFetchPaginated<InventoryLowStockRow>(
      `/inventory/balances/low-stock?${toQuery({ page, limit, locationId })}`,
    );
  },
};

// ---------------------------------------------------------------------------
// Transactions + movements (post-only; transactions are immutable once POSTED)
// ---------------------------------------------------------------------------

export interface InventoryTransactionLine {
  id: string;
  organizationId: string;
  transactionId: string;
  itemId: string;
  item?: Item | null;
  uomId: string;
  uom?: Uom | null;
  direction: InventoryDirection;
  /** Quantity in the line's UOM (decimal string). */
  quantity: string;
  /** Unit cost in the line's UOM (decimal string). */
  unitCost: string;
}

export interface InventoryTransaction {
  id: string;
  organizationId: string;
  locationId: string;
  location?: InventoryLocation | null;
  toLocationId: string | null;
  toLocation?: InventoryLocation | null;
  transactionNumber: string;
  transactionType: InventoryTxnType;
  referenceType: string | null;
  referenceId: string | null;
  status: string;
  bsDate: string;
  occurredAt: string;
  notes: string | null;
  lines?: InventoryTransactionLine[];
  createdAt: string;
  updatedAt: string;
}

export interface TransactionListQuery extends ListQuery {
  locationId?: string;
  itemId?: string;
  type?: InventoryTxnType;
}

export interface InventoryLineDto {
  itemId: string;
  uomId: string;
  direction?: InventoryDirection;
  quantity: number;
  unitCost?: number;
}

export interface OpeningStockDto {
  locationId: string;
  lines: InventoryLineDto[];
  notes?: string;
}

export interface StockAdjustmentDto {
  locationId: string;
  lines: InventoryLineDto[];
  notes?: string;
}

export interface StockTransferDto {
  fromLocationId: string;
  toLocationId: string;
  lines: InventoryLineDto[];
  notes?: string;
}

export const transactionApi = {
  list: (query: TransactionListQuery = {}) => {
    const { page, limit, locationId, itemId, type } = query;
    return apiFetchPaginated<InventoryTransaction>(
      `/inventory/transactions?${toQuery({ page, limit, locationId, itemId, type })}`,
    );
  },
  get: (id: string) =>
    apiFetch<InventoryTransaction>(`/inventory/transactions/${id}`),
};

export const movementApi = {
  openingStock: (dto: OpeningStockDto) =>
    apiFetch<InventoryTransaction>("/inventory/opening-stock", {
      method: "POST",
      body: dto,
    }),
  adjustment: (dto: StockAdjustmentDto) =>
    apiFetch<InventoryTransaction>("/inventory/adjustments", {
      method: "POST",
      body: dto,
    }),
  transfer: (dto: StockTransferDto) =>
    apiFetch<InventoryTransaction>("/inventory/transfers", {
      method: "POST",
      body: dto,
    }),
};
